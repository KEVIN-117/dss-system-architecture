"""Dataset extraction as a reusable service (PRED-102).

The worker runs this for ``EXTRACT_DATASET`` jobs launched from the admin
portal; the ``training.dw_extract`` / ``training.course_extract`` CLIs remain
thin wrappers around the same builders. The DW is only read (read-only
transaction), rows leave pseudonymised, and a dataset becomes visible only
after it passed the prepared-dataset contract and its profile was written.
"""

from __future__ import annotations

import json
import os
import shutil
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable
from uuid import uuid4

from ml_tasks import get_task

PROGRAM_DROPOUT = "PROGRAM_DROPOUT_NEXT_EXPECTED_CLOSURE"
COURSE_FAILURE = "COURSE_FAILURE"
EXTRACTABLE_TASKS = (PROGRAM_DROPOUT, COURSE_FAILURE)
MAX_PROGRAMS = 200
MAX_HORIZON_YEARS = 10

_PROGRAMS_BY_REGIME_SQL = """
SELECT id_programa FROM dw.dim_programa
WHERE member_type = 'STANDARD' AND regimen = %(regime)s
ORDER BY id_programa
"""
_REGIME_BY_CADENCE = {"ANUAL": "A", "SEMESTRAL": "S"}


class ExtractionError(ValueError):
    """Invalid extraction request or a dataset that fails the data contract."""

    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code


class ExtractionCancelled(RuntimeError):
    """The operator cancelled the job; partial output was discarded."""


@dataclass(frozen=True)
class ExtractionParams:
    task_code: str
    cadence: str
    programs: tuple[str, ...] = ()
    horizon_years: int | None = None
    features: tuple[str, ...] = ()

    def to_json(self) -> dict[str, Any]:
        data = asdict(self)
        data["programs"] = list(self.programs)
        data["features"] = list(self.features)
        return data


@dataclass
class ExtractionResult:
    dataset_id: str
    dataset_ref: str
    row_count: int
    status: str
    exclusions: dict[str, int] = field(default_factory=dict)
    warnings: list[str] = field(default_factory=list)


def _feature_catalog(task_code: str) -> dict[str, Any]:
    from feature_contract import COURSE_FAILURE_FEATURES, PROGRAM_DROPOUT_FEATURES
    return PROGRAM_DROPOUT_FEATURES if task_code == PROGRAM_DROPOUT else COURSE_FAILURE_FEATURES


def validate_params(raw: dict[str, Any]) -> ExtractionParams:
    """Normalize and validate an extraction request against the task catalog."""
    task_code = str(raw.get("task_code") or "")
    try:
        task = get_task(task_code)
    except KeyError as exc:
        raise ExtractionError("UNKNOWN_TASK", f"Unknown prediction task '{task_code}'.") from exc
    if not task.extractable or task_code not in EXTRACTABLE_TASKS:
        raise ExtractionError("TASK_NOT_EXTRACTABLE", f"Task {task_code} has no DW extraction yet.")
    cadence = str(raw.get("cadence") or "")
    if cadence not in task.cadences:
        raise ExtractionError("INVALID_CADENCE", f"Task {task_code} supports cadences {list(task.cadences)}.")
    programs = tuple(dict.fromkeys(str(p).strip() for p in (raw.get("programs") or []) if str(p).strip()))
    if len(programs) > MAX_PROGRAMS or any(len(p) > 16 for p in programs):
        raise ExtractionError("INVALID_PROGRAMS", f"At most {MAX_PROGRAMS} program ids of up to 16 characters.")
    horizon = raw.get("horizon_years")
    if horizon is not None:
        if task_code != PROGRAM_DROPOUT:
            raise ExtractionError("INVALID_HORIZON", "horizon_years only applies to program dropout.")
        if isinstance(horizon, bool) or not isinstance(horizon, int) or not 1 <= horizon <= MAX_HORIZON_YEARS:
            raise ExtractionError("INVALID_HORIZON", f"horizon_years must be an integer between 1 and {MAX_HORIZON_YEARS}.")
    catalog = _feature_catalog(task_code)
    features = tuple(dict.fromkeys(str(f) for f in (raw.get("features") or [])))
    unknown = sorted(set(features) - set(catalog))
    if unknown:
        raise ExtractionError("UNKNOWN_FEATURES", f"Unknown features for {task_code}: {unknown}.")
    return ExtractionParams(task_code, cadence, programs, horizon, features)


def list_programs(dsn: str, cadence: str) -> list[str]:
    """Every standard DW program of the cadence regime (read-only)."""
    import psycopg

    with psycopg.connect(dsn, connect_timeout=5, options="-c default_transaction_read_only=on") as connection:
        rows = connection.execute(_PROGRAMS_BY_REGIME_SQL, {"regime": _REGIME_BY_CADENCE[cadence]}).fetchall()
    return [str(row[0]) for row in rows]


def build_snapshot(params: ExtractionParams, dsn: str,
                   extract: Callable[..., tuple[list[dict[str, Any]], list[dict[str, Any]]]] | None = None,
                   programs: list[str] | None = None) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    """Query the DW with the serving feature contract and build the prepared dataset."""
    programs = list(programs if programs is not None else (params.programs or list_programs(dsn, params.cadence)))
    if not programs:
        raise ExtractionError("NO_PROGRAMS", f"The DW has no {params.cadence} programs to extract.")
    features = list(params.features or _feature_catalog(params.task_code))
    if params.task_code == PROGRAM_DROPOUT:
        from training import dw_extract
        contract_rows, cuts = (extract or dw_extract.extract_from_dw)(dsn, programs, params.cadence, features)
        if not cuts:
            raise ExtractionError("NO_PROCESSED_CUTS", "The selected programs have no processed cuts in the DW.")
        return dw_extract.build_program_dropout_snapshot(
            contract_rows, program_ref=programs, cadence=params.cadence, feature_names=features, cuts=cuts,
            dropout_horizon_years=params.horizon_years,
        )
    from training import course_extract
    contract_rows, cuts = (extract or course_extract.extract_from_dw)(dsn, programs, features)
    if not cuts:
        raise ExtractionError("NO_PROCESSED_CUTS", "The selected programs have no processed cuts in the DW.")
    return course_extract.build_course_failure_snapshot(
        contract_rows, programs=programs, feature_names=features, cuts=cuts,
    )


def publish_dataset(output_root: Path, dataset_id: str, manifest: dict[str, Any], rows: list[dict[str, Any]],
                    provenance: dict[str, Any], should_cancel: Callable[[], bool] = lambda: False) -> Path:
    """Validate, profile and atomically publish ``output_root/dataset_id``.

    The dataset directory appears only once complete; a cancellation or a
    failure leaves nothing but a removed staging directory behind.
    """
    from dataset_contract import validate_prepared_dataset
    from preparation.profiling import profile_dataset

    report = validate_prepared_dataset(manifest, rows)
    if not report.ready_for_preparation:
        codes = sorted({issue.code for issue in report.issues})
        raise ExtractionError("DATASET_CONTRACT_VIOLATION",
                              f"Extracted dataset is {report.status}: {', '.join(codes[:8])}.")
    task_kind = None
    try:
        task_kind = get_task(str((manifest.get("target_definition") or {}).get("event_code"))).kind
    except KeyError:
        pass
    profile = profile_dataset(manifest, rows, task_kind)
    output_root.mkdir(parents=True, exist_ok=True)
    target = output_root / dataset_id
    if target.exists():
        raise ExtractionError("DATASET_ALREADY_EXISTS", f"Dataset {dataset_id} already exists.")
    staging = output_root / f".{dataset_id}.tmp-{uuid4().hex}"
    staging.mkdir()
    try:
        (staging / "manifest.json").write_text(
            json.dumps(manifest, indent=2, sort_keys=True, ensure_ascii=False), encoding="utf-8")
        with (staging / "rows.jsonl").open("w", encoding="utf-8") as handle:
            for row in rows:
                handle.write(json.dumps(row, separators=(",", ":"), ensure_ascii=False) + "\n")
        (staging / "profile.json").write_text(json.dumps(profile, indent=2, ensure_ascii=False), encoding="utf-8")
        (staging / "extraction.json").write_text(json.dumps(provenance, indent=2, sort_keys=True), encoding="utf-8")
        if should_cancel():
            raise ExtractionCancelled(dataset_id)
        os.rename(staging, target)
    finally:
        if staging.exists():
            shutil.rmtree(staging, ignore_errors=True)
    return target


def run_extraction(params: ExtractionParams, *, dsn: str, output_root: Path, dataset_id: str, job_id: str,
                   requested_by: str, should_cancel: Callable[[], bool] = lambda: False,
                   extract: Callable[..., Any] | None = None, programs: list[str] | None = None) -> ExtractionResult:
    """Extract, validate, profile and publish one dataset for an EXTRACT_DATASET job."""
    if not dsn:
        raise ExtractionError("DW_NOT_CONFIGURED", "PREDICTION_DW_DATABASE_URL is not configured for the worker.")
    if should_cancel():
        raise ExtractionCancelled(dataset_id)
    manifest, rows = build_snapshot(params, dsn, extract=extract, programs=programs)
    if should_cancel():
        raise ExtractionCancelled(dataset_id)
    # The job reserved this id when it was accepted, so its result_ref is
    # known before the dataset exists. Rows and digest are unaffected.
    manifest["dataset_id"] = dataset_id
    manifest["snapshot_ref"] = f"dw-extract:{dataset_id}"
    manifest["extraction"] = {"job_id": job_id, "requested_by": requested_by, "params": params.to_json()}
    provenance = {
        "job_id": job_id,
        "requested_by": requested_by,
        "extracted_at": datetime.now(timezone.utc).isoformat(),
        "params": params.to_json(),
        "row_count": len(rows),
        "exclusions": manifest.get("exclusions", {}),
    }
    publish_dataset(output_root, dataset_id, manifest, rows, provenance, should_cancel)
    return ExtractionResult(
        dataset_id=dataset_id,
        dataset_ref=f"custom:{dataset_id}",
        row_count=len(rows),
        status="READY_FOR_PREPARATION",
        exclusions=dict(manifest.get("exclusions", {})),
    )
