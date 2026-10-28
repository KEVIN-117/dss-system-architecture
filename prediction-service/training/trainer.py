"""Fold-isolated tuning and final fitting for Random Forest and XGBoost."""

from __future__ import annotations

import itertools
import logging
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
from sklearn.metrics import (
    accuracy_score,
    average_precision_score,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
)
from sklearn.model_selection import StratifiedGroupKFold
from threadpoolctl import threadpool_limits
from xgboost import XGBClassifier

from preparation.balancer import BalanceReport, _class_distribution, apply_smote_if_warranted
from preparation.pipeline import PreparedPartition, build_preprocessing_pipeline

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
    import sklearn
    import xgboost

    return {
        "python": sys.version.split()[0],
        "scikit_learn": sklearn.__version__,
        "xgboost": xgboost.__version__,
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


def _metrics(y_true: pd.Series, y_pred: np.ndarray, probabilities: np.ndarray | None) -> dict[str, Any]:
    roc_auc = pr_auc = None
    if probabilities is not None and y_true.nunique() > 1:
        roc_auc = float(roc_auc_score(y_true, probabilities))
        pr_auc = float(average_precision_score(y_true, probabilities))
    return {
        "accuracy": float(accuracy_score(y_true, y_pred)),
        "recall": float(recall_score(y_true, y_pred, zero_division=0)),
        "precision": float(precision_score(y_true, y_pred, zero_division=0)),
        "f1_score": float(f1_score(y_true, y_pred, zero_division=0)),
        "roc_auc": roc_auc,
        "pr_auc": pr_auc,
        "confusion_matrix": confusion_matrix(y_true, y_pred, labels=[0, 1]).tolist(),
        "support": {str(label): int(count) for label, count in y_true.value_counts().items()},
        "test_row_count": len(y_true),
    }


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
            cv_results.append({
                "parameters": candidate,
                "mean_recall": float(np.mean(recall_scores)),
                "std_recall": float(np.std(recall_scores)),
                "mean_f1": float(np.mean(f1_scores)),
                "folds": fold_balance_reports,
            })

        best = max(cv_results, key=lambda item: (item["mean_recall"], item["mean_f1"]))
        best_params = best["parameters"]

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
        y_pred = model.predict(x_test_final)
        metrics = _metrics(y_test, y_pred, _probability(model, x_test_final))

    balance_report = {
        **final_balance.__dict__,
        "scope": "outer_train_refit",
        "cv_fold_reports": [entry["folds"] for entry in cv_results],
    }
    duration = time.perf_counter() - start
    dep_versions = get_dependency_versions()
    model_id = str(uuid4())
    version = f"{algorithm}-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}-{seed}"
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
    training_config = {
        "algorithm": algorithm,
        "seed": seed,
        "hyperparameters": best_params,
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
        feature_names=transformed_names,
        dependency_lock=dep_versions,
        duration_seconds=duration,
    )
