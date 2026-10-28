"""Unit tests for SMOTE balancing with leakage prevention."""

from __future__ import annotations

import unittest
import numpy as np
import pandas as pd

from preparation.balancer import apply_smote_if_warranted


class BalancerTests(unittest.TestCase):
    def test_smote_applied_when_imbalanced(self) -> None:
        """Minority class with >= 6 samples and ratio < 0.4 triggers SMOTE."""
        # 30 majority (0), 8 minority (1) -> ratio 8/30 = 0.267 < 0.4
        n_maj = 30
        n_min = 8
        np.random.seed(42)
        X = pd.DataFrame({
            "f1": np.random.randn(n_maj + n_min),
            "f2": np.random.randn(n_maj + n_min),
        })
        y = pd.Series([0] * n_maj + [1] * n_min)

        X_bal, y_bal, report = apply_smote_if_warranted(
            X, y, imbalance_threshold=0.4, seed=42
        )

        self.assertEqual(report.technique, "SMOTE")
        self.assertEqual(report.applied_to, "train_only")
        self.assertIsNone(report.reason_if_skipped)
        self.assertGreater(len(y_bal), len(y))
        # After default SMOTE, classes should be 1:1
        counts = y_bal.value_counts()
        self.assertEqual(counts[0], counts[1])

    def test_smote_skipped_when_balanced(self) -> None:
        """When class ratio is >= threshold, SMOTE is skipped."""
        # 20 majority (0), 15 minority (1) -> ratio 15/20 = 0.75 >= 0.4
        n_maj = 20
        n_min = 15
        X = pd.DataFrame({"f1": range(n_maj + n_min)})
        y = pd.Series([0] * n_maj + [1] * n_min)

        X_out, y_out, report = apply_smote_if_warranted(
            X, y, imbalance_threshold=0.4, seed=42
        )

        self.assertIsNone(report.technique)
        self.assertIsNotNone(report.reason_if_skipped)
        self.assertEqual(len(y_out), len(y))
        self.assertEqual(report.applied_to, "train_only")

    def test_smote_skipped_insufficient_minority_samples(self) -> None:
        """When minority has < 6 samples, SMOTE is skipped to prevent synthetic distortion."""
        n_maj = 20
        n_min = 4  # < 6
        X = pd.DataFrame({"f1": range(n_maj + n_min)})
        y = pd.Series([0] * n_maj + [1] * n_min)

        X_out, y_out, report = apply_smote_if_warranted(
            X, y, imbalance_threshold=0.4, seed=42
        )

        self.assertIsNone(report.technique)
        self.assertIn("fewer than the minimum 6 required", report.reason_if_skipped or "")
        self.assertEqual(len(y_out), len(y))

    def test_smote_skipped_for_single_class(self) -> None:
        """When only one class exists, SMOTE is skipped."""
        X = pd.DataFrame({"f1": [1, 2, 3, 4, 5, 6, 7, 8]})
        y = pd.Series([0] * 8)

        X_out, y_out, report = apply_smote_if_warranted(X, y)
        self.assertIsNone(report.technique)
        self.assertIn("at least two", report.reason_if_skipped or "")


if __name__ == "__main__":
    unittest.main()
