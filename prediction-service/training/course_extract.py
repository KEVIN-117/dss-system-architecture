"""Extract a course-failure training snapshot from the DW (semester programs).

One row per student, course and processed semester cut, produced by
``feature_contract.course_failure_query``: every feature comes from cuts before
the scored one (plus the enrolment load of the cut). The target is the course
result of that cut: RISK when the course was failed or abandoned (no grade),
NO_RISK when it was passed. Courses without a known result are excluded.

Population (same window as program dropout): semester programs, the student's
first three academic years in the program, and no left-censored history.

Target and population definitions come from the task catalog (``ml_tasks``);
explicit ``--target-definition-ref`` / ``--population-definition-ref`` values
override the ``catalog:`` references.

Usage (read-only DW connection):
    python -m training.course_extract --program SIS --output <new dir>
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

from ml_tasks import get_task
from feature_contract import (
    COURSE_FAILURE_EVENT,
    COURSE_FAILURE_FEATURES,
    contract_reference,
    course_failure_query,
    field_definitions,
)

POSITIVE_CLASS = "RISK"
NEGATIVE_CLASS = "NO_RISK"
WINDOW_CUTS = 6  # first three academic years of a semester program

_CLOSURES_SQL = """
SELECT DISTINCT c.closure_id::text AS closure_id, c.effective_at
FROM dw.fact_cursado f
JOIN dw.dim_periodo_academico pa ON pa.periodo_academico_sk = f.periodo_academico_sk
JOIN etl_control.academic_period_closure c ON c.closure_id = pa.closure_id
  AND c.status = 'PROCESADO' AND c.processed_at IS NOT NULL AND c.effective_at <= clock_timestamp()
JOIN dw.dim_programa p ON p.programa_sk = f.programa_sk
  AND p.member_type = 'STANDARD' AND p.id_programa = %(program)s AND p.regimen = 'S'
WHERE c.periodo IN (1, 2)
ORDER BY c.effective_at, closure_id
"""

_FIELDS = [
    {"name": "student_ref", "logical_type": "string", "role": "identifier", "nullable": False},
    {"name": "program_ref", "logical_type": "string", "role": "identifier", "nullable": False},
    {"name": "course_ref", "logical_type": "string", "role": "identifier", "nullable": False},
    {"name": "cut_id", "logical_type": "string", "role": "identifier", "nullable": False},
    {"name": "academic_year", "logical_type": "integer", "role": "audit", "nullable": False},
    {"name": "academic_period", "logical_type": "integer", "role": "audit", "nullable": False},
    {"name": "source_run_id", "logical_type": "uuid", "role": "audit", "nullable": False},
    {"name": "population_status", "logical_type": "category", "role": "audit", "nullable": False},
    {"name": "course_result", "logical_type": "category", "role": "audit", "nullable": False},
]
_TARGET_FIELD = {"name": "target_class", "logical_type": "category", "role": "target", "nullable": False,
                 "available_at_cut": False}


def course_result(row: Mapping[str, Any]) -> str | None:
    """APROBADA, REPROBADA or ABANDONO from the DW flags; None when unknown."""
    if row.get("es_aprobado") is True:
        return "APROBADA"
    if row.get("es_reprobado") is True:
        return "REPROBADA"
    if row.get("es_abandono") is True:
        return "ABANDONO"
    return None


def course_ineligibility(row: Mapping[str, Any]) -> str | None:
    if row.get("program_regime") != "S":
        return "OTHER_CADENCE_PROGRAM"
    if row.get("start_t") is None or row.get("history_start_t") is None:
        return "MISSING_START"
    if int(row["start_t"]) <= int(row["history_start_t"]):
        return "LEFT_CENSORED_START"
    position = int(row["cut_year"]) * 2 + int(row["cut_period"]) - 1 - int(row["start_t"]) + 1
    if not 1 <= position <= WINDOW_CUTS:
        return "OUTSIDE_WINDOW"
    return None


def _json_value(value: Any) -> Any:
    return float(value) if isinstance(value, Decimal) else value


def build_course_failure_snapshot(
    contract_rows: Iterable[Mapping[str, Any]],
    *,
    programs: list[str],
    feature_names: list[str],
    cuts: list[Mapping[str, Any]],
    target_definition_ref: str | None = None,
    population_definition_ref: str | None = None,
    pseudonym_key: bytes | None = None,
) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    """Pure function: query rows (plus ``program_ref``) to a prepared dataset."""
    if not cuts:
        raise ValueError("At least one processed cut is required.")
    key = pseudonym_key or secrets.token_bytes(32)
    exclusions: Counter[str] = Counter()
    rows: list[dict[str, Any]] = []
    for source in contract_rows:
        reason = course_ineligibility(source)
        if reason is not None:
            exclusions[reason] += 1
            continue
        result = course_result(source)
        if result is None:
            exclusions["UNKNOWN_RESULT"] += 1
            continue
        student_ref = hashlib.sha256(key + f"{source['program_ref']}:{source['subject_ref']}".encode()).hexdigest()[:32]
        row = {
            "student_ref": student_ref,
            "program_ref": str(source["program_ref"]),
            "course_ref": str(source["course_ref"]),
            "cut_id": str(source["cut_id"]),
            "academic_year": int(source["cut_year"]),
            "academic_period": int(source["cut_period"]),
            "source_run_id": str(source["source_run_id"]),
            "population_status": "ELIGIBLE",
            "course_result": result,
            "target_class": NEGATIVE_CLASS if result == "APROBADA" else POSITIVE_CLASS,
        }
        for name in feature_names:
            row[name] = _json_value(source.get(name))
        rows.append(row)
    rows.sort(key=lambda item: (item["student_ref"], item["program_ref"], item["course_ref"], item["cut_id"]))
    latest = max(cuts, key=lambda cut: (str(cut["effective_at"]), str(cut["closure_id"])))
    task = get_task(COURSE_FAILURE_EVENT)
    target_definition_ref = target_definition_ref or task.target_definition_ref
    population_definition_ref = population_definition_ref or task.population_definition_ref
    dataset_id = str(uuid4())
    digest = hashlib.sha256("".join(json.dumps(r, sort_keys=True, separators=(",", ":")) for r in rows).encode()).hexdigest()
    manifest: dict[str, Any] = {
        "contract_version": "1.0",
        "dataset_id": dataset_id,
        "snapshot_ref": f"dw-extract:{dataset_id}",
        "source": {"system": "dw", "contract_ref": f"feature_contract:{contract_reference(COURSE_FAILURE_EVENT, feature_names)['version']}"},
        "grain": "student_course_academic_period",
        "evaluation_unit": "student_course_academic_period",
        "academic_cut": {"status": "PROCESADO", "closure_id": str(latest["closure_id"]),
                         "effective_at": _iso(latest["effective_at"])},
        "coverage": {"cadence": "SEMESTRAL", "programs": programs, "cuts": [str(cut["closure_id"]) for cut in cuts]},
        "schema_version": "prepared-dataset-v1",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "row_count": len(rows),
        "exclusions": dict(sorted(exclusions.items())),
        "fields": [*_FIELDS, *field_definitions(COURSE_FAILURE_EVENT, feature_names), _TARGET_FIELD],
        "feature_fields": list(feature_names),
        "target_field": "target_class",
        "target_definition": {
            "positive_class": POSITIVE_CLASS,
            "negative_class": NEGATIVE_CLASS,
            "event_code": COURSE_FAILURE_EVENT,
            "label_source": "dw.fact_cursado: RISK = es_reprobado or es_abandono, NO_RISK = es_aprobado",
        },
        "target_definition_ref": target_definition_ref,
        "population_definition_ref": population_definition_ref,
        "target_approved": True,
        "eligibility_approved": True,
        "fixture_only": False,
        "feature_contract": contract_reference(COURSE_FAILURE_EVENT, feature_names),
        "content_digest": digest,
    }
    return manifest, rows


def _iso(value: Any) -> str:
    if isinstance(value, datetime):
        return (value if value.tzinfo else value.replace(tzinfo=timezone.utc)).astimezone(timezone.utc).isoformat()
    return str(value)


def extract_from_dw(dsn: str, programs: list[str], feature_names: list[str],
                    row_limit: int = 1_000_000) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    """Run the contract query for every processed semester cut of the programs (read-only)."""
    import psycopg

    sql = course_failure_query(feature_names)
    rows: list[dict[str, Any]] = []
    cuts: dict[str, dict[str, Any]] = {}
    with psycopg.connect(dsn, connect_timeout=5, options="-c default_transaction_read_only=on") as connection:
        for program in programs:
            for closure_id, effective_at in connection.execute(_CLOSURES_SQL, {"program": program}).fetchall():
                cuts[closure_id] = {"closure_id": closure_id, "effective_at": effective_at}
                cursor = connection.execute(sql, {"program": program, "closure": int(closure_id), "limit": row_limit + 1})
                columns = [column.name for column in cursor.description]
                batch = [dict(zip(columns, values), program_ref=program) for values in cursor.fetchall()]
                if len(batch) > row_limit:
                    raise RuntimeError(f"Program {program} cut {closure_id} exceeds the extraction row limit.")
                rows.extend(batch)
    return rows, sorted(cuts.values(), key=lambda cut: (str(cut["effective_at"]), cut["closure_id"]))


def main() -> None:
    parser = argparse.ArgumentParser(description="Extract a course-failure training snapshot (semester programs).")
    parser.add_argument("--program", action="append", required=True, help="DW program id (repeatable).")
    parser.add_argument("--feature", action="append", choices=sorted(COURSE_FAILURE_FEATURES))
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--target-definition-ref")
    parser.add_argument("--population-definition-ref")
    parser.add_argument("--dsn", default=os.getenv("PREDICTION_DW_DATABASE_URL", ""))
    args = parser.parse_args()
    if not args.dsn:
        parser.error("Set PREDICTION_DW_DATABASE_URL or pass --dsn (read-only DW connection).")
    features = args.feature or list(COURSE_FAILURE_FEATURES)
    contract_rows, cuts = extract_from_dw(args.dsn, args.program, features)
    manifest, rows = build_course_failure_snapshot(
        contract_rows, programs=args.program, feature_names=features, cuts=cuts,
        target_definition_ref=args.target_definition_ref, population_definition_ref=args.population_definition_ref,
    )
    args.output.mkdir(parents=True, exist_ok=False)
    (args.output / "manifest.json").write_text(json.dumps(manifest, indent=2, sort_keys=True, ensure_ascii=False), encoding="utf-8")
    with (args.output / "rows.jsonl").open("w", encoding="utf-8") as handle:
        for row in rows:
            handle.write(json.dumps(row, separators=(",", ":"), ensure_ascii=False) + "\n")
    print(json.dumps({"output": str(args.output), "rows": manifest["row_count"], "exclusions": manifest["exclusions"],
                      "classes": dict(Counter(r["target_class"] for r in rows)),
                      "results": dict(Counter(r["course_result"] for r in rows))}, indent=2))


if __name__ == "__main__":
    main()
