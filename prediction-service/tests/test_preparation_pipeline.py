"""Integration and unit tests for the full data preparation pipeline."""

from __future__ import annotations

import json
import unittest
from pathlib import Path

from preparation.pipeline import prepare_dataset


class PreparationPipelineTests(unittest.TestCase):
    def setUp(self) -> None:
        fixture_dir = Path(__file__).parent / "fixtures" / "pred003_synthetic"
        self.manifest = json.loads((fixture_dir / "manifest.json").read_text(encoding="utf-8"))
        self.rows = [
            json.loads(line)
            for line in (fixture_dir / "rows.jsonl").read_text(encoding="utf-8").splitlines()
            if line.strip()
        ]

    def test_pipeline_prepares_valid_partition(self) -> None:
        partition = prepare_dataset(
            self.manifest,
            self.rows,
            seed=42,
            test_ratio=0.25,
            apply_balancing=True,
        )

        self.assertIsNotNone(partition.preprocessing_pipeline)
        self.assertEqual(partition.feature_names, ["materias_cursadas", "materias_aprobadas", "materias_reprobadas"])
        self.assertEqual(list(partition.X_train.columns), partition.feature_names)
        self.assertEqual(list(partition.X_test.columns), partition.feature_names)

        # Target column must NOT be present in features (no target leakage)
        self.assertNotIn("target_class", partition.X_train.columns)
        self.assertNotIn("target_class", partition.X_test.columns)

        # Preparation keeps raw values: every CV fold must fit its own imputer.
        self.assertFalse(hasattr(partition.preprocessing_pipeline, "transformers_"))
        self.assertEqual(partition.balance_report.applied_to, "fold_train_only")
        self.assertEqual(partition.balance_report.reason_if_skipped, "Balancing is deferred to each training fold.")

    def test_student_grouping_prevents_identity_leakage(self) -> None:
        """Verify no student appears in both train and test partitions."""
        partition = prepare_dataset(
            self.manifest,
            self.rows,
            seed=42,
            test_ratio=0.25,
        )

        train_students = set(partition.train_groups)
        test_students = set(partition.test_groups)

        overlap = train_students.intersection(test_students)
        self.assertEqual(len(overlap), 0, f"Students leaked between train and test: {overlap}")
        meta = partition.partition_metadata
        self.assertLess(tuple(meta["train_period_max"]), tuple(meta["test_period_min"]))
        self.assertFalse(meta["student_group_overlap"])
        self.assertEqual(len(partition.X_test), meta["test_rows"])
        self.assertNotIn("train_students", meta)
        self.assertNotIn("test_students", meta)

    def test_prior_history_for_test_students_is_excluded(self) -> None:
        rows = [dict(row) for row in self.rows]
        repeated = dict(rows[-1])
        repeated["academic_year"] = 2023
        repeated["academic_period"] = 1
        repeated["cut_id"] = "synthetic-history-cut"
        rows.append(repeated)
        partition = prepare_dataset(self.manifest, rows, seed=42, test_ratio=0.25)
        self.assertGreaterEqual(partition.partition_metadata["excluded_prior_history_rows"], 1)
        self.assertFalse(set(partition.train_groups) & set(partition.test_groups))

    def test_single_period_fails_closed(self) -> None:
        rows = [dict(row, academic_year=2024, academic_period=1) for row in self.rows]
        with self.assertRaisesRegex(ValueError, "At least two distinct academic periods"):
            prepare_dataset(self.manifest, rows)

    def test_unapproved_target_raises_error(self) -> None:
        bad_manifest = dict(self.manifest)
        bad_manifest["target_approved"] = False

        with self.assertRaises(ValueError) as ctx:
            prepare_dataset(bad_manifest, self.rows)
        self.assertIn("target_approved", str(ctx.exception))

    def test_reproducible_with_same_seed(self) -> None:
        p1 = prepare_dataset(self.manifest, self.rows, seed=42)
        p2 = prepare_dataset(self.manifest, self.rows, seed=42)

        self.assertEqual(len(p1.X_train), len(p2.X_train))
        self.assertEqual(len(p1.X_test), len(p2.X_test))
        self.assertTrue((p1.y_train.values == p2.y_train.values).all())
        self.assertTrue((p1.y_test.values == p2.y_test.values).all())


if __name__ == "__main__":
    unittest.main()
