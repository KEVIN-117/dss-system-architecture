"""Linear forecasting models for short academic count series (PRED-104).

Series are tiny (one point per processed cadence cut and program), so the
models are deliberately simple and fully transparent:

* ``linear_trend``     -- least squares on [1, t, season dummy].
* ``linear_trend_lag`` -- adds the previous value (lag 1); multi-step forecasts
  are recursive, feeding each prediction back as the next lag.
* ``seasonal_naive``   -- the value of the same season one cycle earlier (the
  last value for annual series). Used when the series is too short for a
  regression, and always reported as such.

Prediction intervals come from empirical quantiles of the in-sample residuals
of the fitted model, widened by sqrt(h) for horizon h. Counts never go below
zero, so point forecasts and lower bounds are clamped at 0.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import Any

import numpy as np

MODEL_KINDS = ("linear_trend", "linear_trend_lag", "seasonal_naive")
INTERVAL_LEVELS = {"0.8": (0.1, 0.9), "0.95": (0.025, 0.975)}
RIDGE_PENALTY = 1e-6


@dataclass(frozen=True)
class SeriesPoint:
    year: int
    period: int
    value: float


def season_length(cadence: str) -> int:
    return 2 if cadence == "SEMESTRAL" else 1


def _season(period: int, cadence: str) -> float:
    return 1.0 if cadence == "SEMESTRAL" and int(period) == 2 else 0.0


def next_period(year: int, period: int, cadence: str) -> tuple[int, int]:
    if cadence == "SEMESTRAL":
        return (year, 2) if period == 1 else (year + 1, 1)
    return year + 1, 1


def minimum_points(kind: str, cadence: str) -> int:
    """Smallest series a model may be fitted on (parameters + 2 residual dof)."""
    seasonal = 1 if cadence == "SEMESTRAL" else 0
    if kind == "linear_trend":
        return 2 + seasonal + 2
    if kind == "linear_trend_lag":
        return 3 + seasonal + 2 + 1
    return season_length(cadence) + 1


@dataclass
class FittedModel:
    kind: str
    cadence: str
    coefficients: list[float] = field(default_factory=list)
    residuals: list[float] = field(default_factory=list)
    history: list[SeriesPoint] = field(default_factory=list)

    def to_json(self) -> dict[str, Any]:
        return {"kind": self.kind, "cadence": self.cadence, "coefficients": self.coefficients,
                "residual_count": len(self.residuals),
                "residual_std": float(np.std(self.residuals)) if self.residuals else None}

    @property
    def slope(self) -> float | None:
        """Change per cadence step from the trend term (regression models only)."""
        return self.coefficients[1] if self.kind != "seasonal_naive" and len(self.coefficients) > 1 else None

    def forecast(self, horizon: int) -> list[dict[str, Any]]:
        """Point forecasts and intervals for the next ``horizon`` cadence steps."""
        if horizon < 1:
            raise ValueError("horizon must be >= 1")
        n = len(self.history)
        year, period = self.history[-1].year, self.history[-1].period
        values = [p.value for p in self.history]
        out: list[dict[str, Any]] = []
        for h in range(1, horizon + 1):
            year, period = next_period(year, period, self.cadence)
            t = n - 1 + h
            if self.kind == "seasonal_naive":
                s = season_length(self.cadence)
                value = values[-s] if len(values) >= s else values[-1]
            else:
                row = _row(t, _season(period, self.cadence), values[-1] if self.kind == "linear_trend_lag" else None,
                           self.cadence)
                value = float(np.dot(row, self.coefficients))
            values.append(value)
            out.append({"year": year, "period": period, "horizon": h, "value": max(0.0, value),
                        "interval": self._interval(max(0.0, value), h)})
        return out

    def _interval(self, value: float, h: int) -> dict[str, dict[str, float]] | None:
        if len(self.residuals) < 2:
            return None
        residuals = np.asarray(self.residuals, dtype=float)
        scale = math.sqrt(h)
        # residual = observed - fitted, so the observed lies in value + quantiles.
        return {level: {"lower": max(0.0, value + scale * float(np.quantile(residuals, low))),
                        "upper": max(0.0, value + scale * float(np.quantile(residuals, high)))}
                for level, (low, high) in INTERVAL_LEVELS.items()}


def _row(t: int, season: float, lag: float | None, cadence: str) -> np.ndarray:
    row = [1.0, float(t)]
    if cadence == "SEMESTRAL":
        row.append(season)
    if lag is not None:
        row.append(float(lag))
    return np.asarray(row, dtype=float)


def fit(kind: str, history: list[SeriesPoint], cadence: str) -> FittedModel:
    """Fit one model on an ordered, gap-free series of cadence cuts."""
    if kind not in MODEL_KINDS:
        raise ValueError(f"Unknown forecast model {kind}.")
    if len(history) < minimum_points(kind, cadence):
        raise ValueError(f"{kind} needs at least {minimum_points(kind, cadence)} points.")
    values = [float(p.value) for p in history]
    if kind == "seasonal_naive":
        s = season_length(cadence)
        residuals = [values[i] - values[i - s] for i in range(s, len(values))]
        return FittedModel(kind, cadence, [], residuals, list(history))
    start = 1 if kind == "linear_trend_lag" else 0
    rows = [_row(i, _season(history[i].period, cadence), values[i - 1] if start else None, cadence)
            for i in range(start, len(values))]
    x = np.vstack(rows)
    y = np.asarray(values[start:], dtype=float)
    penalty = RIDGE_PENALTY * np.eye(x.shape[1])
    penalty[0, 0] = 0.0
    coefficients = np.linalg.solve(x.T @ x + penalty, x.T @ y)
    residuals = (y - x @ coefficients).tolist()
    return FittedModel(kind, cadence, [float(c) for c in coefficients], residuals, list(history))


def candidate_kinds(length: int, cadence: str) -> list[str]:
    return [kind for kind in MODEL_KINDS if length >= minimum_points(kind, cadence)]
