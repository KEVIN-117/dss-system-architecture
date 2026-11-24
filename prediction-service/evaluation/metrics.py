"""Explicit, class-aware classification metrics with undefined reasons."""

from __future__ import annotations

from typing import Any

import numpy as np
from sklearn.metrics import accuracy_score, average_precision_score, confusion_matrix, roc_auc_score


def classification_metrics(
    y_true: Any,
    y_pred: Any,
    probabilities: np.ndarray | None = None,
    *,
    negative_label: int = 0,
    positive_label: int = 1,
    class_names: dict[int, str] | None = None,
) -> dict[str, Any]:
    """Report per-class scores without silently converting undefined values to zero."""
    true = np.asarray(y_true)
    pred = np.asarray(y_pred)
    labels = [negative_label, positive_label]
    matrix = confusion_matrix(true, pred, labels=labels)
    by_class: dict[str, Any] = {}
    for index, label in enumerate(labels):
        tp = int(matrix[index, index])
        support = int(matrix[index, :].sum())
        predicted = int(matrix[:, index].sum())
        precision = tp / predicted if predicted else None
        recall = tp / support if support else None
        false_positive = predicted - tp
        false_negative = support - tp
        f1_denominator = 2 * tp + false_positive + false_negative
        f1 = (2 * tp / f1_denominator) if f1_denominator else None
        reasons = {}
        if precision is None:
            reasons["precision"] = "No samples were predicted for this class."
        if recall is None:
            reasons["recall"] = "No true samples of this class are present in the evaluation set."
        if f1 is None:
            reasons["f1_score"] = "F1 is undefined because the class has no true or predicted observations."
        by_class[str(label)] = {
            "class_name": (class_names or {}).get(label),
            "precision": precision, "recall": recall, "f1_score": f1,
            "support": support, "undefined_reasons": reasons,
        }

    macro = {}
    for key in ("precision", "recall", "f1_score"):
        values = [entry[key] for entry in by_class.values() if entry[key] is not None]
        macro[key] = float(np.mean(values)) if values else None
    pos = by_class[str(positive_label)]
    roc_auc = pr_auc = None
    auc_reasons: dict[str, str] = {}
    if probabilities is None:
        auc_reasons = {"roc_auc": "Estimator did not provide probabilities.", "pr_auc": "Estimator did not provide probabilities."}
    elif len(np.unique(true)) < 2:
        auc_reasons = {"roc_auc": "Evaluation set contains only one true class.", "pr_auc": "Evaluation set contains only one true class."}
    else:
        scores = np.asarray(probabilities)
        roc_auc = float(roc_auc_score(true == positive_label, scores))
        pr_auc = float(average_precision_score(true == positive_label, scores))
    return {
        "positive_class": positive_label,
        "negative_class": negative_label,
        "averaging": "per_class plus macro over defined classes",
        "per_class": by_class,
        "macro_average": macro,
        "accuracy": float(accuracy_score(true, pred)),
        "recall": pos["recall"],
        "precision": pos["precision"],
        "f1_score": pos["f1_score"],
        "roc_auc": roc_auc,
        "pr_auc": pr_auc,
        "auc_undefined_reasons": auc_reasons,
        "confusion_matrix": {
            "labels": labels,
            "label_names": [(class_names or {}).get(label, str(label)) for label in labels],
            "rows": "actual",
            "columns": "predicted",
            "values": matrix.tolist(),
        },
        "support": {label: values["support"] for label, values in by_class.items()},
        "test_row_count": int(len(true)),
    }


def regression_metrics(y_true: Any, y_pred: Any, buckets: int = 4) -> dict[str, Any]:
    """MAE, RMSE, R², MAPE and residuals by bucket of the observed value (PRED-103).

    MAPE skips observations equal to zero (undefined), reporting how many were
    skipped. Buckets are quantiles of the observed target so error can be read
    across low and high values; ``bias`` is the mean of prediction - observed.
    """
    true = np.asarray(y_true, dtype=float)
    pred = np.asarray(y_pred, dtype=float)
    if true.shape != pred.shape or true.size == 0:
        raise ValueError("Regression metrics need equal, non-empty observed and predicted arrays.")
    residuals = pred - true
    mae = float(np.mean(np.abs(residuals)))
    rmse = float(np.sqrt(np.mean(residuals ** 2)))
    variance = float(np.sum((true - true.mean()) ** 2))
    r2 = None if variance == 0 else float(1 - np.sum(residuals ** 2) / variance)
    nonzero = true != 0
    mape = float(np.mean(np.abs(residuals[nonzero] / true[nonzero]))) if nonzero.any() else None
    edges = np.unique(np.quantile(true, np.linspace(0, 1, buckets + 1)))
    by_bucket = []
    for index in range(max(1, len(edges) - 1)):
        low = edges[index] if len(edges) > 1 else true.min()
        high = edges[index + 1] if len(edges) > 1 else true.max()
        last = index == len(edges) - 2 or len(edges) <= 1
        mask = (true >= low) & ((true <= high) if last else (true < high))
        if not mask.any():
            continue
        bucket_residuals = residuals[mask]
        by_bucket.append({
            "observed_min": float(low), "observed_max": float(high), "count": int(mask.sum()),
            "mae": float(np.mean(np.abs(bucket_residuals))), "bias": float(np.mean(bucket_residuals)),
        })
    return {
        "mae": mae,
        "rmse": rmse,
        "r2": r2,
        "r2_undefined_reason": None if r2 is not None else "observed target has zero variance",
        "mape": mape,
        "mape_skipped_zero_observations": int((~nonzero).sum()),
        "bias": float(np.mean(residuals)),
        "observed_mean": float(true.mean()),
        "residuals_by_bucket": by_bucket,
        "test_row_count": int(true.size),
    }
