"""Student-level next-cut targets from the program-dropout feature query (PRED-103).

``STUDENT_BACKLOG_NEXT_CUT`` (classification) and ``STUDENT_GPA_NEXT_CUT``
(regression) reuse the population, eligibility rule and point-in-time SQL of
program dropout unchanged: features describe the processed cut being scored,
and the label is read from the same student's row at the *next* cadence cut
of the program, which the extraction already queries. Rows whose next cut is
not processed yet, or where the student is absent from it, are excluded and
reported -- an absent student is a dropout question, not a backlog or GPA one.
"""

from __future__ import annotations

import hashlib
import secrets
from collections import Counter
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any, Iterable, Mapping
from uuid import uuid4

from feature_contract import (
    CADENCE_BY_REGIME,
    CADENCE_PERIODS,
    STUDENT_BACKLOG_EVENT,
    STUDENT_GPA_EVENT,
    contract_reference,
    field_definitions,
    program_dropout_ineligibility,
)
from ml_tasks import get_task

STUDENT_EVENTS = (STUDENT_BACKLOG_EVENT, STUDENT_GPA_EVENT)
POSITIVE_CLASS = "RISK"
NEGATIVE_CLASS = "NO_RISK"
_REGIME_BY_CADENCE = {cadence: regime for regime, cadence in CADENCE_BY_REGIME.items()}

_FIELDS = [
    {"name": "student_ref", "logical_type": "string", "role": "identifier", "nullable": False},
    {"name": "program_ref", "logical_type": "string", "role": "identifier", "nullable": False},
    {"name": "cut_id", "logical_type": "string", "role": "identifier", "nullable": False},
    {"name": "academic_year", "logical_type": "integer", "role": "audit", "nullable": False},
    {"name": "academic_period", "logical_type": "integer", "role": "audit", "nullable": False},
    {"name": "source_run_id", "logical_type": "uuid", "role": "audit", "nullable": False},
    {"name": "population_status", "logical_type": "category", "role": "audit", "nullable": False},
    {"name": "next_cut_id", "logical_type": "string", "role": "audit", "nullable": False},
]
_TARGET_CLASS_FIELD = {"name": "target_class", "logical_type": "category", "role": "target", "nullable": False,
                       "available_at_cut": False}
_TARGET_VALUE_FIELD = {"name": "target_value", "logical_type": "number", "role": "target", "nullable": False,
                       "available_at_cut": False}


def cut_index(year: int, period: int, cadence: str) -> int:
    """Consecutive index of a cadence cut: semesters 2/year, annual 1/year."""
    return int(year) * 2 + int(period) - 1 if cadence == "SEMESTRAL" else int(year)


def _number(value: Any) -> float | None:
    if value is None or isinstance(value, bool):
        return None
    if isinstance(value, Decimal):
        value = float(value)
    return float(value) if isinstance(value, (int, float)) else None


def _json_value(value: Any) -> Any:
    return float(value) if isinstance(value, Decimal) else value


def _iso(value: Any) -> str:
    if isinstance(value, datetime):
        return (value if value.tzinfo else value.replace(tzinfo=timezone.utc)).astimezone(timezone.utc).isoformat()
    return str(value)


def build_student_next_cut_snapshot(
    contract_rows: Iterable[Mapping[str, Any]],
    *,
    task_code: str,
    program_ref: str | list[str],
    cadence: str,
    feature_names: list[str],
    cuts: list[Mapping[str, Any]],
    target_definition_ref: str | None = None,
    population_definition_ref: str | None = None,
    pseudonym_key: bytes | None = None,
) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    """Pure function: rows of ``program_dropout_query`` (plus ``program_ref``) to a dataset."""
    if task_code not in STUDENT_EVENTS:
        raise ValueError(f"Unsupported student task {task_code}.")
    if cadence not in CADENCE_PERIODS:
        raise ValueError("cadence must be ANUAL or SEMESTRAL.")
    if not cuts:
        raise ValueError("At least one processed cut is required.")
    task = get_task(task_code)
    missing = [name for name in task.required_features if name not in feature_names]
    if missing:
        raise ValueError(f"{task_code} derives its label from {missing}; include them as features.")
    regression = task.kind == "regression"
    label_feature = task.required_features[0]
    key = pseudonym_key or secrets.token_bytes(32)
    contract_rows = [row for row in contract_rows]
    periods = CADENCE_PERIODS[cadence]

    # Every queried row of the cadence, eligible or not, can be a "next cut".
    by_position: dict[tuple[str, str, int], Mapping[str, Any]] = {}
    observed: dict[str, int] = {}
    for row in contract_rows:
        if int(row["cut_period"]) not in periods:
            continue
        index = cut_index(row["cut_year"], row["cut_period"], cadence)
        program = str(row["program_ref"])
        by_position[(program, str(row["subject_ref"]), index)] = row
        observed[program] = max(observed.get(program, index), index)

    exclusions: Counter[str] = Counter()
    rows: list[dict[str, Any]] = []
    for source in contract_rows:
        if int(source["cut_period"]) not in periods:
            exclusions["OTHER_CADENCE_CUT"] += 1
            continue
        if source.get("program_regime") != _REGIME_BY_CADENCE[cadence]:
            exclusions["OTHER_CADENCE_PROGRAM"] += 1
            continue
        reason = program_dropout_ineligibility(source)
        if reason is not None:
            exclusions[reason] += 1
            continue
        program = str(source["program_ref"])
        index = cut_index(source["cut_year"], source["cut_period"], cadence)
        if index + 1 > observed[program]:
            exclusions["NEXT_CUT_NOT_OBSERVED"] += 1
            continue
        following = by_position.get((program, str(source["subject_ref"]), index + 1))
        if following is None:
            exclusions["ABSENT_NEXT_CUT"] += 1
            continue
        next_value = _number(following.get(label_feature))
        if next_value is None:
            exclusions["NEXT_CUT_VALUE_UNKNOWN"] += 1
            continue
        if not regression:
            current_value = _number(source.get(label_feature))
            if current_value is None:
                exclusions["CURRENT_CUT_VALUE_UNKNOWN"] += 1
                continue
        student_ref = hashlib.sha256(key + f"{program}:{source['subject_ref']}".encode()).hexdigest()[:32]
        row: dict[str, Any] = {
            "student_ref": student_ref,
            "program_ref": program,
            "cut_id": str(source["cut_id"]),
            "academic_year": int(source["cut_year"]),
            "academic_period": int(source["cut_period"]),
            "source_run_id": str(source["source_run_id"]),
            "population_status": "ELIGIBLE",
            "next_cut_id": str(following["cut_id"]),
        }
        for name in feature_names:
            row[name] = _json_value(source.get(name))
        if regression:
            row["target_value"] = next_value
        else:
            row["target_class"] = POSITIVE_CLASS if next_value > current_value else NEGATIVE_CLASS
        rows.append(row)
    rows.sort(key=lambda item: (item["student_ref"], item["program_ref"], item["cut_id"]))

    from dataset_contract import compute_snapshot_digest

    latest = max(cuts, key=lambda cut: (str(cut["effective_at"]), str(cut["closure_id"])))
    dataset_id = str(uuid4())
    programs = [program_ref] if isinstance(program_ref, str) else list(program_ref)
    if regression:
        target_definition: dict[str, Any] = {
            "kind": "regression",
            "event_code": task_code,
            "unit": task.target_unit,
            "source_feature": label_feature,
            "label_source": f"dw.fact_retencion_desercion.{label_feature} at the next {cadence.lower()} cut",
        }
    else:
        target_definition = {
            "positive_class": POSITIVE_CLASS,
            "negative_class": NEGATIVE_CLASS,
            "event_code": task_code,
            "source_feature": label_feature,
            "label_source": f"RISK when dw.fact_retencion_desercion.{label_feature} increases at the next "
                            f"{cadence.lower()} cut",
        }
    manifest: dict[str, Any] = {
        "contract_version": "1.0",
        "dataset_id": dataset_id,
        "snapshot_ref": f"dw-extract:{dataset_id}",
        "source": {"system": "dw", "contract_ref": f"feature_contract:{contract_reference(task_code, feature_names)['version']}"},
        "grain": "student_program_academic_cut",
        "evaluation_unit": "student_program_academic_cut",
        "academic_cut": {"status": "PROCESADO", "closure_id": str(latest["closure_id"]),
                         "effective_at": _iso(latest["effective_at"])},
        "coverage": {"cadence": cadence, "programs": programs, "cuts": [str(cut["closure_id"]) for cut in cuts]},
        "schema_version": "prepared-dataset-v1",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "row_count": len(rows),
        "exclusions": dict(sorted(exclusions.items())),
        "fields": [*_FIELDS, *field_definitions(task_code, feature_names),
                   _TARGET_VALUE_FIELD if regression else _TARGET_CLASS_FIELD],
        "feature_fields": list(feature_names),
        "target_field": task.target_field,
        "target_definition": target_definition,
        "target_definition_ref": target_definition_ref or task.target_definition_ref,
        "population_definition_ref": population_definition_ref or task.population_definition_ref,
        "target_approved": True,
        "eligibility_approved": True,
        "fixture_only": False,
        "feature_contract": contract_reference(task_code, feature_names),
        "content_digest": compute_snapshot_digest(rows),
    }
    return manifest, rows
