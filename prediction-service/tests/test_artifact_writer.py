"""Unit tests for write_training_artifacts."""

from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path

from sklearn.dummy import DummyClassifier
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

from training.artifact_writer import write_training_artifacts


class ArtifactWriterTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = tempfile.TemporaryDirectory()
        self.artifacts_dir = Path(self.temp_dir.name)

    def tearDown(self) -> None:
        self.temp_dir.cleanup()

    def test_writes_all_expected_artifacts(self) -> None:
        job_id = "test-job-456"
        model = DummyClassifier(strategy="most_frequent")
        model.fit([[1], [2]], [0, 1])

        pipeline = Pipeline([("scaler", StandardScaler())])
        pipeline.fit([[1.0], [2.0]])

        manifest = {
            "contract_version": "1.0",
            "model_id": "model-uuid-789",
            "version": "rf-2026-v1",
            "algorithm": "random_forest",
            "dataset_id": "dataset-uuid-123",
            "lifecycle_state": "CANDIDATE",
            "classes": {"positive_class": "RISK", "negative_class": "NO_RISK", "event_code": "RETENTION_RISK"},
        }
        metrics = {"accuracy": 0.85, "f1_score": 0.82}
        training_config = {"algorithm": "random_forest", "seed": 42}
        balance_report = {"technique": "SMOTE", "applied_to": "train_only"}
        feature_names = ["materias_cursadas", "materias_aprobadas"]
        dependency_lock = {"python": "3.14", "scikit_learn": "1.7.0"}
        dataset_ref = {"dataset_ref": "fixture:pred003-synthetic-v1"}

        result_manifest = write_training_artifacts(
            job_id=job_id,
            artifacts_dir=self.artifacts_dir,
            model=model,
            preprocessing_pipeline=pipeline,
            manifest=manifest,
            metrics=metrics,
            training_config=training_config,
            balance_report=balance_report,
            feature_names=feature_names,
            dependency_lock=dependency_lock,
            dataset_ref=dataset_ref,
        )

        job_dir = self.artifacts_dir / job_id
        self.assertTrue((job_dir / "model.joblib").exists())
        self.assertTrue((job_dir / "pipeline.joblib").exists())
        self.assertTrue((job_dir / "metrics.json").exists())
        self.assertTrue((job_dir / "training_config.json").exists())
        self.assertTrue((job_dir / "balance_report.json").exists())
        self.assertTrue((job_dir / "feature_names.json").exists())
        self.assertTrue((job_dir / "dependency_lock.json").exists())
        self.assertTrue((job_dir / "dataset_ref.json").exists())
        self.assertTrue((job_dir / "evaluation_report.json").exists())
        self.assertTrue((job_dir / "manifest.json").exists())

        # Verify digest was computed and added
        self.assertIn("artifact_digest", result_manifest)
        self.assertEqual(len(result_manifest["artifact_digest"]), 64)

        # Verify saved manifest matches returned manifest
        saved_manifest = json.loads((job_dir / "manifest.json").read_text(encoding="utf-8"))
        self.assertEqual(saved_manifest["artifact_digest"], result_manifest["artifact_digest"])
        self.assertEqual(saved_manifest["lifecycle_state"], "CANDIDATE")
        self.assertIn("pipeline.joblib", saved_manifest["artifact_files"])
        self.assertEqual(saved_manifest["input_schema"]["feature_names"], feature_names)
        self.assertEqual(saved_manifest["probability_definition"]["positive_class"], "RISK")


if __name__ == "__main__":
    unittest.main()
