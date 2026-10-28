"""SMOTE balancing with leakage prevention.

Applies SMOTE (or SMOTENC for mixed-type features) exclusively to the
training fold.  Test and validation data are **never** touched.  The module
reports every decision — including the reason when balancing is skipped — so
that downstream audit artifacts can capture the full lineage.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass

import pandas as pd
from imblearn.over_sampling import SMOTE, SMOTENC


log = logging.getLogger(__name__)

_MIN_MINORITY_SAMPLES = 6  # k_neighbors default (5) + 1


@dataclass(frozen=True)
class BalanceReport:
    """Immutable record of a balancing decision and its outcome."""

    original_distribution: dict[str, int]
    balanced_distribution: dict[str, int] | None
    technique: str | None
    reason_if_skipped: str | None
    k_neighbors_used: int | None
    applied_to: str  # Always "train_only"


def _class_distribution(y: pd.Series) -> dict[str, int]:
    """Return a ``{label: count}`` mapping with string keys."""
    return {str(label): int(count) for label, count in y.value_counts().items()}


def apply_smote_if_warranted(
    X_train: pd.DataFrame,
    y_train: pd.Series,
    categorical_indices: list[int] | None = None,
    imbalance_threshold: float = 0.4,
    seed: int = 42,
) -> tuple[pd.DataFrame, pd.Series, BalanceReport]:
    """Conditionally apply SMOTE to the **training set only**.

    Parameters
    ----------
    X_train:
        Feature matrix for training.
    y_train:
        Target series for training, aligned with *X_train*.
    categorical_indices:
        Zero-based column positions of categorical features.  When
        provided and non-empty, ``SMOTENC`` is used instead of ``SMOTE``.
    imbalance_threshold:
        Minimum minority / majority ratio below which SMOTE is applied.
        If the ratio is already ``>= imbalance_threshold`` the data is
        returned unchanged.
    seed:
        Random seed for SMOTE reproducibility.

    Returns
    -------
    tuple[pd.DataFrame, pd.Series, BalanceReport]
        Balanced ``(X, y)`` and a report documenting the decision.
    """
    original_dist = _class_distribution(y_train)
    counts = y_train.value_counts()

    if len(counts) < 2:
        reason = "Only one class present; SMOTE requires at least two."
        log.warning("SMOTE skipped: %s", reason)
        return X_train, y_train, BalanceReport(
            original_distribution=original_dist,
            balanced_distribution=None,
            technique=None,
            reason_if_skipped=reason,
            k_neighbors_used=None,
            applied_to="train_only",
        )

    minority_count = int(counts.min())
    majority_count = int(counts.max())
    ratio = minority_count / majority_count

    # ------------------------------------------------------------------
    # Guard 1 — already balanced enough.
    # ------------------------------------------------------------------
    if ratio >= imbalance_threshold:
        reason = (
            f"Class ratio {ratio:.3f} >= threshold {imbalance_threshold}; "
            f"balancing is not necessary."
        )
        log.info("SMOTE skipped: %s", reason)
        return X_train, y_train, BalanceReport(
            original_distribution=original_dist,
            balanced_distribution=None,
            technique=None,
            reason_if_skipped=reason,
            k_neighbors_used=None,
            applied_to="train_only",
        )

    # ------------------------------------------------------------------
    # Guard 2 — insufficient minority samples for k_neighbors.
    # ------------------------------------------------------------------
    if minority_count < _MIN_MINORITY_SAMPLES:
        reason = (
            f"Minority class has {minority_count} samples, fewer than the "
            f"minimum {_MIN_MINORITY_SAMPLES} required for k_neighbors=5."
        )
        log.warning("SMOTE skipped: %s", reason)
        return X_train, y_train, BalanceReport(
            original_distribution=original_dist,
            balanced_distribution=None,
            technique=None,
            reason_if_skipped=reason,
            k_neighbors_used=None,
            applied_to="train_only",
        )

    # ------------------------------------------------------------------
    # Apply SMOTE or SMOTENC.
    # ------------------------------------------------------------------
    k_neighbors = 5
    use_smotenc = bool(categorical_indices)

    if use_smotenc:
        sampler = SMOTENC(
            categorical_features=categorical_indices,
            k_neighbors=k_neighbors,
            random_state=seed,
        )
        technique = "SMOTENC"
    else:
        sampler = SMOTE(
            k_neighbors=k_neighbors,
            random_state=seed,
        )
        technique = "SMOTE"

    log.info(
        "Applying %s (k_neighbors=%d, seed=%d) to training data with "
        "distribution %s",
        technique,
        k_neighbors,
        seed,
        original_dist,
    )

    X_resampled, y_resampled = sampler.fit_resample(X_train, y_train)

    X_balanced = pd.DataFrame(X_resampled, columns=X_train.columns)
    y_balanced = pd.Series(y_resampled, name=y_train.name)

    balanced_dist = _class_distribution(y_balanced)
    log.info("Balanced distribution: %s", balanced_dist)

    return X_balanced, y_balanced, BalanceReport(
        original_distribution=original_dist,
        balanced_distribution=balanced_dist,
        technique=technique,
        reason_if_skipped=None,
        k_neighbors_used=k_neighbors,
        applied_to="train_only",
    )
