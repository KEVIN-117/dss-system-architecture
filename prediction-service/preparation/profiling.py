"""Exploratory profile (EDA) of a prepared dataset, stored as ``profile.json``.

Computed once when a dataset is extracted or uploaded, so the admin portal can
show the data before anyone trains on it. Pure Python on purpose: the API and
the worker both build profiles and neither needs pandas for it.

Only aggregates leave this module: counts, quantiles, histogram bins and
correlations. No row-level values (student references, identifiers) are
copied into the profile.
"""

from __future__ import annotations

import math
import statistics
from collections import Counter
from datetime import datetime, timezone
from typing import Any, Iterable, Mapping

PROFILE_VERSION = "dataset-profile-v1"
# Same rule as preparation.balancer.apply_smote_if_warranted: SMOTE is applied
# to the training fold only when minority/majority falls below this ratio.
SMOTE_IMBALANCE_THRESHOLD = 0.4
HISTOGRAM_BINS = 10
TOP_CATEGORIES = 10
HIGH_MISSING_RATIO = 0.3
LEAKAGE_CORRELATION = 0.95
MIN_RECOMMENDED_ROWS = 200

_NUMERIC_TYPES = {"integer", "number", "boolean"}


def _is_missing(value: Any) -> bool:
    return value is None or (isinstance(value, float) and math.isnan(value)) or value == ""


def _as_number(value: Any) -> float | None:
    if _is_missing(value):
        return None
    if isinstance(value, bool):
        return float(value)
    if isinstance(value, (int, float)):
        return float(value) if math.isfinite(float(value)) else None
    try:
        number = float(str(value))
    except ValueError:
        return None
    return number if math.isfinite(number) else None


def _quantile(sorted_values: list[float], q: float) -> float:
    if len(sorted_values) == 1:
        return sorted_values[0]
    position = (len(sorted_values) - 1) * q
    lower = math.floor(position)
    upper = math.ceil(position)
    if lower == upper:
        return sorted_values[lower]
    return sorted_values[lower] + (sorted_values[upper] - sorted_values[lower]) * (position - lower)


def _round(value: float | None, digits: int = 6) -> float | None:
    return None if value is None else round(value, digits)


def numeric_summary(values: list[float]) -> dict[str, Any]:
    """Descriptive statistics and an equal-width histogram of non-missing values."""
    if not values:
        return {"count": 0, "min": None, "max": None, "mean": None, "std": None,
                "p25": None, "median": None, "p75": None, "distinct": 0, "histogram": []}
    ordered = sorted(values)
    low, high = ordered[0], ordered[-1]
    bins = HISTOGRAM_BINS if high > low else 1
    width = (high - low) / bins if high > low else 0.0
    counts = [0] * bins
    for value in ordered:
        index = bins - 1 if width == 0 else min(int((value - low) / width), bins - 1)
        counts[index] += 1
    histogram = [
        {"start": _round(low + width * i), "end": _round(low + width * (i + 1) if width else high), "count": count}
        for i, count in enumerate(counts)
    ]
    return {
        "count": len(ordered),
        "min": _round(low),
        "max": _round(high),
        "mean": _round(statistics.fmean(ordered)),
        "std": _round(statistics.pstdev(ordered)) if len(ordered) > 1 else 0.0,
        "p25": _round(_quantile(ordered, 0.25)),
        "median": _round(_quantile(ordered, 0.5)),
        "p75": _round(_quantile(ordered, 0.75)),
        "distinct": len(set(ordered)),
        "histogram": histogram,
    }


def pearson(xs: list[float], ys: list[float]) -> float | None:
    """Pearson correlation of paired values; None when either side is constant."""
    if len(xs) < 3 or len(xs) != len(ys):
        return None
    mean_x = statistics.fmean(xs)
    mean_y = statistics.fmean(ys)
    sxx = sum((x - mean_x) ** 2 for x in xs)
    syy = sum((y - mean_y) ** 2 for y in ys)
    if sxx == 0 or syy == 0:
        return None
    sxy = sum((x - mean_x) * (y - mean_y) for x, y in zip(xs, ys))
    return sxy / math.sqrt(sxx * syy)


def _period_key(row: Mapping[str, Any]) -> str | None:
    year, period = row.get("academic_year"), row.get("academic_period")
    if year is not None and period is not None:
        return f"{year}-{period}"
    cut = row.get("cut_id")
    return None if cut is None else str(cut)


def _sorted_counts(counter: Counter[str]) -> list[dict[str, Any]]:
    return [{"key": key, "count": count} for key, count in sorted(counter.items())]


def _target_profile(manifest: Mapping[str, Any], rows: list[Mapping[str, Any]], target_field: str | None,
                    kind: str) -> tuple[dict[str, Any], list[float | None]]:
    """Target distribution plus a numeric encoding used for correlations."""
    values = [row.get(target_field) if target_field else None for row in rows]
    if kind == "regression":
        numbers = [_as_number(value) for value in values]
        present = [number for number in numbers if number is not None]
        return {"kind": "regression", "field": target_field, "missing": len(values) - len(present),
                "summary": numeric_summary(present)}, numbers
    definition = manifest.get("target_definition") or {}
    positive = definition.get("positive_class")
    negative = definition.get("negative_class")
    counts = Counter(str(value) for value in values if not _is_missing(value))
    classes = [{"class_name": name, "count": count, "ratio": _round(count / len(rows)) if rows else None}
               for name, count in sorted(counts.items())]
    minority = min(counts.values()) if counts else 0
    majority = max(counts.values()) if counts else 0
    ratio = (minority / majority) if majority else None
    encoded: list[float | None] = []
    for value in values:
        if _is_missing(value):
            encoded.append(None)
        elif positive is not None and str(value) == str(positive):
            encoded.append(1.0)
        elif negative is not None and str(value) == str(negative):
            encoded.append(0.0)
        else:
            encoded.append(None)
    return {
        "kind": "classification",
        "field": target_field,
        "positive_class": positive,
        "negative_class": negative,
        "missing": sum(1 for value in values if _is_missing(value)),
        "classes": classes,
        "imbalance_ratio": _round(ratio),
        "smote_threshold": SMOTE_IMBALANCE_THRESHOLD,
        "smote_recommended": ratio is not None and len(counts) == 2 and ratio < SMOTE_IMBALANCE_THRESHOLD,
    }, encoded


def profile_dataset(manifest: Mapping[str, Any], rows: Iterable[Mapping[str, Any]],
                    task_kind: str | None = None) -> dict[str, Any]:
    """Build the EDA profile of a prepared dataset (manifest + rows)."""
    rows = list(rows)
    target_field = manifest.get("target_field") if isinstance(manifest.get("target_field"), str) else None
    definition = manifest.get("target_definition") or {}
    kind = task_kind or ("classification" if definition.get("positive_class") is not None else "regression")
    fields = {field.get("name"): field for field in manifest.get("fields", []) if isinstance(field, Mapping)}
    feature_names = [name for name in manifest.get("feature_fields", []) if isinstance(name, str)]

    target, encoded_target = _target_profile(manifest, rows, target_field, kind)
    periods = Counter(key for key in (_period_key(row) for row in rows) if key is not None)
    programs = Counter(str(row["program_ref"]) for row in rows if row.get("program_ref") is not None)
    populations = Counter(str(row["population_status"]) for row in rows if row.get("population_status") is not None)

    features: list[dict[str, Any]] = []
    warnings: list[dict[str, Any]] = []
    for name in feature_names:
        field = fields.get(name) or {}
        logical_type = field.get("logical_type", "number")
        raw = [row.get(name) for row in rows]
        missing = sum(1 for value in raw if _is_missing(value))
        missing_ratio = missing / len(rows) if rows else 0.0
        entry: dict[str, Any] = {
            "name": name,
            "logical_type": logical_type,
            "source_field": field.get("source_field"),
            "missing": missing,
            "missing_ratio": _round(missing_ratio),
        }
        if logical_type in _NUMERIC_TYPES:
            numbers = [_as_number(value) for value in raw]
            entry["summary"] = numeric_summary([value for value in numbers if value is not None])
            pairs = [(x, y) for x, y in zip(numbers, encoded_target) if x is not None and y is not None]
            correlation = pearson([x for x, _ in pairs], [y for _, y in pairs])
            entry["target_correlation"] = _round(correlation)
            if name == definition.get("source_feature"):
                # Next-cut targets are the future value of this very column: a
                # high correlation is the expected persistence, not leakage.
                entry["label_source_feature"] = True
            elif correlation is not None and abs(correlation) >= LEAKAGE_CORRELATION:
                warnings.append({"code": "POSSIBLE_LEAKAGE", "field": name,
                                 "message": f"La variable tiene correlación {correlation:.2f} con el objetivo; "
                                            "revise que no se calcule a partir del resultado."})
            distinct = entry["summary"]["distinct"]
        else:
            counts = Counter(str(value) for value in raw if not _is_missing(value))
            entry["top_values"] = [{"value": value, "count": count} for value, count in counts.most_common(TOP_CATEGORIES)]
            distinct = len(counts)
            entry["distinct"] = distinct
        if missing_ratio >= HIGH_MISSING_RATIO:
            warnings.append({"code": "HIGH_MISSING", "field": name,
                             "message": f"{missing_ratio:.0%} de valores faltantes; se imputan con la mediana."})
        if rows and distinct <= 1:
            warnings.append({"code": "CONSTANT_FEATURE", "field": name,
                             "message": "La variable tiene un único valor y no aporta información."})
        features.append(entry)

    if len(rows) < MIN_RECOMMENDED_ROWS:
        warnings.append({"code": "FEW_ROWS", "field": None,
                         "message": f"Solo {len(rows)} filas; las métricas serán poco estables."})
    if len(periods) < 2:
        warnings.append({"code": "SINGLE_PERIOD", "field": None,
                         "message": "Un único periodo: la partición temporal no puede separar entrenamiento y prueba."})
    if target.get("kind") == "classification":
        if len(target.get("classes", [])) < 2:
            warnings.append({"code": "SINGLE_CLASS", "field": target_field,
                             "message": "El objetivo tiene una sola clase; no se puede entrenar un clasificador."})
        elif target.get("smote_recommended"):
            warnings.append({"code": "CLASS_IMBALANCE", "field": target_field,
                             "message": f"Desbalance {target['imbalance_ratio']:.2f} < {SMOTE_IMBALANCE_THRESHOLD}: "
                                        "se aplicará SMOTE solo al pliegue de entrenamiento."})

    correlations = sorted(
        ({"field": item["name"], "correlation": item["target_correlation"]}
         for item in features if item.get("target_correlation") is not None),
        key=lambda item: abs(item["correlation"]), reverse=True,
    )
    return {
        "profile_version": PROFILE_VERSION,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "dataset_id": manifest.get("dataset_id"),
        "content_digest": manifest.get("content_digest"),
        "event_code": definition.get("event_code"),
        "task_kind": kind,
        "row_count": len(rows),
        "feature_count": len(feature_names),
        "coverage": {
            "rows_by_period": _sorted_counts(periods),
            "rows_by_program": _sorted_counts(programs),
            "population_status": _sorted_counts(populations),
        },
        "target": target,
        "features": features,
        "target_correlations": correlations,
        "warnings": warnings,
    }
