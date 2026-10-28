"""Unit and integration tests for model training (Random Forest and XGBoost)."""

from __future__ import annotations

import json
import copy
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

    def test_tuning_uses_grouped_cv_and_never_selects_on_outer_test(self) -> None:
        result = train_model(
            self.partition,
            "random_forest",
            config={"search_space": {"n_estimators": [10], "max_depth": [3]}},
            seed=17,
            cpu_limit=1,
            cv_splits=3,
        )
        tuning = result.training_config["tuning"]
        self.assertEqual(tuning["method"], "StratifiedGroupKFold")
        self.assertFalse(tuning["outer_test_used_for_selection"])
        self.assertEqual(tuning["candidate_count"], 1)
        for folds in tuning["results"][0]["folds"]:
            self.assertFalse(folds["student_group_overlap"])
            self.assertEqual(folds["balance"]["applied_to"], "train_only")
            self.assertEqual(sum(folds["validation_distribution"].values()), folds["validation_rows"])
        self.assertEqual(result.training_config["hyperparameters"]["n_estimators"], 10)

    def test_smote_runs_inside_cv_fold_and_validation_distribution_stays_real(self) -> None:
        rows = []
        template = self.rows[0]
        for index in range(200):
            row = copy.deepcopy(template)
            is_risk = index % 4 == 0
            row.update({
                "student_ref": f"synthetic-cv-student-{index:03d}",
                "academic_year": 2020 + index // 40,
                "academic_period": index % 2 + 1,
                "resultado_retencion": "DESERTOR" if is_risk else "RETENIDO",
                "es_desercion": is_risk,
                "target_class": "RISK" if is_risk else "NO_RISK",
                "materias_cursadas": 8 + index % 5,
                "materias_aprobadas": 4 + index % 4,
                "materias_reprobadas": 1 + index % 3,
            })
            rows.append(row)
        partition = prepare_dataset(self.manifest, rows, seed=21, test_ratio=0.2, apply_balancing=True)
        result = train_model(
            partition,
            "random_forest",
            config={"search_space": {"n_estimators": [10], "max_depth": [3]}},
            seed=21,
            cpu_limit=1,
            cv_splits=3,
        )
        folds = result.training_config["tuning"]["results"][0]["folds"]
        self.assertTrue(all(fold["balance"]["technique"] == "SMOTE" for fold in folds))
        for fold in folds:
            self.assertFalse(fold["student_group_overlap"])
            self.assertEqual(sum(fold["validation_distribution"].values()), fold["validation_rows"])
        self.assertEqual(result.balance_report["scope"], "outer_train_refit")
        self.assertEqual(result.metrics["test_row_count"], len(partition.y_test))


if __name__ == "__main__":
    unittest.main()
