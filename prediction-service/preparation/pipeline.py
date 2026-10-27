"""Full data-preparation pipeline.

Orchestrates filtering, temporal splitting, preprocessing, and optional
SMOTE balancing into a single reproducible ``PreparedPartition``.  The
preprocessing pipeline is fit **only** on training data so that no
information from the test set leaks into the transformations.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any, Mapping

import pandas as pd
from sklearn.impute import SimpleImputer
from sklearn.pipeline import Pipeline

from preparation.balancer import BalanceReport, apply_smote_if_warranted
from preparation.partitioner import temporal_student_grouped_split


log = logging.getLogger(__name__)


@dataclass(frozen=True)
class PreparedPartition:
    """Immutable snapshot of a fully-prepared train/test dataset."""

    X_train: pd.DataFrame
    y_train: pd.Series
    X_test: pd.DataFrame
    y_test: pd.Series
    feature_names: list[str]
    preprocessing_pipeline: Pipeline
    balance_report: BalanceReport
    partition_metadata: dict[str, Any]
    manifest_ref: str


def _detect_categorical_indices(
    feature_names: list[str],
    fields: list[Mapping[str, Any]],
) -> list[int]:
    """Return zero-based column indices of categorical features.

    A field is considered categorical when its ``logical_type`` is
    ``"category"`` or ``"string"`` in the manifest's field definitions.
    """
    field_by_name: dict[str, Mapping[str, Any]] = {
        field["name"]: field
        for field in fields
        if isinstance(field, Mapping) and isinstance(field.get("name"), str)
    }
    categorical_types = {"category", "string"}
    indices: list[int] = []
    for idx, name in enumerate(feature_names):
        field = field_by_name.get(name)
        if field is not None and field.get("logical_type") in categorical_types:
            indices.append(idx)
    return indices


def prepare_dataset(
    manifest: dict[str, Any],
    rows: list[dict[str, Any]],
    seed: int = 42,
    test_ratio: float = 0.2,
    apply_balancing: bool = True,
    imbalance_threshold: float = 0.4,
) -> PreparedPartition:
    """Run the end-to-end data-preparation pipeline.

    Parameters
    ----------
    manifest:
        Validated dataset manifest (contract v1.0) with ``feature_fields``,
        ``target_field``, ``fields``, ``dataset_id``, etc.
    rows:
        List of row dictionaries from the prepared snapshot.
    seed:
        Reproducibility seed for splitting and SMOTE.
    test_ratio:
        Fraction of students assigned to the test partition.
    apply_balancing:
        Whether to attempt SMOTE on the training fold.
    imbalance_threshold:
        Minority / majority ratio below which SMOTE activates.

    Returns
    -------
    PreparedPartition
        Fully prepared train/test partition with fitted pipeline and
        balance report.

    Raises
    ------
    ValueError
        If the manifest lacks required definitions or no evaluable,
        eligible rows remain after filtering.
    """
    # ------------------------------------------------------------------
    # 1. Convert rows to DataFrame.
    # ------------------------------------------------------------------
    df = pd.DataFrame(rows)
    log.info("Loaded %d raw rows into DataFrame.", len(df))

    # ------------------------------------------------------------------
    # 2. Filter only ELIGIBLE rows.
    # ------------------------------------------------------------------
    if "population_status" not in df.columns:
        raise ValueError("Column 'population_status' is required for eligibility filtering.")
    df = df.loc[df["population_status"] == "ELIGIBLE"].copy()
    log.info("%d rows remain after eligibility filter (ELIGIBLE only).", len(df))

    # ------------------------------------------------------------------
    # 3. Filter only evaluable rows.
    # ------------------------------------------------------------------
    if "resultado_retencion" not in df.columns:
        raise ValueError("Column 'resultado_retencion' is required for evaluability filtering.")
    df = df.loc[df["resultado_retencion"] != "NO_EVALUABLE"].copy()
    log.info("%d evaluable rows remain after excluding NO_EVALUABLE.", len(df))

    if df.empty:
        raise ValueError("No evaluable, eligible rows remain after filtering.")

    # ------------------------------------------------------------------
    # 4. Check approval gates and extract feature columns & target.
    # ------------------------------------------------------------------
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

    missing_features = sorted(set(feature_names) - set(df.columns))
    if missing_features:
        raise ValueError(f"Features missing from data: {missing_features}")
    if target_field not in df.columns:
        raise ValueError(f"Target field '{target_field}' is missing from the data.")

    # ------------------------------------------------------------------
    # 5. Temporal student-grouped split.
    # ------------------------------------------------------------------
    train_df, test_df = temporal_student_grouped_split(
        df=df,
        target_col=target_field,
        test_ratio=test_ratio,
        seed=seed,
    )

    X_train_raw = train_df[feature_names]
    y_train = train_df[target_field]
    X_test_raw = test_df[feature_names]
    y_test = test_df[target_field]

    # ------------------------------------------------------------------
    # 6–7. Build sklearn Pipeline (median imputation for numerics).
    # ------------------------------------------------------------------
    preprocessing = Pipeline(
        steps=[
            ("imputer", SimpleImputer(strategy="median")),
        ]
    )

    # ------------------------------------------------------------------
    # 8. Fit on X_train ONLY.
    # ------------------------------------------------------------------
    X_train_arr = preprocessing.fit_transform(X_train_raw)
    log.info("Preprocessing pipeline fitted on %d training rows.", len(X_train_raw))

    # ------------------------------------------------------------------
    # 9. Transform both train and test.
    # ------------------------------------------------------------------
    X_test_arr = preprocessing.transform(X_test_raw)

    X_train_prep = pd.DataFrame(X_train_arr, columns=feature_names, index=X_train_raw.index)
    X_test_prep = pd.DataFrame(X_test_arr, columns=feature_names, index=X_test_raw.index)

    # ------------------------------------------------------------------
    # 10. Optionally apply SMOTE on training data only.
    # ------------------------------------------------------------------
    fields: list[Mapping[str, Any]] = manifest.get("fields", [])
    categorical_indices = _detect_categorical_indices(feature_names, fields)

    if apply_balancing:
        X_train_final, y_train_final, balance_report = apply_smote_if_warranted(
            X_train=X_train_prep,
            y_train=y_train,
            categorical_indices=categorical_indices if categorical_indices else None,
            imbalance_threshold=imbalance_threshold,
            seed=seed,
        )
    else:
        from preparation.balancer import _class_distribution

        balance_report = BalanceReport(
            original_distribution=_class_distribution(y_train),
            balanced_distribution=None,
            technique=None,
            reason_if_skipped="Balancing disabled by caller.",
            k_neighbors_used=None,
            applied_to="train_only",
        )
        X_train_final = X_train_prep
        y_train_final = y_train

    # ------------------------------------------------------------------
    # 11. Build partition metadata and return.
    # ------------------------------------------------------------------
    train_students = set(train_df["student_ref"].unique())
    test_students = set(test_df["student_ref"].unique())

    partition_metadata: dict[str, Any] = {
        "train_size": len(X_train_final),
        "test_size": len(X_test_prep),
        "split_method": "temporal_student_grouped",
        "seed": seed,
        "test_ratio": test_ratio,
        "train_students": list(train_students),
        "test_students": list(test_students),
        "student_groups_train": len(train_students),
        "student_groups_test": len(test_students),
        "target_definition": manifest.get("target_definition"),
    }

    manifest_ref = str(manifest.get("dataset_id", "unknown"))

    log.info(
        "Preparation complete: train=%d, test=%d, features=%d, manifest=%s",
        partition_metadata["train_size"],
        partition_metadata["test_size"],
        len(feature_names),
        manifest_ref,
    )

    return PreparedPartition(
        X_train=X_train_final,
        y_train=y_train_final,
        X_test=X_test_prep,
        y_test=y_test,
        feature_names=feature_names,
        preprocessing_pipeline=preprocessing,
        balance_report=balance_report,
        partition_metadata=partition_metadata,
        manifest_ref=manifest_ref,
    )
