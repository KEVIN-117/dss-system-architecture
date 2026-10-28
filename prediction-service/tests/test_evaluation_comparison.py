"""Comparison contract tests: shared evidence and validation-only selection."""

from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path

from evaluation.comparison import compare_artifacts


class EvaluationComparisonTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_root = Path(__file__).parent / ".test-tmp"
        self.temp_root.mkdir(parents=True, exist_ok=True)

    def _artifact(self, root: Path, name: str, algorithm: str, recall: float, f1: float, test_score: float) -> Path:
        directory = root / name
        directory.mkdir()
        files = {
            "manifest.json": {"algorithm": algorithm, "model_id": name, "version": "v1", "artifact_digest": "digest", "classes": {"positive_class": "RISK", "negative_class": "NO_RISK"}},
            "metrics.json": {"accuracy": test_score},
            "training_config.json": {
                "evaluation_protocol": {
                    "partition_id": "partition-a",
                    "dataset_digest": "dataset-a",
                    "target_definition_ref": "target-a",
                    "decision_policy": None,
                    "selection_metric": "validation_mean_recall_then_f1",
                },
                "tuning": {
                    "best_mean_recall": recall,
                    "best_mean_f1": f1,
                    "outer_test_used_for_selection": False,
                },
            },
            "dataset_ref.json": {
                "fixture_only": True,
                "dataset_ref": "fixture:pred003",
                "manifest_ref": "dataset-a",
                "dataset_id": "dataset-a",
                "dataset_digest": "dataset-a",
                "snapshot_ref": "fixture:pred003",
                "target_definition_ref": "target-a",
                "population_definition_ref": "population-a",
                "partition_id": "partition-a",
                "source": {"system": "dw", "contract_ref": "fixture"},
                "academic_cut": {"closure_id": "cut-synthetic"},
            },
        }
        for filename, content in files.items():
            (directory / filename).write_text(json.dumps(content), encoding="utf-8")
        return directory

    def test_selection_uses_validation_not_test_metrics(self) -> None:
        with tempfile.TemporaryDirectory(dir=self.temp_root) as temp:
            root = Path(temp)
            rf = self._artifact(root, "rf", "random_forest", 0.8, 0.7, 0.1)
            xgb = self._artifact(root, "xgb", "xgboost", 0.7, 0.99, 1.0)
            report = compare_artifacts([rf, xgb])
            self.assertEqual(report["selected_candidate_by_validation"], "rf")
            self.assertEqual(report["decision_status"], "EVIDENCIA_INSUFICIENTE")
            self.assertEqual(report["evidence_kind"], "synthetic_fixture")
            self.assertEqual(report["report_scope"], "software_validation_only")
            self.assertFalse(report["crisp_dm_next_step"]["deployment_allowed"])

    def test_mismatched_partition_is_rejected(self) -> None:
        with tempfile.TemporaryDirectory(dir=self.temp_root) as temp:
            root = Path(temp)
            rf = self._artifact(root, "rf", "random_forest", 0.8, 0.7, 0.5)
            xgb = self._artifact(root, "xgb", "xgboost", 0.7, 0.6, 0.6)
            config_path = xgb / "training_config.json"
            config = json.loads(config_path.read_text(encoding="utf-8"))
            config["evaluation_protocol"]["partition_id"] = "partition-b"
            config_path.write_text(json.dumps(config), encoding="utf-8")
            with self.assertRaisesRegex(ValueError, "same dataset"):
                compare_artifacts([rf, xgb])

    def test_validation_tie_does_not_force_an_arbitrary_winner(self) -> None:
        with tempfile.TemporaryDirectory(dir=self.temp_root) as temp:
            root = Path(temp)
            rf = self._artifact(root, "rf", "random_forest", 0.8, 0.7, 1.0)
            xgb = self._artifact(root, "xgb", "xgboost", 0.8, 0.7, 0.0)
            report = compare_artifacts([rf, xgb])
            self.assertEqual(report["candidate_selection_status"], "NO_UNIQUE_WINNER")
            self.assertIsNone(report["selected_candidate_by_validation"])
            self.assertEqual(len(report["top_candidates_by_validation"]), 2)


if __name__ == "__main__":
    unittest.main()
