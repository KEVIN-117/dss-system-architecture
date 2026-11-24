"""Rolling-origin backtesting and model selection for program forecasts (PRED-104).

For every origin k (from the smallest trainable window to the end of the
series) the model is fitted on points [0, k) only and asked for the next
``horizon`` points; errors are measured on points that were never seen by that
fit. Intervals are built from that origin's own in-sample residuals, so the
reported coverage is an honest out-of-sample check, not a fitted quantity.
"""

from __future__ import annotations

import math
from typing import Any

import numpy as np

from forecasting.models import INTERVAL_LEVELS, MODEL_KINDS, SeriesPoint, candidate_kinds, fit, minimum_points

MIN_BACKTEST_ORIGINS = 2
TIE_TOLERANCE = 0.01


def backtest(kind: str, series: list[SeriesPoint], cadence: str, horizon: int) -> dict[str, Any]:
    """Out-of-sample errors of ``kind`` over every rolling origin of the series."""
    first_origin = minimum_points(kind, cadence)
    errors: list[float] = []
    actuals: list[float] = []
    covered = {level: 0 for level in INTERVAL_LEVELS}
    with_interval = 0
    by_horizon: dict[int, list[float]] = {}
    origins = 0
    for origin in range(first_origin, len(series)):
        model = fit(kind, series[:origin], cadence)
        forecasts = model.forecast(min(horizon, len(series) - origin))
        origins += 1
        for step, point in enumerate(forecasts):
            actual = float(series[origin + step].value)
            error = point["value"] - actual
            errors.append(error)
            actuals.append(actual)
            by_horizon.setdefault(point["horizon"], []).append(abs(error))
            if point["interval"] is not None:
                with_interval += 1
                for level, bounds in point["interval"].items():
                    covered[level] += int(bounds["lower"] <= actual <= bounds["upper"])
    if not errors:
        return {"model": kind, "origins": 0, "evaluated_points": 0, "mae": None, "rmse": None, "mape": None,
                "interval_coverage": None, "mae_by_horizon": {}}
    err = np.asarray(errors)
    act = np.asarray(actuals)
    nonzero = act != 0
    return {
        "model": kind,
        "origins": origins,
        "evaluated_points": int(err.size),
        "mae": float(np.mean(np.abs(err))),
        "rmse": float(math.sqrt(np.mean(err ** 2))),
        "mape": float(np.mean(np.abs(err[nonzero] / act[nonzero]))) if nonzero.any() else None,
        "bias": float(np.mean(err)),
        "interval_coverage": {level: covered[level] / with_interval for level in INTERVAL_LEVELS} if with_interval else None,
        "mae_by_horizon": {str(h): float(np.mean(v)) for h, v in sorted(by_horizon.items())},
    }


def select_model(series: list[SeriesPoint], cadence: str, horizon: int) -> tuple[str, dict[str, Any], list[dict[str, Any]]]:
    """Pick the model with the lowest backtest MAE among those the series supports.

    Returns ``(kind, selection, backtests)``. With too few origins to compare,
    the richest fittable model is kept and the selection says so; a series too
    short for any regression falls back to ``seasonal_naive``.
    """
    kinds = candidate_kinds(len(series), cadence)
    if not kinds:
        raise ValueError(f"The series has {len(series)} points; at least "
                         f"{minimum_points('seasonal_naive', cadence)} are needed for any forecast.")
    results = [backtest(kind, series, cadence, horizon) for kind in kinds]
    comparable = [r for r in results if r["origins"] >= MIN_BACKTEST_ORIGINS and r["mae"] is not None]
    if comparable:
        # Prefer the simpler model unless a richer one is clearly better (>1 %).
        best_mae = min(r["mae"] for r in comparable)
        # Absolute floor relative to the series level, so float noise on an
        # exactly linear series does not decide between models.
        floor = 1e-6 * max(1.0, float(np.mean([abs(p.value) for p in series])))
        near = [r for r in comparable if r["mae"] <= best_mae * (1 + TIE_TOLERANCE) + floor]
        kind = min(near, key=lambda r: MODEL_KINDS.index(r["model"]))["model"]
        rule = "lowest rolling-origin backtest MAE (simplest model within 1 %)"
    else:
        regression = [k for k in kinds if k != "seasonal_naive"]
        kind = "linear_trend" if "linear_trend" in regression else kinds[0]
        rule = "too few backtest origins to compare; default model for the series length"
    return kind, {"rule": rule, "selected": kind, "fallback": kind == "seasonal_naive",
                  "candidates": [r["model"] for r in results]}, results
