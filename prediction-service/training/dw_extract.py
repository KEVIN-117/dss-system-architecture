"""Extract a program-dropout training snapshot from the DW with the serving query.

Rows are produced by ``feature_contract.program_dropout_query`` and filtered by
``feature_contract.program_dropout_ineligibility`` -- the exact SQL and rule the
Prediction API uses to score a student. The resulting prepared dataset carries
the feature contract digest, which training copies into the model bundle and
serving verifies, so a model can only be served with features computed exactly
as they were during training.

Target and population approval are never asserted by this tool: the manifest is
marked DSA-approved only when the operator passes ``--dsa-approved`` together
with both approved definition references. Without them the dataset is valid but
BLOCKED by the prepared-dataset contract.

Usage (read-only DW connection):
    python -m training.dw_extract --program P01 --cadence SEMESTRAL --output /app/custom-datasets/<uuid>
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import secrets
from collections import Counter
from datetime import datetime, timezone
from decimal import Decimal
from pathlib import Path
from typing import Any, Iterable, Mapping
from uuid import uuid4

from dataset_contract import compute_snapshot_digest, validate_prepared_dataset
from feature_contract import (
    PROGRAM_DROPOUT_EVENT,
    PROGRAM_DROPOUT_FEATURES,
    contract_reference,
    field_definitions,
    program_dropout_ineligibility,
    program_dropout_query,
)

POSITIVE_CLASS = "RISK"
NEGATIVE_CLASS = "NO_RISK"
_CADENCE_PERIODS = {"ANUAL": (3,), "SEMESTRAL": (1, 2)}
_EVALUABLE = {"RETENIDO", "DESERTOR"}

_CLOSURES_SQL = """
SELECT DISTINCT c.closure_id::text AS closure_id, c.effective_at
FROM dw.fact_retencion_desercion f
JOIN etl_control.academic_period_closure c ON c.closure_id = f.closure_id
  AND c.status = 'PROCESADO' AND c.processed_at IS NOT NULL AND c.effective_at <= clock_timestamp()
JOIN dw.dim_programa p ON p.programa_sk = f.programa_sk
  AND p.member_type = 'STANDARD' AND p.id_programa = %(program)s
WHERE c.periodo = ANY(%(periods)s)
ORDER BY c.effective_at, closure_id
"""

_IDENTIFIER_AND_AUDIT_FIELDS = [
    {"name": "student_ref", "logical_type": "string", "role": "identifier", "nullable": False},
    {"name": "program_ref", "logical_type": "string", "role": "identifier", "nullable": False},
    {"name": "cut_id", "logical_type": "string", "role": "identifier", "nullable": False},
    {"name": "academic_year", "logical_type": "integer", "role": "audit", "nullable": False},
    {"name": "academic_period", "logical_type": "integer", "role": "audit", "nullable": False},
    {"name": "source_run_id", "logical_type": "uuid", "role": "audit", "nullable": False},
    {"name": "population_status", "logical_type": "category", "role": "audit", "nullable": False},
    {"name": "resultado_retencion", "logical_type": "category", "role": "audit", "nullable": False},
    {"name": "es_desercion", "logical_type": "boolean", "role": "audit", "nullable": True},
    {"name": "conteo_snapshot", "logical_type": "integer", "role": "audit", "nullable": False},
    {"name": "conteo_evaluable", "logical_type": "integer", "role": "audit", "nullable": False},
    {"name": "conteo_desercion", "logical_type": "integer", "role": "audit", "nullable": False},
]
_TARGET_FIELD = {"name": "target_class", "logical_type": "category", "role": "target", "nullable": False,
                 "available_at_cut": False}


def _json_value(value: Any) -> Any:
    return float(value) if isinstance(value, Decimal) else value


def build_program_dropout_snapshot(
    contract_rows: Iterable[Mapping[str, Any]],
    *,
    program_ref: str | list[str],
    cadence: str,
    feature_names: list[str],
    cuts: list[Mapping[str, Any]],
    target_definition_ref: str | None = None,
    population_definition_ref: str | None = None,
    dsa_approved: bool = False,
    pseudonym_key: bytes | None = None,
) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    """Turn rows returned by ``program_dropout_query`` into a prepared dataset.

    ``contract_rows`` must include ``program_ref`` (the queried program) in
    addition to the query columns. Pure function: no I/O, deterministic for a
    given ``pseudonym_key``.
    """
    if cadence not in _CADENCE_PERIODS:
        raise ValueError("cadence must be ANUAL or SEMESTRAL.")
    if not cuts:
        raise ValueError("At least one processed cut is required.")
    key = pseudonym_key or secrets.token_bytes(32)
    exclusions: Counter[str] = Counter()
    rows: list[dict[str, Any]] = []
    for source in contract_rows:
        if int(source["cut_period"]) not in _CADENCE_PERIODS[cadence]:
            exclusions["OTHER_CADENCE_CUT"] += 1
            continue
        reason = program_dropout_ineligibility(source)
        if reason is not None:
            exclusions[reason] += 1
            continue
        outcome = source.get("resultado_retencion")
        if outcome not in _EVALUABLE:
            exclusions["NO_EVALUABLE_OUTCOME"] += 1
            continue
        # Keyed pseudonym: stable per student within this snapshot, unlinkable
        # to DW identifiers without the (discarded) key.
        student_ref = hashlib.sha256(key + f"{source['program_ref']}:{source['subject_ref']}".encode()).hexdigest()[:32]
        row = {
            "student_ref": student_ref,
            "program_ref": str(source["program_ref"]),
            "cut_id": str(source["cut_id"]),
            "academic_year": int(source["cut_year"]),
            "academic_period": int(source["cut_period"]),
            "source_run_id": str(source["source_run_id"]),
            "population_status": "ELIGIBLE",
            "resultado_retencion": outcome,
            "es_desercion": source.get("es_desercion"),
            "conteo_snapshot": source.get("conteo_snapshot"),
            "conteo_evaluable": source.get("conteo_evaluable"),
            "conteo_desercion": source.get("conteo_desercion"),
            "target_class": POSITIVE_CLASS if outcome == "DESERTOR" else NEGATIVE_CLASS,
        }
        for name in feature_names:
            row[name] = _json_value(source.get(name))
        rows.append(row)
    rows.sort(key=lambda item: (item["student_ref"], item["program_ref"], item["cut_id"]))

    latest = max(cuts, key=lambda cut: (str(cut["effective_at"]), str(cut["closure_id"])))
    approved = bool(dsa_approved and target_definition_ref and population_definition_ref)
    dataset_id = str(uuid4())
    programs = [program_ref] if isinstance(program_ref, str) else list(program_ref)
    manifest: dict[str, Any] = {
        "contract_version": "1.0",
        "dataset_id": dataset_id,
        "snapshot_ref": f"dw-extract:{dataset_id}",
        "source": {"system": "dw", "contract_ref": f"feature_contract:{contract_reference(PROGRAM_DROPOUT_EVENT, feature_names)['version']}"},
        "grain": "student_program_academic_cut",
        "evaluation_unit": "student_program_academic_cut",
        "academic_cut": {
            "status": "PROCESADO",
            "closure_id": str(latest["closure_id"]),
            "effective_at": _iso(latest["effective_at"]),
        },
        "coverage": {"cadence": cadence, "programs": programs,
                     "cuts": [str(cut["closure_id"]) for cut in cuts]},
        "schema_version": "prepared-dataset-v1",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "row_count": len(rows),
        "exclusions": dict(sorted(exclusions.items())),
        "fields": [*_IDENTIFIER_AND_AUDIT_FIELDS, *field_definitions(PROGRAM_DROPOUT_EVENT, feature_names), _TARGET_FIELD],
        "feature_fields": list(feature_names),
        "target_field": "target_class",
        "target_definition": {
            "positive_class": POSITIVE_CLASS,
            "negative_class": NEGATIVE_CLASS,
            "event_code": PROGRAM_DROPOUT_EVENT,
            "label_source": "dw.fact_retencion_desercion.resultado_retencion",
        },
        "target_definition_ref": target_definition_ref,
        "population_definition_ref": population_definition_ref,
        "target_approved": approved,
        "eligibility_approved": approved,
        "fixture_only": False,
        "feature_contract": contract_reference(PROGRAM_DROPOUT_EVENT, feature_names),
        "content_digest": compute_snapshot_digest(rows),
    }
    return manifest, rows


def _iso(value: Any) -> str:
    if isinstance(value, datetime):
        return (value if value.tzinfo else value.replace(tzinfo=timezone.utc)).astimezone(timezone.utc).isoformat()
    return str(value)


def extract_from_dw(dsn: str, programs: list[str], cadence: str, feature_names: list[str],
                    row_limit: int = 1_000_000) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    """Run the contract query for every processed cut of the given programs (read-only)."""
    import psycopg

    sql = program_dropout_query(feature_names)
    rows: list[dict[str, Any]] = []
    cuts: dict[str, dict[str, Any]] = {}
    with psycopg.connect(dsn, connect_timeout=5, options="-c default_transaction_read_only=on") as connection:
        for program in programs:
            closures = connection.execute(_CLOSURES_SQL, {"program": program, "periods": list(_CADENCE_PERIODS[cadence])}).fetchall()
            for closure_id, effective_at in closures:
                cuts[closure_id] = {"closure_id": closure_id, "effective_at": effective_at}
                cursor = connection.execute(sql, {"program": program, "closure": int(closure_id), "subject": None, "limit": row_limit + 1})
                columns = [column.name for column in cursor.description]
                batch = [dict(zip(columns, values), program_ref=program) for values in cursor.fetchall()]
                if len(batch) > row_limit:
                    raise RuntimeError(f"Program {program} cut {closure_id} exceeds the extraction row limit.")
                rows.extend(batch)
    return rows, sorted(cuts.values(), key=lambda cut: (str(cut["effective_at"]), cut["closure_id"]))


def write_snapshot(output: Path, manifest: Mapping[str, Any], rows: list[Mapping[str, Any]]) -> None:
    output.mkdir(parents=True, exist_ok=False)
    (output / "manifest.json").write_text(json.dumps(manifest, indent=2, sort_keys=True, ensure_ascii=False), encoding="utf-8")
    with (output / "rows.jsonl").open("w", encoding="utf-8") as handle:
        for row in rows:
            handle.write(json.dumps(row, separators=(",", ":"), ensure_ascii=False) + "\n")


def main() -> None:
    parser = argparse.ArgumentParser(description="Extract a program-dropout training snapshot with the serving feature contract.")
    parser.add_argument("--program", action="append", required=True, help="DW program id (repeatable).")
    parser.add_argument("--cadence", required=True, choices=sorted(_CADENCE_PERIODS))
    parser.add_argument("--feature", action="append", choices=sorted(PROGRAM_DROPOUT_FEATURES),
                        help="Predictor to include (repeatable). Defaults to every contract feature.")
    parser.add_argument("--output", required=True, type=Path, help="New directory for manifest.json and rows.jsonl.")
    parser.add_argument("--target-definition-ref")
    parser.add_argument("--population-definition-ref")
    parser.add_argument("--dsa-approved", action="store_true",
                        help="Assert that both referenced definitions were approved by DSA.")
    parser.add_argument("--dsn", default=os.getenv("PREDICTION_DW_DATABASE_URL", ""))
    args = parser.parse_args()
    if not args.dsn:
        parser.error("Set PREDICTION_DW_DATABASE_URL or pass --dsn (read-only DW connection).")
    if args.dsa_approved and not (args.target_definition_ref and args.population_definition_ref):
        parser.error("--dsa-approved requires --target-definition-ref and --population-definition-ref.")
    features = args.feature or list(PROGRAM_DROPOUT_FEATURES)
    contract_rows, cuts = extract_from_dw(args.dsn, args.program, args.cadence, features)
    manifest, rows = build_program_dropout_snapshot(
        contract_rows, program_ref=args.program, cadence=args.cadence, feature_names=features, cuts=cuts,
        target_definition_ref=args.target_definition_ref, population_definition_ref=args.population_definition_ref,
        dsa_approved=args.dsa_approved,
    )
    write_snapshot(args.output, manifest, rows)
    report = validate_prepared_dataset(manifest, rows)
    print(json.dumps({
        "output": str(args.output), "dataset_ref": f"custom:{args.output.name}", "status": report.status,
        "rows": manifest["row_count"], "exclusions": manifest["exclusions"],
        "issues": [f"{issue.code}: {issue.path}" for issue in report.issues[:10]],
    }, indent=2))


if __name__ == "__main__":
    main()
