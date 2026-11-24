"""Run a FORECAST job: extract series, select and fit a model, persist runs (PRED-104)."""

from __future__ import annotations

from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from typing import Any, Callable
from uuid import uuid4

from forecasting.backtest import select_model
from forecasting.models import SeriesPoint, fit
from forecasting.series_extract import SERIES_CODES, extract_series

MAX_HORIZON = 8
MAX_PROGRAMS = 200


class ForecastError(ValueError):
    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code


class ForecastCancelled(RuntimeError):
    """The operator cancelled the job; runs already saved stay, the rest are skipped."""


@dataclass(frozen=True)
class ForecastParams:
    cadence: str
    series_codes: tuple[str, ...] = SERIES_CODES
    programs: tuple[str, ...] = ()
    horizon: int = 4

    def to_json(self) -> dict[str, Any]:
        data = asdict(self)
        data["series_codes"] = list(self.series_codes)
        data["programs"] = list(self.programs)
        return data


@dataclass
class ForecastSummary:
    runs: int = 0
    skipped: dict[str, str] = field(default_factory=dict)
    run_ids: list[str] = field(default_factory=list)


def validate_forecast_params(raw: dict[str, Any]) -> ForecastParams:
    cadence = str(raw.get("cadence") or "")
    if cadence not in ("ANUAL", "SEMESTRAL"):
        raise ForecastError("INVALID_CADENCE", "cadence must be ANUAL or SEMESTRAL.")
    series = tuple(dict.fromkeys(str(code) for code in (raw.get("series_codes") or SERIES_CODES)))
    unknown = sorted(set(series) - set(SERIES_CODES))
    if unknown or not series:
        raise ForecastError("UNKNOWN_SERIES", f"Unknown series {unknown}; use {list(SERIES_CODES)}.")
    programs = tuple(dict.fromkeys(str(p).strip() for p in (raw.get("programs") or []) if str(p).strip()))
    if len(programs) > MAX_PROGRAMS or any(len(p) > 16 for p in programs):
        raise ForecastError("INVALID_PROGRAMS", f"At most {MAX_PROGRAMS} program ids of up to 16 characters.")
    horizon = raw.get("horizon", 4)
    if isinstance(horizon, bool) or not isinstance(horizon, int) or not 1 <= horizon <= MAX_HORIZON:
        raise ForecastError("INVALID_HORIZON", f"horizon must be an integer between 1 and {MAX_HORIZON}.")
    return ForecastParams(cadence, series, programs, horizon)


def forecast_series(series_code: str, program_ref: str, points: list[SeriesPoint], params: ForecastParams,
                    job_id: str, requested_by: str) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    """Select, fit and project one program series; returns the run and its points."""
    kind, selection, backtests = select_model(points, params.cadence, params.horizon)
    model = fit(kind, points, params.cadence)
    projection = model.forecast(params.horizon)
    run = {
        "run_id": str(uuid4()),
        "job_id": job_id,
        "series_code": series_code,
        "program_ref": program_ref,
        "cadence": params.cadence,
        "horizon": params.horizon,
        "model_kind": kind,
        "model": {**model.to_json(), "slope_per_cut": model.slope},
        "selection": selection,
        "backtest": {"selected": next(b for b in backtests if b["model"] == kind), "candidates": backtests},
        "history_points": len(points),
        "created_by": requested_by,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    rows = [{"year": p.year, "period": p.period, "point_kind": "HISTORY", "horizon": None, "value": p.value}
            for p in points]
    for point in projection:
        interval = point["interval"] or {}
        rows.append({
            "year": point["year"], "period": point["period"], "point_kind": "FORECAST", "horizon": point["horizon"],
            "value": point["value"],
            "lower_80": (interval.get("0.8") or {}).get("lower"), "upper_80": (interval.get("0.8") or {}).get("upper"),
            "lower_95": (interval.get("0.95") or {}).get("lower"), "upper_95": (interval.get("0.95") or {}).get("upper"),
        })
    return run, rows


def run_forecast_job(params: ForecastParams, *, dsn: str, store: Any, job_id: str, requested_by: str,
                     should_cancel: Callable[[], bool] = lambda: False,
                     extract: Callable[..., dict[str, list[SeriesPoint]]] | None = None,
                     programs: list[str] | None = None) -> ForecastSummary:
    """Forecast every requested series for every program of the cadence."""
    extract = extract or extract_series
    if not dsn:
        raise ForecastError("DW_NOT_CONFIGURED", "PREDICTION_DW_DATABASE_URL is not configured for the worker.")
    if programs is None:
        if params.programs:
            programs = list(params.programs)
        else:
            from training.dataset_extraction import list_programs
            programs = list_programs(dsn, params.cadence)
    if not programs:
        raise ForecastError("NO_PROGRAMS", f"The DW has no {params.cadence} programs to forecast.")
    summary = ForecastSummary()
    pending: list[tuple[dict[str, Any], list[dict[str, Any]]]] = []
    for series_code in params.series_codes:
        if should_cancel():
            raise ForecastCancelled(job_id)
        by_program = extract(dsn, series_code, programs, params.cadence)
        for program in programs:
            points = by_program.get(program)
            if not points:
                summary.skipped[f"{series_code}|{program}"] = "NO_OBSERVATIONS"
                continue
            try:
                pending.append(forecast_series(series_code, program, points, params, job_id, requested_by))
            except ValueError:
                summary.skipped[f"{series_code}|{program}"] = "SERIES_TOO_SHORT"
    if not pending:
        raise ForecastError("NO_FORECASTABLE_SERIES", "No requested program series has enough processed cuts.")
    if should_cancel():
        raise ForecastCancelled(job_id)
    # All runs of the job become visible together, or none do.
    store.save_runs(pending)
    summary.runs = len(pending)
    summary.run_ids = [run["run_id"] for run, _ in pending]
    return summary
