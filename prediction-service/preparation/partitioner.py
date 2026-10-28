"""Strict global-temporal holdout with student-level disjointness."""

from __future__ import annotations

import logging
import math
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
    """Reserve the latest global periods for test and keep students disjoint.

    Test contains rows in the final chronological period block. Train contains
    only earlier rows belonging to students absent from test. Earlier history
    for test students is excluded, so both temporal and group boundaries hold.
    The seed is recorded for protocol reproducibility; this split is deterministic.
    """
    if not 0.0 < test_ratio < 1.0:
        raise ValueError(f"test_ratio must be in (0, 1), got {test_ratio}.")
    year_col, period_col = time_cols
    missing = {student_col, year_col, period_col, target_col} - set(df.columns)
    if missing:
        raise ValueError(f"DataFrame is missing required columns: {sorted(missing)}")
    if df.empty:
        raise ValueError("Cannot split an empty DataFrame.")
    if df[[student_col, year_col, period_col]].isna().any().any():
        raise ValueError("Student and academic time columns cannot contain null values.")

    periods = sorted(set(zip(df[year_col].tolist(), df[period_col].tolist())))
    if len(periods) < 2:
        raise ValueError("At least two distinct academic periods are required for a temporal holdout.")
    n_test_periods = min(len(periods) - 1, max(1, math.ceil(len(periods) * test_ratio)))
    test_periods = periods[-n_test_periods:]
    first_test_period = test_periods[0]
    time_keys = pd.Series(list(zip(df[year_col].tolist(), df[period_col].tolist())), index=df.index)
    test_mask = time_keys.isin(test_periods)
    test_df = df.loc[test_mask].copy()
    test_students = set(test_df[student_col].unique())
    prior_mask = time_keys.map(lambda key: key < first_test_period)
    train_candidates = df.loc[prior_mask]
    train_df = train_candidates.loc[~train_candidates[student_col].isin(test_students)].copy()

    if train_df.empty or test_df.empty:
        raise ValueError("Temporal holdout produced an empty partition; more academic periods or eligible students are required.")
    train_periods = sorted(set(zip(train_df[year_col].tolist(), train_df[period_col].tolist())))
    test_periods_observed = sorted(set(zip(test_df[year_col].tolist(), test_df[period_col].tolist())))
    if max(train_periods) >= min(test_periods_observed):
        raise RuntimeError("Temporal boundary invariant failed: training period is not strictly earlier than test.")
    train_students = set(train_df[student_col].unique())
    overlap = train_students & test_students
    if overlap:
        raise RuntimeError("Student identity leaked across the temporal holdout.")

    split_metadata: dict[str, Any] = {
        "split_method": "global_temporal_student_disjoint_v1",
        "seed": seed,
        "test_ratio": test_ratio,
        "train_period_min": list(min(train_periods)),
        "train_period_max": list(max(train_periods)),
        "test_period_min": list(min(test_periods_observed)),
        "test_period_max": list(max(test_periods_observed)),
        "train_period_count": len(train_periods),
        "test_period_count": len(test_periods_observed),
        "train_rows": len(train_df),
        "test_rows": len(test_df),
        "train_student_count": len(train_students),
        "test_student_count": len(test_students),
        "excluded_prior_history_rows": len(train_candidates) - len(train_df),
        "student_group_overlap": False,
    }
    train_df.attrs["split_metadata"] = split_metadata
    log.info("Strict temporal holdout: %s", split_metadata)
    return train_df, test_df
