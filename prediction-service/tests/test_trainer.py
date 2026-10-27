"""Unit and integration tests for model training (Random Forest and XGBoost)."""

from __future__ import annotations

import json
import unittest
from pathlib import Path

from preparation.pipeline import prepare_dataset
from training.trainer import get_dependency_versions, train_model


class TrainerTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        fixture_dir = Path(__file__).parent / "fixtures" / "pred003_synthetic"
        cls.manifest = json.loads((fixture_dir / "manifest.json").read_text(encoding="utf-8"))
        cls.rows = [
            json.loads(line)
            for line in (fixture_dir / "rows.jsonl").read_text(encoding="utf-8").splitlines()
            if line.strip()
        ]
        cls.partition = prepare_dataset(
            cls.manifest,
            cls.rows,
            seed=42,
            test_ratio=0.25,
            apply_balancing=True,
        )

    def test_random_forest_training_produces_valid_result(self) -> None:
        result = train_model(
            partition=self.partition,
            algorithm="random_forest",
            seed=42,
        )

        self.assertIsNotNone(result.model)
        self.assertEqual(result.manifest["algorithm"], "random_forest")
        self.assertEqual(result.manifest["lifecycle_state"], "CANDIDATE")
        self.assertEqual(result.manifest["contract_version"], "1.0")

        # Check metrics completeness
        metrics = result.metrics
        self.assertIn("accuracy", metrics)
        self.assertIn("recall", metrics)
        self.assertIn("precision", metrics)
        self.assertIn("f1_score", metrics)
        self.assertIn("confusion_matrix", metrics)
        self.assertGreaterEqual(metrics["accuracy"], 0.0)
        self.assertLessEqual(metrics["accuracy"], 1.0)

        # Check dependency tracking
        deps = result.dependency_lock
        self.assertIn("scikit_learn", deps)
        self.assertIn("xgboost", deps)
        self.assertIn("imbalanced_learn", deps)

    def test_xgboost_training_produces_valid_result(self) -> None:
        result = train_model(
            partition=self.partition,
            algorithm="xgboost",
            seed=42,
        )

        self.assertIsNotNone(result.model)
        self.assertEqual(result.manifest["algorithm"], "xgboost")
        self.assertEqual(result.manifest["lifecycle_state"], "CANDIDATE")

        metrics = result.metrics
        self.assertIn("accuracy", metrics)
        self.assertIn("f1_score", metrics)
        self.assertGreaterEqual(metrics["accuracy"], 0.0)

    def test_reproducibility_with_same_seed(self) -> None:
        res1 = train_model(self.partition, "random_forest", seed=123)
        res2 = train_model(self.partition, "random_forest", seed=123)

        self.assertEqual(res1.metrics["accuracy"], res2.metrics["accuracy"])
        self.assertEqual(res1.metrics["f1_score"], res2.metrics["f1_score"])

    def test_invalid_algorithm_raises_error(self) -> None:
        with self.assertRaises(ValueError):
            train_model(self.partition, "logistic_regression")

    def test_get_dependency_versions(self) -> None:
        versions = get_dependency_versions()
        self.assertIn("python", versions)
        self.assertIn("scikit_learn", versions)
        self.assertIn("xgboost", versions)
        self.assertIn("imbalanced_learn", versions)
        self.assertIn("pandas", versions)
        self.assertIn("numpy", versions)


if __name__ == "__main__":
    unittest.main()
