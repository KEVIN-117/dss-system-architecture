"""Fold-isolated tuning and final fitting for regression targets (PRED-103).

Mirrors ``training.trainer`` for numeric targets: the outer partition is the
same student-disjoint temporal holdout, candidates are tuned on ``GroupKFold``
folds by student (never resampled), each fold fits its own preprocessor, and
the outer test is only scored once after the refit. Prediction intervals come
from quantiles of the selected candidate's out-of-fold residuals, so the
reported coverage on the outer test is an honest check of them.
"""

from __future__ import annotations

import itertools
import time
from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

import numpy as np
import pandas as pd
from joblib import parallel_backend
from sklearn.ensemble import RandomForestRegressor
from sklearn.linear_model import Ridge
from sklearn.model_selection import GroupKFold
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from threadpoolctl import threadpool_limits
from xgboost import XGBRegressor

from evaluation.metrics import regression_metrics
from ml_tasks import UnknownTask, get_task
from preparation.pipeline import PreparedPartition, build_preprocessing_pipeline

REGRESSION_ALGORITHMS = ("ridge", "random_forest", "xgboost")
INTERVAL_LEVELS = {"0.8": (0.1, 0.9), "0.95": (0.025, 0.975)}

DEFAULT_GRIDS: dict[str, dict[str, list[Any]]] = {
    "ridge": {"alpha": [0.01, 0.1, 1.0, 10.0]},
    "random_forest": {"n_estimators": [100, 200], "max_depth": [None, 10], "min_samples_leaf": [1, 5]},
    "xgboost": {"n_estimators": [100, 200], "max_depth": [3, 6], "learning_rate": [0.1]},
}


def candidate_grid(algorithm: str, config: dict[str, Any]) -> list[dict[str, Any]]:
    grid = {key: list(values) for key, values in DEFAULT_GRIDS[algorithm].items()}
    user_grid = config.get("search_space")
    if user_grid is not None:
        if not isinstance(user_grid, dict) or not user_grid:
            raise ValueError("search_space must be a non-empty object of parameter lists.")
        grid.update(user_grid)
    for name, value in (config.get("hyperparameters") or {}).items():
        grid[name] = [value]
    if any(not isinstance(values, list) or not values for values in grid.values()):
        raise ValueError("Each search_space parameter must have a non-empty list of candidate values.")
    keys = list(grid)
    return [dict(zip(keys, values)) for values in itertools.product(*(grid[key] for key in keys))]


def regression_estimator(algorithm: str, params: dict[str, Any], seed: int, cpu_limit: int) -> Any:
    if algorithm == "ridge":
        # Ridge needs comparable feature scales; the scaler is part of the model
        # so serving applies it after the bundled imputer/encoder.
        return Pipeline([("scale", StandardScaler()), ("ridge", Ridge(**params))])
    if algorithm == "random_forest":
        return RandomForestRegressor(**params, random_state=seed, n_jobs=cpu_limit)
    if algorithm == "xgboost":
        return XGBRegressor(**params, random_state=seed, n_jobs=cpu_limit, objective="reg:squarederror")
    raise ValueError(f"algorithm must be one of {list(REGRESSION_ALGORITHMS)}.")


def _rmse(truth: np.ndarray, prediction: np.ndarray) -> float:
    return float(np.sqrt(np.mean((prediction - truth) ** 2)))


def _coverage(truth: np.ndarray, prediction: np.ndarray, low: float, high: float) -> float:
    return float(np.mean((truth >= prediction + low) & (truth <= prediction + high)))


def train_regression_model(
    partition: PreparedPartition,
    algorithm: str,
    config: dict[str, Any] | None = None,
    seed: int = 42,
    cpu_limit: int = 1,
    memory_limit_mb: int | None = None,
    cv_splits: int = 5,
) -> Any:
    """Tune by out-of-fold RMSE on student-grouped folds; score the outer test once."""
    from training.trainer import TrainingResult, get_dependency_versions

    start = time.perf_counter()
    config = config or {}
    algorithm = algorithm.lower().strip()
    if algorithm not in REGRESSION_ALGORITHMS:
        raise ValueError(f"algorithm must be one of {list(REGRESSION_ALGORITHMS)}.")
    if cpu_limit < 1 or cv_splits < 2:
        raise ValueError("cpu_limit must be >= 1 and cv_splits must be >= 2.")
    target_definition = dict(partition.partition_metadata.get("target_definition") or {})
    event_code = target_definition.get("event_code")
    x_train = partition.X_train.reset_index(drop=True)
    y_train = pd.to_numeric(partition.y_train, errors="raise").astype(float).reset_index(drop=True)
    x_test = partition.X_test.reset_index(drop=True)
    y_test = pd.to_numeric(partition.y_test, errors="raise").astype(float).reset_index(drop=True)
    groups = partition.train_groups.reset_index(drop=True)
    if len(groups) != len(y_train):
        raise ValueError("Student groups must align with training rows.")
    folds = min(cv_splits, int(groups.nunique()))
    if folds < 2:
        raise ValueError("Not enough student groups for cross-validation (need at least 2).")
    if y_train.nunique() < 2:
        raise ValueError("The training target has no variance.")
    splitter = GroupKFold(n_splits=folds)
    candidates = candidate_grid(algorithm, config)
    cv_results: list[dict[str, Any]] = []
    best_oof: np.ndarray | None = None

    with threadpool_limits(limits=cpu_limit), parallel_backend("threading", n_jobs=cpu_limit):
        for candidate in candidates:
            oof = np.full(len(y_train), np.nan)
            fold_rmse: list[float] = []
            fold_reports: list[dict[str, Any]] = []
            for fold_number, (fit_idx, valid_idx) in enumerate(splitter.split(x_train, y_train, groups), start=1):
                if set(groups.iloc[fit_idx]) & set(groups.iloc[valid_idx]):
                    raise RuntimeError("Student identity leaked across a cross-validation fold.")
                preprocessor = build_preprocessing_pipeline(partition.feature_names, partition.categorical_features)
                x_fit = preprocessor.fit_transform(x_train.iloc[fit_idx])
                x_valid = preprocessor.transform(x_train.iloc[valid_idx])
                names = list(preprocessor.get_feature_names_out())
                model = regression_estimator(algorithm, candidate, seed, cpu_limit)
                model.fit(pd.DataFrame(x_fit, columns=names), y_train.iloc[fit_idx])
                prediction = np.asarray(model.predict(pd.DataFrame(x_valid, columns=names)), dtype=float)
                oof[valid_idx] = prediction
                fold_rmse.append(_rmse(y_train.iloc[valid_idx].to_numpy(), prediction))
                fold_reports.append({
                    "fold": fold_number,
                    "train_students": int(groups.iloc[fit_idx].nunique()),
                    "validation_students": int(groups.iloc[valid_idx].nunique()),
                    "student_group_overlap": False,
                    "validation_rows": int(len(valid_idx)),
                    "validation_rmse": fold_rmse[-1],
                })
            truth = y_train.to_numpy()
            cv_results.append({
                "parameters": candidate,
                "mean_rmse": _rmse(truth, oof),
                "mean_mae": float(np.mean(np.abs(oof - truth))),
                "fold_mean_rmse": float(np.mean(fold_rmse)),
                "validation_prediction_unit": "out_of_fold_rows",
                "folds": fold_reports,
                "_oof": oof,
            })
        best = min(cv_results, key=lambda item: (item["mean_rmse"], item["mean_mae"]))
        best_oof = best["_oof"]
        best_params = best["parameters"]

        final_preprocessor = build_preprocessing_pipeline(partition.feature_names, partition.categorical_features)
        train_values = final_preprocessor.fit_transform(x_train)
        test_values = final_preprocessor.transform(x_test)
        names = list(final_preprocessor.get_feature_names_out())
        model = regression_estimator(algorithm, best_params, seed, cpu_limit)
        model.fit(pd.DataFrame(train_values, columns=names), y_train)
        test_prediction = np.asarray(model.predict(pd.DataFrame(test_values, columns=names)), dtype=float)

    residuals = best_oof - y_train.to_numpy()
    # residual = prediction - observed, so observed lies in [pred - q_hi, pred - q_lo].
    intervals = {
        level: [float(-np.quantile(residuals, high)), float(-np.quantile(residuals, low))]
        for level, (low, high) in INTERVAL_LEVELS.items()
    }
    metrics = regression_metrics(y_test.to_numpy(), test_prediction)
    metrics["interval_coverage"] = {
        level: _coverage(y_test.to_numpy(), test_prediction, bounds[0], bounds[1])
        for level, bounds in intervals.items()
    }
    metrics["task_kind"] = "regression"
    metrics["event_code"] = event_code

    for item in cv_results:
        item.pop("_oof", None)
    duration = time.perf_counter() - start
    model_id = str(uuid4())
    version = f"{algorithm}-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}-{seed}"
    cadence = partition.partition_metadata.get("cadence")
    try:
        task = get_task(str(event_code))
    except UnknownTask:
        task = None
    manifest: dict[str, Any] = {
        "contract_version": "1.0",
        "model_id": model_id,
        "version": version,
        "algorithm": algorithm,
        "dataset_id": partition.manifest_ref,
        "input_schema_version": "prepared-dataset-v1",
        # Registry, serving and the portal key every bundle by classes.event_code.
        "classes": {"event_code": event_code},
        "task_kind": "regression",
        "target_definition": {
            "event_code": event_code,
            "target_field": partition.partition_metadata.get("target_field"),
            "unit": target_definition.get("unit") or (task.target_unit if task else None),
        },
        "prediction_interval": {
            "method": "out_of_fold_residual_quantiles",
            "offsets": intervals,
            "meaning": "observed value lies in [prediction + low, prediction + high] at the given level",
        },
        "created_at": datetime.now(timezone.utc).isoformat(),
        "evaluation_ref": f"eval-{model_id[:8]}",
        "lifecycle_state": "CANDIDATE",
        "artifact_digest": "",
        "artifact_uri": "",
        "preprocessing_ref": "",
        "dependency_lock_ref": "",
        "training_config_ref": "",
    }
    if task is not None and task.servable and cadence in task.cadences:
        manifest["serving_scope"] = {
            "event_type": task.serving_event_type,
            "cadence": cadence,
            "evaluation_unit": partition.partition_metadata.get("evaluation_unit"),
        }
    training_config = {
        "algorithm": algorithm,
        "task_kind": "regression",
        "seed": seed,
        "hyperparameters": best_params,
        "evaluation_protocol": {
            "partition_id": partition.partition_metadata.get("partition_id"),
            "dataset_digest": partition.partition_metadata.get("dataset_digest"),
            "target_definition_ref": partition.partition_metadata.get("target_definition_ref"),
            "split": partition.partition_metadata,
            "selection_metric": "validation_oof_rmse_then_mae",
            "decision_policy": None,
            "institutional_decision": "EVIDENCIA_INSUFICIENTE",
        },
        "cpu_limit": cpu_limit,
        "memory_limit_mb": memory_limit_mb,
        "tuning": {
            "method": "GroupKFold",
            "scoring": "rmse",
            "n_splits": folds,
            "candidate_count": len(cv_results),
            "results": cv_results,
            "best_mean_rmse": best["mean_rmse"],
            "best_mean_mae": best["mean_mae"],
            "outer_test_used_for_selection": False,
        },
        "user_config": config,
    }
    balance_report = {
        **partition.balance_report.__dict__,
        "scope": "not_applicable_regression",
    }
    return TrainingResult(
        model=model,
        preprocessing_pipeline=final_preprocessor,
        manifest=manifest,
        metrics=metrics,
        training_config=training_config,
        balance_report=balance_report,
        feature_names=partition.feature_names,
        dependency_lock=get_dependency_versions(),
        duration_seconds=duration,
    )
