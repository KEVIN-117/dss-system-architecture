"""Temporal student-grouped split strategy.

Splits prepared academic datasets so that the most recent academic periods
form the test set and older periods form the training set.  Students are
grouped so the same student never appears in both partitions, preserving
temporal validity and preventing identity leakage.
"""

from __future__ import annotations

import logging
from typing import Any

import pandas as pd


log = logging.getLogger(__name__)


def temporal_student_grouped_split(
    df: pd.DataFrame,
    target_col: str,
    student_col: str = "student_ref",
    time_cols: tuple[str, str] = ("academic_year", "academic_period"),
    test_ratio: float = 0.2,
    seed: int = 42,
) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Split a dataset temporally with student-level grouping.

    Parameters
    ----------
    df:
        Prepared dataset with student identifiers and temporal columns.
    target_col:
        Name of the target (label) column — used only for logging.
    student_col:
        Column identifying individual students.
    time_cols:
        Tuple of ``(year_col, period_col)`` that together define temporal
        ordering.
    test_ratio:
        Fraction of *students* (by temporal ordering) assigned to test.
        Must be in ``(0, 1)``.
    seed:
        Random seed for reproducibility.  Currently only recorded in
        metadata; the split itself is deterministic given the data.

    Returns
    -------
    tuple[pd.DataFrame, pd.DataFrame]
        ``(train_df, test_df)`` with original indices preserved.

    Raises
    ------
    ValueError
        If the dataframe is missing required columns or ``test_ratio``
        is out of range.
    """
    if not 0.0 < test_ratio < 1.0:
        raise ValueError(f"test_ratio must be in (0, 1), got {test_ratio}.")

    year_col, period_col = time_cols
    missing = {student_col, year_col, period_col} - set(df.columns)
    if missing:
        raise ValueError(f"DataFrame is missing required columns: {sorted(missing)}")

    if df.empty:
        raise ValueError("Cannot split an empty DataFrame.")

    # ------------------------------------------------------------------
    # 1. Create a temporal ordering key from (academic_year, academic_period).
    # ------------------------------------------------------------------
    temporal_key = df[[year_col, period_col]].apply(tuple, axis=1)

    # ------------------------------------------------------------------
    # 2. Assign each student to the partition of their LATEST record.
    # ------------------------------------------------------------------
    student_latest: pd.Series[Any] = temporal_key.groupby(df[student_col]).max()

    # ------------------------------------------------------------------
    # 3. Sort students by their latest temporal key.
    # ------------------------------------------------------------------
    student_latest_sorted = student_latest.sort_values()
    ordered_students = student_latest_sorted.index.tolist()

    # ------------------------------------------------------------------
    # 4. Most recent ``test_ratio`` fraction of students → test.
    # ------------------------------------------------------------------
    n_students = len(ordered_students)
    n_test = max(1, int(round(n_students * test_ratio)))
    cutoff = n_students - n_test

    train_students = set(ordered_students[:cutoff])
    test_students = set(ordered_students[cutoff:])

    # ------------------------------------------------------------------
    # 5. Assign rows to partitions.
    # ------------------------------------------------------------------
    train_mask = df[student_col].isin(train_students)
    test_mask = df[student_col].isin(test_students)

    train_df = df.loc[train_mask]
    test_df = df.loc[test_mask]

    log.info(
        "Temporal student-grouped split: %d train rows (%d students), "
        "%d test rows (%d students), seed=%d, target=%s",
        len(train_df),
        len(train_students),
        len(test_df),
        len(test_students),
        seed,
        target_col,
    )

    return train_df, test_df
