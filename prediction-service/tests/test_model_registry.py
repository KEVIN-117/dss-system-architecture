from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path

from sklearn.dummy import DummyClassifier
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

from training.artifact_writer import write_training_artifacts
from training.model_registry import InvalidModelArtifact, ModelRegistry, NoActiveModel


class ModelRegistryTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.registry = ModelRegistry(self.root)

    def tearDown(self) -> None:
        self.temp.cleanup()

    def _candidate(self, name: str, model_id: str) -> tuple[Path, dict]:
        model = DummyClassifier(strategy="prior").fit([[1.0], [2.0], [3.0], [4.0]], [0, 0, 1, 1])
        pipeline = Pipeline([("scale", StandardScaler())]).fit([[1.0], [2.0], [3.0], [4.0]])
        manifest = {
            "contract_version": "1.0", "model_id": model_id, "version": "v1", "algorithm": "random_forest",
            "dataset_id": "dataset-v1", "input_schema_version": "raw-v1",
            "classes": {"positive_class": "RISK", "negative_class": "NO_RISK", "event_code": "RETENTION_RISK"},
            "created_at": "2026-11-02T00:00:00Z", "evaluation_ref": f"eval-{name}", "lifecycle_state": "CANDIDATE",
        }
        folder = self.root / name
        result = write_training_artifacts(
            name, self.root, model, pipeline, manifest, {"accuracy": 0.8}, {"evaluation_protocol": {}},
            {"technique": None}, ["score"],
            {"python": "3.14.0", "scikit_learn": "test", "xgboost": "test", "joblib": "test"},
            {"dataset_ref": name, "dataset_digest": "digest-dataset"},
        )
        # Set the exact versions used in this test runtime.
        import joblib, sklearn, xgboost
        deps = {"python": __import__("platform").python_version(), "scikit_learn": sklearn.__version__, "xgboost": xgboost.__version__, "joblib": joblib.__version__}
        (folder / "dependency_lock.json").write_text(json.dumps(deps), encoding="utf-8")
        # Refresh the dependency digest and manifest digest for this isolated fixture.
        from training.artifact_writer import _compute_bundle_digest, _compute_file_digest
        current = json.loads((folder / "manifest.json").read_text(encoding="utf-8"))
        current["artifact_files"]["dependency_lock.json"] = _compute_file_digest(folder / "dependency_lock.json")
        current["artifact_digest"] = _compute_bundle_digest(current)
        (folder / "manifest.json").write_text(json.dumps(current), encoding="utf-8")
        report = {
            "decision_status": "APTO",
            "crisp_dm_next_step": {"deployment_allowed": True},
            "evidence_kind": "institutional_evaluation",
            "dataset": {"fixture_only": False, "dataset_digest": "digest-dataset"},
            "evaluation_identity": {"classes": manifest["classes"]},
            "candidate_selection_status": "SELECTED_BY_VALIDATION",
            "selected_candidate_by_validation": model_id,
            "models": [{"model_id": model_id, "version": result["version"], "artifact_digest": current["artifact_digest"]}],
        }
        report_path = self.root / f"{name}-approval.json"
        report_path.write_text(json.dumps(report), encoding="utf-8")
        return folder, report_path

    def test_no_active_model_is_explicit(self) -> None:
        with self.assertRaises(NoActiveModel):
            self.registry.active()

    def test_only_explicitly_approved_evidence_can_be_activated(self) -> None:
        folder, report = self._candidate("candidate", "model-1")
        report_data = json.loads(report.read_text(encoding="utf-8"))
        report_data["decision_status"] = "EVIDENCIA_INSUFICIENTE"
        report.write_text(json.dumps(report_data), encoding="utf-8")
        with self.assertRaises(InvalidModelArtifact):
            self.registry.promote("model-1", "v1", "operator", report)
        self.assertFalse(self.registry.active_path.exists())

    def test_promotion_rolls_back_to_a_complete_previous_bundle(self) -> None:
        _, first_report = self._candidate("first", "model-1")
        self.registry.promote("model-1", "v1", "operator", first_report)
        first = self.registry.active()
        _, second_report = self._candidate("second", "model-2")
        self.registry.promote("model-2", "v1", "operator", second_report)
        self.assertEqual(self.registry.active().model_id, "model-2")
        self.registry.rollback("operator")
        restored = self.registry.active()
        self.assertEqual(restored.model_id, first.model_id)
        self.assertEqual(restored.pipeline.transform([[2.0]]).shape, (1, 1))

    def test_tampered_bundle_is_rejected_after_restart(self) -> None:
        folder, report = self._candidate("candidate", "model-1")
        self.registry.promote("model-1", "v1", "operator", report)
        (folder / "pipeline.joblib").write_bytes(b"tampered")
        with self.assertRaises(InvalidModelArtifact):
            ModelRegistry(self.root).active()


if __name__ == "__main__":
    unittest.main()
