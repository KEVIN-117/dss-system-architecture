"""Model training for Random Forest and XGBoost with evaluation and manifest generation."""

from __future__ import annotations

import logging
import sys
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

import numpy as np
import pandas as pd
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
from xgboost import XGBClassifier

from preparation.pipeline import PreparedPartition

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class TrainingResult:
    """Immutable outcome of a model training and evaluation run."""

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
    """Capture exact runtime library versions for reproducibility."""
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


def train_model(
    partition: PreparedPartition,
    algorithm: str,
    config: dict[str, Any] | None = None,
    seed: int = 42,
) -> TrainingResult:
    """Train either Random Forest or XGBoost on the prepared training partition.

    Evaluation is performed strictly on the holdout test set, which has never
    participated in fitting transformations, tuning, or balancing.

    Parameters
    ----------
    partition:
        Prepared partition containing X_train, y_train, X_test, y_test, etc.
    algorithm:
        Algorithm identifier: ``'random_forest'`` or ``'xgboost'``.
    config:
        Optional hyperparameter dictionary to override defaults.
    seed:
        Seed for pseudo-random number generators.

    Returns
    -------
    TrainingResult
        Complete training outcome with fitted model, metrics, and manifest.
    """
    start_time = time.perf_counter()
    user_config = config or {}

    algorithm_norm = algorithm.lower().strip()
    if algorithm_norm not in {"random_forest", "xgboost"}:
        raise ValueError(f"Unsupported algorithm '{algorithm}'. Must be 'random_forest' or 'xgboost'.")

    # 1. Target identification
    target_meta = partition.partition_metadata.get("target_definition") or {}
    positive_class = target_meta.get("positive_class", "RISK")
    negative_class = target_meta.get("negative_class", "NO_RISK")
    event_code = target_meta.get("event_code", "NEXT_CLOSURE_DROPOUT")

    # Encode labels to 0/1 integers for estimators (especially XGBoost)
    label_map = {negative_class: 0, positive_class: 1}
    y_train_raw = partition.y_train
    y_test_raw = partition.y_test

    if set(y_train_raw.unique()).issubset({0, 1}):
        y_train_enc = y_train_raw.astype(int)
        y_test_enc = y_test_raw.astype(int)
    else:
        y_train_enc = y_train_raw.map(label_map).fillna(0).astype(int)
        y_test_enc = y_test_raw.map(label_map).fillna(0).astype(int)

    # 2. Build estimator with defaults and config overrides
    effective_config: dict[str, Any] = {}
    if algorithm_norm == "random_forest":
        default_params: dict[str, Any] = {
            "n_estimators": 100,
            "max_depth": None,
            "min_samples_split": 2,
            "random_state": seed,
            "n_jobs": -1,
            "class_weight": "balanced",
        }
        default_params.update(user_config.get("hyperparameters", {}))
        effective_config = default_params
        model: Any = RandomForestClassifier(**default_params)
    else:  # xgboost
        default_params = {
            "n_estimators": 100,
            "max_depth": 6,
            "learning_rate": 0.1,
            "random_state": seed,
            "eval_metric": "logloss",
            "n_jobs": -1,
        }
        default_params.update(user_config.get("hyperparameters", {}))
        effective_config = default_params
        model = XGBClassifier(**default_params)

    # 3. Fit on training fold only
    model.fit(partition.X_train, y_train_enc)

    # 4. Predict on holdout test partition
    y_pred_enc = model.predict(partition.X_test)

    # Predict probabilities for AUC/PR-AUC
    y_prob = None
    if hasattr(model, "predict_proba"):
        probs = model.predict_proba(partition.X_test)
        if probs.shape[1] > 1:
            y_prob = probs[:, 1]
        else:
            y_prob = probs[:, 0]

    # 5. Compute evaluation metrics
    acc = float(accuracy_score(y_test_enc, y_pred_enc))
    rec = float(recall_score(y_test_enc, y_pred_enc, zero_division=0))
    prec = float(precision_score(y_test_enc, y_pred_enc, zero_division=0))
    f1 = float(f1_score(y_test_enc, y_pred_enc, zero_division=0))

    roc_auc = None
    pr_auc = None
    if y_prob is not None and len(np.unique(y_test_enc)) > 1:
        try:
            roc_auc = float(roc_auc_score(y_test_enc, y_prob))
            pr_auc = float(average_precision_score(y_test_enc, y_prob))
        except ValueError as err:
            logger.warning("Could not calculate ROC-AUC or PR-AUC: %s", err)

    cm = confusion_matrix(y_test_enc, y_pred_enc).tolist()
    support = {
        str(cls): int(count) for cls, count in y_test_raw.value_counts().items()
    }

    metrics = {
        "accuracy": acc,
        "recall": rec,
        "precision": prec,
        "f1_score": f1,
        "roc_auc": roc_auc,
        "pr_auc": pr_auc,
        "confusion_matrix": cm,
        "support": support,
        "test_row_count": len(y_test_enc),
    }

    duration = time.perf_counter() - start_time

    # 6. Generate ModelManifest compliant with contracts
    model_id = str(uuid4())
    version_timestamp = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
    version = f"{algorithm_norm}-{version_timestamp}-{seed}"

    manifest = {
        "contract_version": "1.0",
        "model_id": model_id,
        "version": version,
        "algorithm": algorithm_norm,
        "dataset_id": partition.manifest_ref,
        "input_schema_version": "prepared-dataset-v1",
        "classes": {
            "positive_class": positive_class,
            "negative_class": negative_class,
            "event_code": event_code,
        },
        "created_at": datetime.now(timezone.utc).isoformat(),
        "evaluation_ref": f"eval-{model_id[:8]}",
        "lifecycle_state": "CANDIDATE",
        "artifact_digest": "",  # Populated after serialization by artifact_writer
        "artifact_uri": "",
        "preprocessing_ref": "",
        "dependency_lock_ref": "",
        "training_config_ref": "",
    }

    dep_versions = get_dependency_versions()

    balance_report_dict = {
        "original_distribution": partition.balance_report.original_distribution,
        "balanced_distribution": partition.balance_report.balanced_distribution,
        "technique": partition.balance_report.technique,
        "reason_if_skipped": partition.balance_report.reason_if_skipped,
        "k_neighbors_used": partition.balance_report.k_neighbors_used,
        "applied_to": partition.balance_report.applied_to,
    }

    return TrainingResult(
        model=model,
        preprocessing_pipeline=partition.preprocessing_pipeline,
        manifest=manifest,
        metrics=metrics,
        training_config={
            "algorithm": algorithm_norm,
            "seed": seed,
            "hyperparameters": effective_config,
            "user_config": user_config,
        },
        balance_report=balance_report_dict,
        feature_names=partition.feature_names,
        dependency_lock=dep_versions,
        duration_seconds=duration,
    )
