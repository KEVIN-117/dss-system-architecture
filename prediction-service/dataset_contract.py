"""Validation boundary for prepared academic datasets.

This module validates prepared rows and adapts the DW retention fact shape. It
does not extract OLTP data, decide institutional eligibility, or train models.
"""

from __future__ import annotations

from collections import Counter
from dataclasses import dataclass
from datetime import date, datetime
from decimal import Decimal
import hashlib
import json
import math
import re
from typing import Any, Iterable, Mapping
from uuid import UUID


_GRAIN = "student_program_academic_cut"
_OUTCOMES = {"RETENIDO", "DESERTOR", "NO_EVALUABLE"}
_POPULATION_STATES = {"ELIGIBLE", "OUT_OF_SCOPE", "AMBIGUOUS", "UNRESOLVED"}
_NON_NEGATIVE_INTEGER_FIELDS = {
    "materias_cursadas",
    "materias_aprobadas",
    "materias_reprobadas",
    "materias_arrastradas",
    "conteo_snapshot",
    "conteo_evaluable",
    "conteo_desercion",
}
_REQUIRED_ROW_FIELDS = {
    "student_ref",
    "program_ref",
    "cut_id",
    "academic_year",
    "academic_period",
    "source_run_id",
    "population_status",
    "resultado_retencion",
    "es_desercion",
    "conteo_snapshot",
    "conteo_evaluable",
    "conteo_desercion",
}


def compute_snapshot_digest(rows: Iterable[Mapping[str, Any]]) -> str:
    """Compute SHA-256 over canonical JSONL records in their supplied order."""
    digest = hashlib.sha256()
    for row in rows:
        if not isinstance(row, Mapping) or not all(isinstance(key, str) for key in row):
            raise ValueError("Snapshot records must be objects with string keys.")
        canonical_row = json.dumps(
            row,
            sort_keys=True,
            separators=(",", ":"),
            ensure_ascii=False,
            allow_nan=False,
            default=_canonical_json_value,
        ).encode("utf-8")
        digest.update(canonical_row + b"\n")
    return digest.hexdigest()


@dataclass(frozen=True)
class ValidationIssue:
    code: str
    path: str
    message: str
    blocking: bool = False


@dataclass(frozen=True)
class DatasetValidationReport:
    status: str
    row_count: int
    population_counts: Mapping[str, int]
    outcome_counts: Mapping[str, int]
    missing_counts: Mapping[str, int]
    issues: tuple[ValidationIssue, ...]

    @property
    def structurally_valid(self) -> bool:
        return not any(not issue.blocking for issue in self.issues)

    @property
    def ready_for_preparation(self) -> bool:
        return self.status == "READY_FOR_PREPARATION"


def adapt_dw_retention_row(row: Mapping[str, Any]) -> dict[str, Any]:
    """Map an authorized, joined DW row to the prepared-dataset field names.

    ``student_ref`` and ``population_status`` must be supplied by the approved
    extraction/policy. The adapter intentionally does not expose the DW's
    natural student identifiers or infer first/second-year eligibility.
    """
    required = {
        "student_ref",
        "programa_sk",
        "closure_id",
        "gestion",
        "periodo",
        "run_id",
        "population_status",
        "resultado_retencion",
        "es_desercion",
        "conteo_snapshot",
        "conteo_evaluable",
        "conteo_desercion",
    }
    missing = sorted(required - row.keys())
    if missing:
        raise ValueError(f"DW retention row is missing required fields: {', '.join(missing)}")

    adapted: dict[str, Any] = {
        "student_ref": row["student_ref"],
        "program_ref": str(row["programa_sk"]),
        "cut_id": str(row["closure_id"]),
        "academic_year": row["gestion"],
        "academic_period": row["periodo"],
        "source_run_id": str(row["run_id"]),
        "population_status": row["population_status"],
        "resultado_retencion": row["resultado_retencion"],
        "es_desercion": row["es_desercion"],
        "conteo_snapshot": row["conteo_snapshot"],
        "conteo_evaluable": row["conteo_evaluable"],
        "conteo_desercion": row["conteo_desercion"],
    }
    for field in (
        "materias_cursadas",
        "materias_aprobadas",
        "materias_reprobadas",
        "materias_arrastradas",
        "ppa_acumulado",
    ):
        adapted[field] = row.get(field)
    return adapted


def validate_prepared_dataset(
    manifest: Mapping[str, Any], rows: Iterable[Mapping[str, Any]]
) -> DatasetValidationReport:
    """Validate snapshot structure and report whether preparation may proceed.

    A structurally valid dataset remains blocked until its target and population
    definitions are approved, and all candidate features are proven available
    at the prediction cut.
    """
    if not isinstance(manifest, Mapping):
        issue = ValidationIssue("INVALID_MANIFEST", "manifest", "Manifest must be an object.")
        return DatasetValidationReport("INVALID", 0, {}, {}, {}, (issue,))

    issues: list[ValidationIssue] = []
    _validate_manifest(manifest, issues)

    fields_value = manifest.get("fields", [])
    fields = fields_value if isinstance(fields_value, list) else []
    features_value = manifest.get("feature_fields", [])
    feature_names = set(features_value) if isinstance(features_value, list) and all(isinstance(name, str) for name in features_value) else set()
    target_field_value = manifest.get("target_field")
    target_field = target_field_value if isinstance(target_field_value, str) else None
    field_by_name = {
        field.get("name"): field
        for field in fields
        if isinstance(field, Mapping) and isinstance(field.get("name"), str)
    }

    for name in sorted(feature_names):
        field = field_by_name.get(name)
        if field is None:
            issues.append(ValidationIssue("UNKNOWN_FEATURE", f"feature_fields.{name}", "Feature is absent from the manifest."))
            continue
        if field.get("role") != "feature":
            issues.append(ValidationIssue("INVALID_FEATURE_ROLE", f"fields.{name}.role", "A predictor must have role 'feature'."))
        if field.get("available_at_cut") is not True:
            issues.append(ValidationIssue("TEMPORAL_AVAILABILITY_UNPROVEN", f"fields.{name}.available_at_cut", "Feature availability at the prediction cut is not proven.", blocking=True))
    if target_field and target_field in feature_names:
        issues.append(ValidationIssue("TARGET_LEAKAGE", f"feature_fields.{target_field}", "The target cannot also be a predictor."))
    if target_field:
        target = field_by_name.get(target_field)
        if target is None or target.get("role") != "target":
            issues.append(ValidationIssue("INVALID_TARGET_FIELD", "target_field", "The target field must exist and have role 'target'."))

    if manifest.get("target_approved") is not True or not manifest.get("target_definition_ref"):
        issues.append(ValidationIssue("TARGET_NOT_APPROVED", "target_definition_ref", "A DSA-approved target definition is required before preparation.", blocking=True))
    if manifest.get("target_approved") is True and (not target_field or not isinstance(manifest.get("target_definition"), Mapping)):
        issues.append(ValidationIssue("TARGET_DEFINITION_INCOMPLETE", "target_definition", "An approved target requires an explicit field and class definition."))
    if manifest.get("target_approved") is True:
        target_definition = manifest.get("target_definition")
        if isinstance(target_definition, Mapping):
            positive = target_definition.get("positive_class")
            negative = target_definition.get("negative_class")
            if not isinstance(positive, str) or not positive.strip() or not isinstance(negative, str) or not negative.strip() or positive == negative:
                issues.append(ValidationIssue("INVALID_TARGET_CLASSES", "target_definition", "Approved positive and negative classes must be distinct non-empty strings."))
    if manifest.get("eligibility_approved") is not True or not manifest.get("population_definition_ref"):
        issues.append(ValidationIssue("POPULATION_NOT_APPROVED", "population_definition_ref", "A DSA-approved population rule is required before preparation.", blocking=True))
    if not feature_names:
        issues.append(ValidationIssue("NO_APPROVED_FEATURES", "feature_fields", "No predictors are declared.", blocking=True))

    row_count = 0
    population_counts: Counter[str] = Counter()
    outcome_counts: Counter[str] = Counter()
    target_counts: Counter[str] = Counter()
    missing_counts: Counter[str] = Counter()
    seen_grain_keys: set[tuple[str, str, str]] = set()
    last_grain_key: tuple[str, str, str] | None = None
    digest = hashlib.sha256()
    for index, row in enumerate(rows):
        row_count += 1
        row_path = f"rows[{index}]"
        if not isinstance(row, Mapping):
            issues.append(ValidationIssue("INVALID_ROW", row_path, "Each record must be an object."))
            continue
        if not all(isinstance(key, str) for key in row):
            issues.append(ValidationIssue("INVALID_ROW_FIELDS", row_path, "Record field names must be strings."))
            continue
        try:
            canonical_row = json.dumps(
                row,
                sort_keys=True,
                separators=(",", ":"),
                ensure_ascii=False,
                allow_nan=False,
                default=_canonical_json_value,
            ).encode("utf-8")
            digest.update(canonical_row + b"\n")
        except (TypeError, ValueError):
            issues.append(ValidationIssue("NON_CANONICAL_ROW", row_path, "Record contains a value that cannot be canonically serialized."))
        missing = sorted(_REQUIRED_ROW_FIELDS - row.keys())
        if missing:
            issues.append(ValidationIssue("MISSING_ROW_FIELDS", row_path, f"Missing required fields: {', '.join(missing)}."))
            continue
        for name in feature_names:
            if name not in row:
                issues.append(ValidationIssue("MISSING_FEATURE", f"{row_path}.{name}", "Declared predictor is missing from the record."))
        for name, definition in field_by_name.items():
            if name not in row:
                if definition.get("nullable") is not True:
                    issues.append(ValidationIssue("MISSING_REQUIRED_FIELD", f"{row_path}.{name}", "Required field is missing."))
                continue
            value = row[name]
            if value is None or (isinstance(value, str) and not value.strip()):
                missing_counts[name] += 1
                if definition.get("nullable") is not True:
                    issues.append(ValidationIssue("NULL_REQUIRED_FIELD", f"{row_path}.{name}", "Required field is null or empty."))
            elif not _matches_logical_type(value, definition.get("logical_type")):
                issues.append(ValidationIssue("INVALID_FIELD_TYPE", f"{row_path}.{name}", "Value does not match the declared logical type."))
        undeclared_fields = sorted(row.keys() - field_by_name.keys())
        if undeclared_fields:
            issues.append(ValidationIssue("UNDECLARED_ROW_FIELDS", row_path, f"Undeclared fields are present: {', '.join(undeclared_fields)}."))

        key_values = (row["student_ref"], row["program_ref"], row["cut_id"])
        if any(not isinstance(value, str) or not value.strip() for value in key_values):
            issues.append(ValidationIssue("INVALID_GRAIN_KEY", f"{row_path}.grain_key", "Student, program, and cut references must be non-empty strings."))
        elif key_values in seen_grain_keys:
            issues.append(ValidationIssue("DUPLICATE_GRAIN_KEY", f"{row_path}.grain_key", "Duplicate student-program-cut record."))
        else:
            seen_grain_keys.add(key_values)
            if last_grain_key is not None and key_values < last_grain_key:
                issues.append(ValidationIssue("UNSORTED_SNAPSHOT", f"{row_path}.grain_key", "Snapshot rows must be ordered by student, program, and cut reference."))
            last_grain_key = key_values

        for name, minimum in (("academic_year", 2000), ("academic_period", 1)):
            value = row[name]
            if isinstance(value, bool) or not isinstance(value, int) or value < minimum:
                issues.append(ValidationIssue("INVALID_ACADEMIC_PERIOD", f"{row_path}.{name}", "Academic year/period is outside the DW contract range."))
        try:
            UUID(str(row["source_run_id"]))
        except (ValueError, TypeError, AttributeError):
            issues.append(ValidationIssue("INVALID_RUN_ID", f"{row_path}.source_run_id", "DW run reference must be a UUID."))

        population_status = row["population_status"]
        if not isinstance(population_status, str) or population_status not in _POPULATION_STATES:
            issues.append(ValidationIssue("INVALID_POPULATION_STATUS", f"{row_path}.population_status", "Population status is not recognized."))
        else:
            population_counts[population_status] += 1
            if population_status != "ELIGIBLE":
                issues.append(ValidationIssue("POPULATION_NOT_ELIGIBLE", f"{row_path}.population_status", "Out-of-scope, ambiguous, or unresolved records must be excluded from the training snapshot and reported.", blocking=True))

        outcome = row["resultado_retencion"]
        if not isinstance(outcome, str) or outcome not in _OUTCOMES:
            issues.append(ValidationIssue("INVALID_OBSERVED_OUTCOME", f"{row_path}.resultado_retencion", "Observed DW outcome is not recognized."))
        else:
            outcome_counts[outcome] += 1
            expected = {
                "NO_EVALUABLE": (None, 0, 0),
                "RETENIDO": (False, 1, 0),
                "DESERTOR": (True, 1, 1),
            }[outcome]
            if (row["es_desercion"], row["conteo_evaluable"], row["conteo_desercion"]) != expected:
                issues.append(ValidationIssue("OUTCOME_INCONSISTENCY", row_path, "Observed outcome, dropout flag, evaluability count, and dropout count disagree with DW semantics."))
            if target_field and outcome == "NO_EVALUABLE" and row.get(target_field) is not None:
                issues.append(ValidationIssue("UNEVALUABLE_TARGET_ASSIGNED", f"{row_path}.{target_field}", "NO_EVALUABLE cannot be assigned a positive or negative target class."))
            if target_field and outcome != "NO_EVALUABLE" and manifest.get("target_approved") is True and row.get(target_field) is None:
                issues.append(ValidationIssue("MISSING_TARGET_CLASS", f"{row_path}.{target_field}", "Evaluable rows require the approved target class."))
        if row["conteo_snapshot"] != 1:
            issues.append(ValidationIssue("INVALID_SNAPSHOT_COUNT", f"{row_path}.conteo_snapshot", "Each fact row must represent exactly one snapshot record."))

        for name in _NON_NEGATIVE_INTEGER_FIELDS:
            value = row.get(name)
            if value is not None and (isinstance(value, bool) or not isinstance(value, int) or value < 0):
                issues.append(ValidationIssue("INVALID_COUNT", f"{row_path}.{name}", "Expected a non-negative integer or null."))

        if target_field and target_field in row:
            target_definition = manifest.get("target_definition")
            if not isinstance(target_definition, Mapping):
                target_definition = {}
            valid_classes = tuple(
                class_name
                for class_name in (target_definition.get("positive_class"), target_definition.get("negative_class"))
                if isinstance(class_name, str)
            )
            if not isinstance(row[target_field], str) or row[target_field] not in valid_classes:
                issues.append(ValidationIssue("INVALID_TARGET_CLASS", f"{row_path}.{target_field}", "Target value is not one of the approved classes."))
            else:
                target_counts[str(row[target_field])] += 1

    declared_count = manifest.get("row_count")
    if isinstance(declared_count, int) and not isinstance(declared_count, bool) and declared_count != row_count:
        issues.append(ValidationIssue("ROW_COUNT_MISMATCH", "row_count", f"Manifest declares {declared_count} rows but {row_count} were read."))
    declared_digest = manifest.get("content_digest")
    if isinstance(declared_digest, str) and re.fullmatch(r"[a-f0-9]{64}", declared_digest):
        if digest.hexdigest() != declared_digest:
            issues.append(ValidationIssue("CONTENT_DIGEST_MISMATCH", "content_digest", "Snapshot content does not match the manifest digest."))

    if not outcome_counts.get("RETENIDO") or not outcome_counts.get("DESERTOR"):
        issues.append(ValidationIssue("INSUFFICIENT_CLASS_COVERAGE", "rows.resultado_retencion", "Both observed evaluable outcomes must be present to assess class coverage.", blocking=True))
    target_definition = manifest.get("target_definition")
    if not isinstance(target_definition, Mapping):
        target_definition = {}
    if target_field:
        for class_name in (target_definition.get("positive_class"), target_definition.get("negative_class")):
            if isinstance(class_name, str) and not target_counts.get(class_name):
                issues.append(ValidationIssue("INSUFFICIENT_TARGET_CLASS_COVERAGE", f"rows.{target_field}", "An approved target class has no observations.", blocking=True))

    has_errors = any(not issue.blocking for issue in issues)
    has_blockers = any(issue.blocking for issue in issues)
    status = "INVALID" if has_errors else "BLOCKED" if has_blockers else "READY_FOR_PREPARATION"
    return DatasetValidationReport(
        status=status,
        row_count=row_count,
        population_counts=dict(population_counts),
        outcome_counts=dict(outcome_counts),
        missing_counts=dict(missing_counts),
        issues=tuple(issues),
    )


def _validate_manifest(manifest: Mapping[str, Any], issues: list[ValidationIssue]) -> None:
    required = {
        "contract_version",
        "dataset_id",
        "snapshot_ref",
        "source",
        "grain",
        "academic_cut",
        "schema_version",
        "created_at",
        "row_count",
        "exclusions",
        "fields",
        "content_digest",
        "feature_fields",
    }
    for name in sorted(required - manifest.keys()):
        issues.append(ValidationIssue("MISSING_MANIFEST_FIELD", name, "Required manifest field is missing."))

    if manifest.get("contract_version") != "1.0":
        issues.append(ValidationIssue("UNSUPPORTED_CONTRACT_VERSION", "contract_version", "Only prepared dataset contract version 1.0 is supported."))
    try:
        UUID(str(manifest.get("dataset_id")))
    except (ValueError, TypeError, AttributeError):
        issues.append(ValidationIssue("INVALID_DATASET_ID", "dataset_id", "Dataset ID must be a UUID."))
    if not isinstance(manifest.get("snapshot_ref"), str) or not manifest["snapshot_ref"].strip():
        issues.append(ValidationIssue("INVALID_SNAPSHOT_REF", "snapshot_ref", "Snapshot reference must be a non-empty opaque reference."))
    source = manifest.get("source")
    if not isinstance(source, Mapping) or source.get("system") != "dw" or not isinstance(source.get("contract_ref"), str) or not source.get("contract_ref", "").strip():
        issues.append(ValidationIssue("INVALID_SOURCE", "source", "Source must identify a versioned DW contract."))
    elif source.get("run_id") is not None:
        try:
            UUID(str(source.get("run_id")))
        except (ValueError, TypeError, AttributeError):
            issues.append(ValidationIssue("INVALID_SOURCE_RUN_ID", "source.run_id", "Source run reference must be a UUID."))
    if manifest.get("grain") != _GRAIN:
        issues.append(ValidationIssue("UNSUPPORTED_GRAIN", "grain", f"Expected grain '{_GRAIN}'."))
    cut = manifest.get("academic_cut")
    if not isinstance(cut, Mapping) or cut.get("status") != "PROCESADO" or cut.get("closure_id") in (None, ""):
        issues.append(ValidationIssue("INVALID_ACADEMIC_CUT", "academic_cut", "The manifest must reference a processed DW closure."))
    elif not _matches_logical_type(cut.get("effective_at"), "datetime"):
        issues.append(ValidationIssue("INVALID_ACADEMIC_CUT_TIME", "academic_cut.effective_at", "The processed closure must include an ISO-8601 effective timestamp."))
    if not isinstance(manifest.get("row_count"), int) or isinstance(manifest.get("row_count"), bool) or manifest["row_count"] < 0:
        issues.append(ValidationIssue("INVALID_ROW_COUNT", "row_count", "Row count must be a non-negative integer."))
    if not isinstance(manifest.get("fields"), list):
        issues.append(ValidationIssue("INVALID_FIELDS", "fields", "Fields must be an array of field definitions."))
    else:
        names: set[str] = set()
        for index, field in enumerate(manifest["fields"]):
            path = f"fields[{index}]"
            if not isinstance(field, Mapping):
                issues.append(ValidationIssue("INVALID_FIELD_DEFINITION", path, "Field definition must be an object."))
                continue
            name = field.get("name")
            if not isinstance(name, str) or not name.strip():
                issues.append(ValidationIssue("INVALID_FIELD_NAME", f"{path}.name", "Field name must be a non-empty string."))
            elif name in names:
                issues.append(ValidationIssue("DUPLICATE_FIELD_DEFINITION", f"{path}.name", "Field is declared more than once."))
            else:
                names.add(name)
            if not isinstance(field.get("logical_type"), str) or field.get("logical_type") not in {"string", "integer", "number", "boolean", "date", "datetime", "category", "uuid"}:
                issues.append(ValidationIssue("INVALID_LOGICAL_TYPE", f"{path}.logical_type", "Logical type is not supported."))
            if not isinstance(field.get("role"), str) or field.get("role") not in {"identifier", "feature", "target", "audit"}:
                issues.append(ValidationIssue("INVALID_FIELD_ROLE", f"{path}.role", "Field role is not supported."))
            if not isinstance(field.get("nullable"), bool):
                issues.append(ValidationIssue("INVALID_NULLABILITY", f"{path}.nullable", "Nullability must be boolean."))
    if not isinstance(manifest.get("feature_fields"), list):
        issues.append(ValidationIssue("INVALID_FEATURE_FIELDS", "feature_fields", "Feature fields must be an array."))
    elif not all(isinstance(name, str) for name in manifest["feature_fields"]):
        issues.append(ValidationIssue("INVALID_FEATURE_FIELDS", "feature_fields", "Feature field names must be strings."))
    elif len(manifest["feature_fields"]) != len(set(manifest["feature_fields"])):
        issues.append(ValidationIssue("DUPLICATE_FEATURE_FIELD", "feature_fields", "Feature field names must be unique."))
    if not isinstance(manifest.get("schema_version"), str) or not manifest.get("schema_version", "").strip():
        issues.append(ValidationIssue("INVALID_SCHEMA_VERSION", "schema_version", "Schema version must be a non-empty string."))
    exclusions = manifest.get("exclusions")
    if not isinstance(exclusions, Mapping):
        issues.append(ValidationIssue("INVALID_EXCLUSIONS", "exclusions", "Exclusions must be a map of reason to count."))
    elif any(not isinstance(name, str) or isinstance(count, bool) or not isinstance(count, int) or count < 0 for name, count in exclusions.items()):
        issues.append(ValidationIssue("INVALID_EXCLUSION_COUNT", "exclusions", "Exclusion reasons must map to non-negative integer counts."))
    if manifest.get("target_field") is not None and not isinstance(manifest.get("target_field"), str):
        issues.append(ValidationIssue("INVALID_TARGET_FIELD", "target_field", "Target field must be a field name or null."))
    digest = manifest.get("content_digest")
    if not isinstance(digest, str) or not re.fullmatch(r"[a-f0-9]{64}", digest):
        issues.append(ValidationIssue("INVALID_CONTENT_DIGEST", "content_digest", "Content digest must be a lowercase SHA-256 hex value."))
    for name in ("created_at",):
        value = manifest.get(name)
        if not isinstance(value, str):
            issues.append(ValidationIssue("INVALID_TIMESTAMP", name, "Timestamp must be an ISO-8601 string."))
            continue
        try:
            parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
            if parsed.tzinfo is None:
                raise ValueError("timezone required")
        except ValueError:
            issues.append(ValidationIssue("INVALID_TIMESTAMP", name, "Timestamp must be an ISO-8601 string."))


def _canonical_json_value(value: Any) -> str:
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    if isinstance(value, Decimal):
        return format(value.normalize(), "f")
    if isinstance(value, UUID):
        return str(value)
    raise TypeError(f"Unsupported value type: {type(value).__name__}")


def _matches_logical_type(value: Any, logical_type: Any) -> bool:
    if logical_type in {"string", "category"}:
        return isinstance(value, str)
    if logical_type == "integer":
        return isinstance(value, int) and not isinstance(value, bool)
    if logical_type == "number":
        return isinstance(value, (int, float, Decimal)) and not isinstance(value, bool) and math.isfinite(value)
    if logical_type == "boolean":
        return isinstance(value, bool)
    if logical_type == "uuid":
        try:
            UUID(str(value))
            return True
        except (ValueError, TypeError, AttributeError):
            return False
    if logical_type == "date":
        try:
            if isinstance(value, datetime):
                return False
            if isinstance(value, date):
                return True
            if isinstance(value, str):
                date.fromisoformat(value)
                return True
            return False
        except (TypeError, ValueError, AttributeError):
            return False
    if logical_type == "datetime":
        if isinstance(value, datetime):
            return value.tzinfo is not None
        if not isinstance(value, str):
            return False
        try:
            return datetime.fromisoformat(value.replace("Z", "+00:00")).tzinfo is not None
        except ValueError:
            return False
    return False

