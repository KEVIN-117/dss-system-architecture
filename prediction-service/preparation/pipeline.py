"""Dataset validation, temporal holdout, and fold-local preprocessing setup."""

from __future__ import annotations

import logging
import hashlib
import json
from dataclasses import dataclass
from typing import Any, Mapping

import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OrdinalEncoder

from preparation.balancer import BalanceReport, _class_distribution
from preparation.partitioner import temporal_student_grouped_split

log = logging.getLogger(__name__)


@dataclass(frozen=True)
class PreparedPartition:
    """Raw outer train/test partitions; folds fit all transforms independently."""

    X_train: pd.DataFrame
    y_train: pd.Series
    X_test: pd.DataFrame
    y_test: pd.Series
    train_groups: pd.Series
    test_groups: pd.Series
    feature_names: list[str]
    categorical_features: list[str]
    preprocessing_pipeline: ColumnTransformer
    balance_report: BalanceReport
    partition_metadata: dict[str, Any]
    manifest_ref: str
    apply_balancing: bool = True
    imbalance_threshold: float = 0.4


def _categorical_feature_names(
    feature_names: list[str], fields: list[Mapping[str, Any]],
) -> list[str]:
    field_by_name = {
        field["name"]: field
        for field in fields
        if isinstance(field, Mapping) and isinstance(field.get("name"), str)
    }
    categorical_types = {"category", "string", "boolean"}
    return [
        name for name in feature_names
        if field_by_name.get(name, {}).get("logical_type") in categorical_types
    ]


def build_preprocessing_pipeline(
    feature_names: list[str], categorical_features: list[str],
) -> ColumnTransformer:
    """Build a fresh, unfitted transformer; fit it only on a fold's train rows."""
    categorical = [name for name in feature_names if name in set(categorical_features)]
    numeric = [name for name in feature_names if name not in set(categorical)]
    transformers: list[tuple[str, Any, list[str]]] = []
    if numeric:
        transformers.append(("numeric", SimpleImputer(strategy="median", keep_empty_features=True), numeric))
    if categorical:
        cat_pipe = Pipeline([
            ("imputer", SimpleImputer(strategy="most_frequent", keep_empty_features=True)),
            ("ordinal", OrdinalEncoder(handle_unknown="use_encoded_value", unknown_value=-1)),
        ])
        transformers.append(("categorical", cat_pipe, categorical))
    if not transformers:
        raise ValueError("At least one declared feature is required.")
    return ColumnTransformer(
        transformers=transformers,
        remainder="drop",
        verbose_feature_names_out=False,
    )


def prepare_dataset(
    manifest: dict[str, Any],
    rows: list[dict[str, Any]],
    seed: int = 42,
    test_ratio: float = 0.2,
    apply_balancing: bool = True,
    imbalance_threshold: float = 0.4,
) -> PreparedPartition:
    """Filter eligible rows and make a student-grouped temporal holdout.

    No imputer, encoder, feature statistic, or sampler is fitted here. Those
    operations belong inside each cross-validation training fold in trainer.py.
    """
    df = pd.DataFrame(rows)
    if "population_status" not in df:
        raise ValueError("Column 'population_status' is required for eligibility filtering.")
    if "resultado_retencion" not in df:
        raise ValueError("Column 'resultado_retencion' is required for evaluability filtering.")
    df = df.loc[(df["population_status"] == "ELIGIBLE") & (df["resultado_retencion"] != "NO_EVALUABLE")].copy()
    if df.empty:
        raise ValueError("No evaluable, eligible rows remain after filtering.")
    if manifest.get("target_approved") is not True:
        raise ValueError("A DSA-approved target definition (target_approved: true) is required before preparation.")
    if manifest.get("eligibility_approved") is not True:
        raise ValueError("A DSA-approved population rule (eligibility_approved: true) is required before preparation.")

    feature_names: list[str] = manifest.get("feature_fields", [])
    target_field: str | None = manifest.get("target_field")
    if not feature_names:
        raise ValueError("Manifest declares no feature_fields.")
    if not target_field:
        raise ValueError("Manifest does not declare a target_field.")
    missing = sorted((set(feature_names) | {target_field}) - set(df.columns))
    if missing:
        raise ValueError(f"Required fields missing from data: {missing}")
    if "student_ref" not in df:
        raise ValueError("Column 'student_ref' is required for group-aware splitting and validation.")

    train_df, test_df = temporal_student_grouped_split(
        df=df, target_col=target_field, test_ratio=test_ratio, seed=seed,
    )
    x_train = train_df[feature_names].copy()
    x_test = test_df[feature_names].copy()
    y_train = train_df[target_field].copy()
    y_test = test_df[target_field].copy()
    train_groups = train_df["student_ref"].copy()
    test_groups = test_df["student_ref"].copy()
    categorical_features = _categorical_feature_names(feature_names, manifest.get("fields", []))

    # This object is a template only and remains unfitted until each CV fold.
    preprocessing = build_preprocessing_pipeline(feature_names, categorical_features)
    report = BalanceReport(
        original_distribution=_class_distribution(y_train),
        balanced_distribution=None,
        technique=None,
        reason_if_skipped="Balancing is deferred to each training fold.",
        k_neighbors_used=None,
        applied_to="fold_train_only",
    )
    train_students = set(train_groups.unique())
    test_students = set(test_groups.unique())
    train_rows_per_student = train_groups.value_counts()
    test_rows_per_student = test_groups.value_counts()
    split_metadata = dict(train_df.attrs.get("split_metadata", {}))
    if train_students & test_students:
        raise RuntimeError("Student identity leaked across the outer evaluation split.")
    partition_basis = {
        "dataset_digest": manifest.get("content_digest"),
        "target_definition_ref": manifest.get("target_definition_ref"),
        "target_field": target_field,
        "feature_fields": feature_names,
        "split": split_metadata,
    }
    partition_id = hashlib.sha256(
        json.dumps(partition_basis, sort_keys=True, separators=(",", ":")).encode("utf-8")
    ).hexdigest()
    metadata = {
        "train_size": len(x_train),
        "test_size": len(x_test),
        **split_metadata,
        "partition_id": partition_id,
        "dataset_digest": manifest.get("content_digest"),
        "target_definition_ref": manifest.get("target_definition_ref"),
        "student_groups_train": len(train_students),
        "student_groups_test": len(test_students),
        "rows_per_student_train": {
            "min": int(train_rows_per_student.min()),
            "median": float(train_rows_per_student.median()),
            "max": int(train_rows_per_student.max()),
        },
        "rows_per_student_test": {
            "min": int(test_rows_per_student.min()),
            "median": float(test_rows_per_student.median()),
            "max": int(test_rows_per_student.max()),
        },
        "target_definition": manifest.get("target_definition"),
        "cv_method": "stratified_group_k_fold",
        "evaluation_unit": "student_program_academic_cut",
        "evidence_kind": "synthetic_fixture" if manifest.get("fixture_only") is True and str(manifest.get("snapshot_ref", "")).startswith(("fixture:", "synthetic:")) else "institutional_unverified",
    }
    return PreparedPartition(
        X_train=x_train,
        y_train=y_train,
        X_test=x_test,
        y_test=y_test,
        train_groups=train_groups,
        test_groups=test_groups,
        feature_names=feature_names,
        categorical_features=categorical_features,
        preprocessing_pipeline=preprocessing,
        balance_report=report,
        partition_metadata=metadata,
        manifest_ref=str(manifest.get("dataset_id", "unknown")),
        apply_balancing=apply_balancing,
        imbalance_threshold=imbalance_threshold,
    )
