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

        # No nulls remain after imputation
        self.assertEqual(partition.X_train.isna().sum().sum(), 0)
        self.assertEqual(partition.X_test.isna().sum().sum(), 0)

        # Balance report is documented
        self.assertEqual(partition.balance_report.applied_to, "train_only")

    def test_student_grouping_prevents_identity_leakage(self) -> None:
        """Verify no student appears in both train and test partitions."""
        partition = prepare_dataset(
            self.manifest,
            self.rows,
            seed=42,
            test_ratio=0.25,
        )

        train_students = set(partition.partition_metadata["train_students"])
        test_students = set(partition.partition_metadata["test_students"])

        overlap = train_students.intersection(test_students)
        self.assertEqual(len(overlap), 0, f"Students leaked between train and test: {overlap}")

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
