"""Fold-isolated tuning and final fitting for Random Forest and XGBoost."""

from __future__ import annotations

import itertools
import logging
import math
import sys
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

import numpy as np
import pandas as pd
from imblearn.over_sampling import SMOTE, SMOTENC
from joblib import parallel_backend
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import f1_score, recall_score
from sklearn.model_selection import StratifiedGroupKFold
from threadpoolctl import threadpool_limits
from xgboost import XGBClassifier

from ml_tasks import UnknownTask, get_task
from preparation.balancer import BalanceReport, _class_distribution, apply_smote_if_warranted
from preparation.pipeline import PreparedPartition, build_preprocessing_pipeline
from evaluation.metrics import classification_metrics

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class TrainingResult:
    model: Any
    preprocessing_pipeline: Any
    manifest: dict[str, Any]
    metrics: dict[str, Any]
    training_config: dict[str, Any]
    balance_report: dict[str, Any]
    feature_names: list[str]
    dependency_lock: dict[str, str]
    duration_seconds: float


def get_dependency_versions() -> dict[str, str]:
    import imblearn
    import joblib
    import sklearn
    import xgboost

    return {
        "python": sys.version.split()[0],
        "scikit_learn": sklearn.__version__,
        "xgboost": xgboost.__version__,
        "joblib": joblib.__version__,
        "imbalanced_learn": imblearn.__version__,
        "pandas": pd.__version__,
        "numpy": np.__version__,
    }


def _encode_targets(partition: PreparedPartition) -> tuple[pd.Series, pd.Series, dict[str, Any]]:
    target_meta = partition.partition_metadata.get("target_definition") or {}
    positive = target_meta.get("positive_class", "RISK")
    negative = target_meta.get("negative_class", "NO_RISK")
    event_code = target_meta.get("event_code", "NEXT_CLOSURE_DROPOUT")
    if set(partition.y_train.unique()).issubset({0, 1}):
        y_train = partition.y_train.astype(int)
        y_test = partition.y_test.astype(int)
    else:
        mapping = {negative: 0, positive: 1}
        y_train = partition.y_train.map(mapping)
        y_test = partition.y_test.map(mapping)
        if y_train.isna().any() or y_test.isna().any():
            raise ValueError("Dataset contains target classes not declared in target_definition.")
        y_train = y_train.astype(int)
        y_test = y_test.astype(int)
    if y_train.nunique() != 2:
        raise ValueError("Training partition must contain both target classes.")
    return y_train, y_test, {
        "positive_class": positive,
        "negative_class": negative,
        "event_code": event_code,
    }


def _candidate_grid(algorithm: str, config: dict[str, Any]) -> list[dict[str, Any]]:
    if algorithm == "random_forest":
        default = {
            "n_estimators": [100, 200],
            "max_depth": [None, 10],
            "min_samples_split": [2],
        }
    else:
        default = {
            "n_estimators": [100, 200],
            "max_depth": [3, 6],
            "learning_rate": [0.1],
        }
    user_grid = config.get("search_space")
    if user_grid is not None:
        if not isinstance(user_grid, dict) or not user_grid:
            raise ValueError("search_space must be a non-empty object of parameter lists.")
        default.update(user_grid)
    for name, value in config.get("hyperparameters", {}).items():
        default[name] = [value]
    if any(not isinstance(values, list) or not values for values in default.values()):
        raise ValueError("Each search_space parameter must have a non-empty list of candidate values.")
    keys = list(default)
    return [dict(zip(keys, values)) for values in itertools.product(*(default[key] for key in keys))]


def _estimator(algorithm: str, params: dict[str, Any], seed: int, cpu_limit: int):
    common = {**params, "random_state": seed, "n_jobs": cpu_limit}
    if algorithm == "random_forest":
        common.setdefault("class_weight", "balanced")
        return RandomForestClassifier(**common)
    return XGBClassifier(eval_metric="logloss", **common)


def _transformer(partition: PreparedPartition):
    return build_preprocessing_pipeline(partition.feature_names, partition.categorical_features)


def _balance(
    x: pd.DataFrame,
    y: pd.Series,
    partition: PreparedPartition,
    seed: int,
) -> tuple[pd.DataFrame, pd.Series, BalanceReport]:
    if not partition.apply_balancing:
        return x, y, BalanceReport(
            original_distribution=_class_distribution(y), balanced_distribution=None,
            technique=None, reason_if_skipped="Balancing disabled by caller.",
            k_neighbors_used=None, applied_to="fold_train_only",
        )
    numeric_count = len(partition.feature_names) - len(partition.categorical_features)
    categorical_indices = list(range(numeric_count, len(partition.feature_names)))
    return apply_smote_if_warranted(
        x, y,
        categorical_indices=categorical_indices or None,
        imbalance_threshold=partition.imbalance_threshold,
        seed=seed,
    )


def _fold_count(y: pd.Series, groups: pd.Series, requested: int) -> int:
    class_counts = y.value_counts()
    groups_per_class = [groups.loc[y == label].nunique() for label in class_counts.index]
    return min(requested, int(class_counts.min()), *(int(value) for value in groups_per_class))


def _validated_decision_policy(config: dict[str, Any]) -> dict[str, Any] | None:
    """Error-cost policy, or an alert-rate policy (share of rows flagged).

    An alert-rate policy (``alert_rate`` in (0, 1)) sets the threshold so that
    that share of validation rows is flagged; it models a fixed intervention
    capacity. No external DSA approval is required; ``policy_ref`` is an
    optional label kept for traceability.
    """
    policy = config.get("decision_policy")
    if policy is None:
        return None
    if not isinstance(policy, dict):
        raise ValueError("decision_policy must be an object.")
    if "alert_rate" in policy:
        rate = policy["alert_rate"]
        if isinstance(rate, bool) or not isinstance(rate, (int, float)) or not 0 < float(rate) < 1:
            raise ValueError("decision_policy.alert_rate must be a number between 0 and 1.")
        return {**policy, "kind": "alert_rate", "alert_rate": float(rate)}
    if "policy_ref" in policy and not (isinstance(policy["policy_ref"], str) and policy["policy_ref"].strip()):
        raise ValueError("decision_policy.policy_ref must be a non-empty string when given.")
    costs = {}
    for name in ("false_negative_cost", "false_positive_cost"):
        value = policy.get(name)
        if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value) or value < 0:
            raise ValueError(f"decision_policy.{name} must be a finite non-negative number.")
        costs[name] = float(value)
    if not any(costs.values()):
        raise ValueError("At least one decision error cost must be greater than zero.")
    return {**policy, **costs, "kind": "cost"}


def _select_validation_threshold(y_true: list[int], probabilities: list[float], policy: dict[str, Any]) -> tuple[float, dict[str, float]]:
    truth = np.asarray(y_true, dtype=int)
    scores = np.asarray(probabilities, dtype=float)
    if policy.get("kind") == "alert_rate":
        # Smallest threshold that flags at most alert_rate of the rows.
        ordered = np.sort(scores)[::-1]
        flagged = max(1, int(np.floor(policy["alert_rate"] * len(ordered))))
        threshold = float(np.nextafter(ordered[flagged], np.inf)) if flagged < len(ordered) else float(ordered[-1])
        prediction = (scores >= threshold).astype(int)
        return threshold, {
            "validation_cost": None,
            "false_negatives": int(((truth == 1) & (prediction == 0)).sum()),
            "false_positives": int(((truth == 0) & (prediction == 1)).sum()),
            "validation_alert_rate": float(prediction.mean()),
        }
def _threshold_confusion_stats(
    truth: np.ndarray,
    scores: np.ndarray,
) -> tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
    """Vectorized confusion-matrix stats for every unique candidate threshold in O(N log N)."""
    candidates = np.unique(np.concatenate((np.array([0.0, 1.0], dtype=float), scores)))
    order = np.argsort(-scores, kind="mergesort")
    sorted_scores = scores[order]
    sorted_truth = truth[order]
    cum_tp = np.concatenate(([0], np.cumsum(sorted_truth, dtype=np.int64)))
    cum_fp = np.concatenate(([0], np.cumsum(1 - sorted_truth, dtype=np.int64)))
    counts = np.searchsorted(-sorted_scores, -candidates, side="right")
    tp = cum_tp[counts]
    fp = cum_fp[counts]
    total_positives = int(truth.sum())
    fn = total_positives - tp
    recall = tp / total_positives if total_positives > 0 else np.zeros_like(tp, dtype=float)
    denom = 2 * tp + fp + fn
    f1 = np.where(denom > 0, (2.0 * tp) / denom, 0.0)
    return candidates, fn, fp, recall, f1


def _select_validation_threshold(y_true: list[int], probabilities: list[float], policy: dict[str, Any]) -> tuple[float, dict[str, float]]:
    truth = np.asarray(y_true, dtype=int)
    scores = np.asarray(probabilities, dtype=float)
    if policy.get("kind") == "alert_rate":
        # Smallest threshold that flags at most alert_rate of the rows.
        ordered = np.sort(scores)[::-1]
        flagged = max(1, int(np.floor(policy["alert_rate"] * len(ordered))))
        threshold = float(np.nextafter(ordered[flagged], np.inf)) if flagged < len(ordered) else float(ordered[-1])
        prediction = (scores >= threshold).astype(int)
        return threshold, {
            "validation_cost": None,
            "false_negatives": int(((truth == 1) & (prediction == 0)).sum()),
            "false_positives": int(((truth == 0) & (prediction == 1)).sum()),
            "validation_alert_rate": float(prediction.mean()),
        }
    candidates, fn, fp, recall, f1 = _threshold_confusion_stats(truth, scores)
    cost = policy["false_negative_cost"] * fn + policy["false_positive_cost"] * fp
    best = int(np.lexsort((candidates, -f1, -recall, cost))[0])
    return float(candidates[best]), {
        "validation_cost": float(cost[best]),
        "false_negatives": int(fn[best]),
        "false_positives": int(fp[best]),
    }


def _threshold_origin(policy: dict[str, Any] | None) -> str:
    if policy is None:
        return "validation_recall_then_f1"
    if policy["kind"] == "alert_rate":
        return "validation_alert_rate_policy"
    return "validation_cost_policy"


def _select_validation_threshold_by_metrics(y_true: list[int], probabilities: list[float]) -> float:
    """Descriptive-only threshold rule for synthetic evidence: recall, then F1."""
    truth = np.asarray(y_true, dtype=int)
    scores = np.asarray(probabilities, dtype=float)
    candidates, _, _, recall, f1 = _threshold_confusion_stats(truth, scores)
    best = int(np.lexsort((-candidates, -f1, -recall))[0])
    return float(candidates[best])


def _metrics(
    y_true: pd.Series,
    y_pred: np.ndarray,
    probabilities: np.ndarray | None,
    target_meta: dict[str, Any],
) -> dict[str, Any]:
    metrics = classification_metrics(
        y_true, y_pred, probabilities, negative_label=0, positive_label=1,
        class_names={0: target_meta["negative_class"], 1: target_meta["positive_class"]},
    )
    metrics["class_definition"] = target_meta
    metrics["positive_class"] = target_meta["positive_class"]
    metrics["negative_class"] = target_meta["negative_class"]
    metrics["positive_class_code"] = 1
    metrics["negative_class_code"] = 0
    return metrics


def _probability(model: Any, x: pd.DataFrame) -> np.ndarray | None:
    if not hasattr(model, "predict_proba"):
        return None
    return model.predict_proba(x)[:, 1]


def train_model(
    partition: PreparedPartition,
    algorithm: str,
    config: dict[str, Any] | None = None,
    seed: int = 42,
    cpu_limit: int = 1,
    memory_limit_mb: int | None = None,
    cv_splits: int = 5,
) -> TrainingResult:
    """Tune on grouped folds from outer train; inspect outer test once at end.

    Every fold creates and fits its own imputer/encoder and applies SMOTE only
    to that fold's training rows. The outer temporal holdout is never used to
    choose hyperparameters, samplers, or preprocessing choices.
    """
    start = time.perf_counter()
    config = config or {}
    algorithm = algorithm.lower().strip()
    if algorithm not in {"random_forest", "xgboost"}:
        raise ValueError("algorithm must be 'random_forest' or 'xgboost'.")
    if cpu_limit < 1 or cv_splits < 2:
        raise ValueError("cpu_limit must be >= 1 and cv_splits must be >= 2.")

    y_train, y_test, target_meta = _encode_targets(partition)
    decision_policy = _validated_decision_policy(config)
    groups = partition.train_groups.reset_index(drop=True)
    x_train = partition.X_train.reset_index(drop=True)
    y_train = y_train.reset_index(drop=True)
    x_test = partition.X_test.reset_index(drop=True)
    y_test = y_test.reset_index(drop=True)
    if len(groups) != len(y_train):
        raise ValueError("Student groups must align with training rows.")

    folds = _fold_count(y_train, groups, cv_splits)
    if folds < 2:
        raise ValueError("Not enough class-bearing student groups for cross-validation (need at least 2).")
    splitter = StratifiedGroupKFold(n_splits=folds, shuffle=True, random_state=seed)
    candidates = _candidate_grid(algorithm, config)
    cv_results: list[dict[str, Any]] = []

    # Celery's prefork worker marks its child process daemonic. Use joblib
    # threads (not nested loky processes) so the estimator honors the CPU cap.
    with threadpool_limits(limits=cpu_limit), parallel_backend("threading", n_jobs=cpu_limit):
        for candidate in candidates:
            recall_scores: list[float] = []
            f1_scores: list[float] = []
            validation_truth: list[int] = []
            validation_probabilities: list[float] = []
            fold_balance_reports: list[dict[str, Any]] = []
            for fold_number, (fit_idx, valid_idx) in enumerate(
                splitter.split(x_train, y_train, groups), start=1,
            ):
                preprocessor = _transformer(partition)
                x_fit_raw, x_valid_raw = x_train.iloc[fit_idx], x_train.iloc[valid_idx]
                y_fit, y_valid = y_train.iloc[fit_idx], y_train.iloc[valid_idx]
                x_fit_values = preprocessor.fit_transform(x_fit_raw)
                x_valid_values = preprocessor.transform(x_valid_raw)
                transformed_names = list(preprocessor.get_feature_names_out())
                x_fit = pd.DataFrame(x_fit_values, columns=transformed_names)
                x_valid = pd.DataFrame(x_valid_values, columns=transformed_names)
                x_fit, y_fit, balance = _balance(x_fit, y_fit, partition, seed + fold_number)
                model = _estimator(algorithm, candidate, seed, cpu_limit)
                model.fit(x_fit, y_fit)
                prediction = model.predict(x_valid)
                recall_scores.append(float(recall_score(y_valid, prediction, zero_division=0)))
                f1_scores.append(float(f1_score(y_valid, prediction, zero_division=0)))
                validation_truth.extend(int(value) for value in y_valid.tolist())
                validation_probabilities.extend(float(value) for value in model.predict_proba(x_valid)[:, 1])
                fit_groups = set(groups.iloc[fit_idx])
                validation_groups = set(groups.iloc[valid_idx])
                if fit_groups & validation_groups:
                    raise RuntimeError("Student identity leaked across a cross-validation fold.")
                fold_balance_reports.append({
                    "fold": fold_number,
                    "train_students": int(groups.iloc[fit_idx].nunique()),
                    "validation_students": int(groups.iloc[valid_idx].nunique()),
                    "student_group_overlap": False,
                    "validation_distribution": _class_distribution(y_valid),
                    "validation_rows": len(y_valid),
                    "balance": balance.__dict__,
                })
            validation_threshold = 0.5
            validation_cost = None
            if decision_policy is not None:
                validation_threshold, cost_summary = _select_validation_threshold(
                    validation_truth, validation_probabilities, decision_policy,
                )
                validation_cost = cost_summary["validation_cost"]
            else:
                validation_threshold = _select_validation_threshold_by_metrics(
                    validation_truth, validation_probabilities,
                )
            validation_predictions = (np.asarray(validation_probabilities) >= validation_threshold).astype(int)
            validation_recall = float(recall_score(validation_truth, validation_predictions, zero_division=0))
            validation_f1 = float(f1_score(validation_truth, validation_predictions, zero_division=0))
            cv_results.append({
                "parameters": candidate,
                "mean_recall": validation_recall,
                "mean_f1": validation_f1,
                "fold_mean_recall_at_0_5": float(np.mean(recall_scores)),
                "fold_mean_f1_at_0_5": float(np.mean(f1_scores)),
                "validation_prediction_unit": "out_of_fold_rows",
                "validation_threshold": validation_threshold,
                "validation_cost": validation_cost,
                "folds": fold_balance_reports,
            })

        if decision_policy is None or decision_policy["kind"] == "alert_rate":
            # At a fixed alert rate, recall at that rate ranks the candidates.
            best = max(cv_results, key=lambda item: (item["mean_recall"], item["mean_f1"]))
        else:
            best = min(cv_results, key=lambda item: (item["validation_cost"], -item["mean_recall"], -item["mean_f1"]))
        best_params = best["parameters"]
        decision_threshold = best["validation_threshold"]

        # Refit only on the complete outer training partition.
        final_preprocessor = _transformer(partition)
        train_values = final_preprocessor.fit_transform(x_train)
        test_values = final_preprocessor.transform(x_test)
        transformed_names = list(final_preprocessor.get_feature_names_out())
        x_train_final = pd.DataFrame(train_values, columns=transformed_names)
        x_test_final = pd.DataFrame(test_values, columns=transformed_names)
        x_train_final, y_train_final, final_balance = _balance(
            x_train_final, y_train, partition, seed,
        )
        model = _estimator(algorithm, best_params, seed, cpu_limit)
        model.fit(x_train_final, y_train_final)
        test_probabilities = _probability(model, x_test_final)
        y_pred = (test_probabilities >= decision_threshold).astype(int) if test_probabilities is not None else model.predict(x_test_final)
        metrics = _metrics(y_test, y_pred, test_probabilities, target_meta)
        metrics["decision_threshold"] = decision_threshold
        metrics["threshold_origin"] = _threshold_origin(decision_policy)
        if test_probabilities is not None:
            metrics["holdout_alert_rate"] = float(np.mean(y_pred))

    balance_report = {
        **final_balance.__dict__,
        "scope": "outer_train_refit",
        "cv_fold_reports": [entry["folds"] for entry in cv_results],
    }
    duration = time.perf_counter() - start
    dep_versions = get_dependency_versions()
    model_id = str(uuid4())
    version = f"{algorithm}-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}-{seed}"
    serving_scope = None
    cadence = partition.partition_metadata.get("cadence")
    try:
        task = get_task(target_meta["event_code"])
    except UnknownTask:
        task = None
    if task is not None and task.servable and cadence in task.cadences:
        serving_scope = {
            "event_type": task.serving_event_type,
            "cadence": cadence,
            "evaluation_unit": partition.partition_metadata.get("evaluation_unit"),
        }
    manifest = {
        "contract_version": "1.0",
        "model_id": model_id,
        "version": version,
        "algorithm": algorithm,
        "dataset_id": partition.manifest_ref,
        "input_schema_version": "prepared-dataset-v1",
        "classes": target_meta,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "evaluation_ref": f"eval-{model_id[:8]}",
        "lifecycle_state": "CANDIDATE",
        "artifact_digest": "",
        "artifact_uri": "",
        "preprocessing_ref": "",
        "dependency_lock_ref": "",
        "training_config_ref": "",
    }
    if serving_scope is not None:
        manifest["serving_scope"] = serving_scope
    if test_probabilities is not None:
        # Serving must classify with the same validation-selected threshold that
        # produced the reported metrics; the value is bound into the bundle digest.
        manifest["decision_threshold"] = float(decision_threshold)
    training_config = {
        "algorithm": algorithm,
        "seed": seed,
        "hyperparameters": best_params,
        "evaluation_protocol": {
            "partition_id": partition.partition_metadata.get("partition_id"),
            "dataset_digest": partition.partition_metadata.get("dataset_digest"),
            "target_definition_ref": partition.partition_metadata.get("target_definition_ref"),
            "split": partition.partition_metadata,
            "selection_metric": "validation_cost_then_oof_recall_then_f1" if decision_policy and decision_policy["kind"] == "cost" else "validation_oof_recall_then_f1",
            "decision_threshold": decision_threshold,
            "threshold_origin": _threshold_origin(decision_policy),
            "decision_policy": decision_policy,
            "institutional_decision": "EVIDENCIA_INSUFICIENTE",
        },
        "cpu_limit": cpu_limit,
        "memory_limit_mb": memory_limit_mb,
        "tuning": {
            "method": "StratifiedGroupKFold",
            "scoring": "recall",
            "n_splits": folds,
            "candidate_count": len(cv_results),
            "results": cv_results,
            "best_mean_recall": best["mean_recall"],
            "best_mean_f1": best["mean_f1"],
            "best_validation_cost": best["validation_cost"],
            "outer_test_used_for_selection": False,
        },
        "user_config": config,
    }
    return TrainingResult(
        model=model,
        preprocessing_pipeline=final_preprocessor,
        manifest=manifest,
        metrics=metrics,
        training_config=training_config,
        balance_report=balance_report,
        # Serving accepts this raw schema and applies the saved transformer.
        feature_names=partition.feature_names,
        dependency_lock=dep_versions,
        duration_seconds=duration,
    )


def train_for_partition(partition: PreparedPartition, algorithm: str, **kwargs: Any) -> TrainingResult:
    """Classifier or regressor training, by the task kind of the prepared partition."""
    if partition.partition_metadata.get("task_kind") == "regression":
        from training.regression_trainer import train_regression_model
        return train_regression_model(partition, algorithm, **kwargs)
    return train_model(partition, algorithm, **kwargs)
