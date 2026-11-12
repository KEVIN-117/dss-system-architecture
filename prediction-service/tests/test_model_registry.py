from __future__ import annotations

import json
import platform
import tempfile
import unittest
from unittest.mock import patch
from pathlib import Path

import joblib
import sklearn
import xgboost
from sklearn.dummy import DummyClassifier
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

from training.artifact_writer import (
    _compute_bundle_digest,
    _compute_file_digest,
    write_training_artifacts,
)
from training.model_registry import InvalidModelArtifact, ModelRegistry, NoActiveModel


class ModelRegistryTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.registry = ModelRegistry(self.root)

    def tearDown(self) -> None:
        self.temp.cleanup()

    def _candidate(
        self,
        name: str,
        model_id: str,
        version: str = "v1",
        feature_names: tuple[str, ...] = ("score",),
        event_code: str = "RETENTION_RISK",
        cadence: str | None = None,
        threshold: float | None = None,
        evaluated_threshold: float | None = None,
    ) -> tuple[Path, Path]:
        values = [
            [float(row + column) for column in range(len(feature_names))]
            for row in range(1, 5)
        ]
        model = DummyClassifier(strategy="prior").fit(values, [0, 0, 1, 1])
        pipeline = Pipeline([("scale", StandardScaler())]).fit(values)
        manifest = {
            "contract_version": "1.0", "model_id": model_id, "version": version, "algorithm": "random_forest",
            "dataset_id": "dataset-v1", "input_schema_version": "raw-v1",
            "classes": {"positive_class": "RISK", "negative_class": "NO_RISK", "event_code": event_code},
            "created_at": "2026-11-02T00:00:00Z", "evaluation_ref": f"eval-{name}", "lifecycle_state": "CANDIDATE",
        }
        if cadence:
            manifest["serving_scope"] = {"event_type": "course_abandonment" if event_code == "COURSE_ABANDONMENT" else "program_dropout", "cadence": cadence, "evaluation_unit": "test_unit"}
        metrics: dict = {"accuracy": 0.8}
        if threshold is not None:
            manifest["decision_threshold"] = threshold
            metrics["decision_threshold"] = threshold if evaluated_threshold is None else evaluated_threshold
        folder = self.root / name
        write_training_artifacts(
            name, self.root, model, pipeline, manifest, metrics, {"evaluation_protocol": {}},
            {"technique": None}, list(feature_names),
            {"python": "3.14.0", "scikit_learn": "test", "xgboost": "test", "joblib": "test"},
            {"dataset_ref": name, "dataset_digest": "digest-dataset"},
        )
        # Set the exact versions used in this test runtime.
        deps = {
            "python": platform.python_version(),
            "scikit_learn": sklearn.__version__,
            "xgboost": xgboost.__version__,
            "joblib": joblib.__version__,
        }
        (folder / "dependency_lock.json").write_text(json.dumps(deps), encoding="utf-8")
        current = self._refresh_manifest(folder, "dependency_lock.json")
        report = {
            "decision_status": "APTO",
            "crisp_dm_next_step": {"deployment_allowed": True},
            "evidence_kind": "institutional_evaluation",
            "dataset": {"fixture_only": False, "dataset_digest": "digest-dataset"},
            "evaluation_identity": {"classes": manifest["classes"]},
            "candidate_selection_status": "SELECTED_BY_VALIDATION",
            "selected_candidate_by_validation": model_id,
            "models": [{"model_id": model_id, "version": version, "artifact_digest": current["artifact_digest"]}],
        }
        report_path = self.root / f"{name}-approval.json"
        report_path.write_text(json.dumps(report), encoding="utf-8")
        return folder, report_path

    @staticmethod
    def _refresh_manifest(folder: Path, changed_file: str) -> dict:
        manifest_path = folder / "manifest.json"
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        manifest["artifact_files"][changed_file] = _compute_file_digest(folder / changed_file)
        manifest["artifact_digest"] = _compute_bundle_digest(manifest)
        manifest_path.write_text(json.dumps(manifest), encoding="utf-8")
        return manifest

    def _refresh_approval_digest(self, report_path: Path, manifest: dict) -> None:
        report = json.loads(report_path.read_text(encoding="utf-8"))
        report["models"][0]["artifact_digest"] = manifest["artifact_digest"]
        report_path.write_text(json.dumps(report), encoding="utf-8")

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

    def test_active_bundle_reloads_after_registry_restart(self) -> None:
        _, report = self._candidate("candidate", "model-1")
        self.registry.promote("model-1", "v1", "operator", report)

        reloaded = ModelRegistry(self.root).active()

        self.assertEqual((reloaded.model_id, reloaded.version), ("model-1", "v1"))
        self.assertEqual(reloaded.model.n_features_in_, reloaded.pipeline.n_features_in_)
        self.assertEqual(reloaded.pipeline.transform([[2.0]]).shape, (1, 1))

    def test_incompatible_python_or_dependency_runtime_rejects_active_bundle(self) -> None:
        _, report = self._candidate("candidate", "model-1")
        self.registry.promote("model-1", "v1", "operator", report)

        with patch("training.model_registry.platform.python_version", return_value="0.0.0"):
            with self.assertRaisesRegex(InvalidModelArtifact, "Python runtime is incompatible"):
                ModelRegistry(self.root).active()

        with patch("importlib.metadata.version", return_value="0.0.0"):
            with self.assertRaisesRegex(InvalidModelArtifact, "differs from artifact lock"):
                ModelRegistry(self.root).active()

    def test_unloadable_candidate_does_not_replace_active_bundle(self) -> None:
        _, active_report = self._candidate("active", "model-1")
        self.registry.promote("model-1", "v1", "operator", active_report)

        candidate_folder, candidate_report = self._candidate("broken", "model-2")
        (candidate_folder / "model.joblib").write_bytes(b"not-a-joblib-model")
        candidate_manifest = self._refresh_manifest(candidate_folder, "model.joblib")
        self._refresh_approval_digest(candidate_report, candidate_manifest)

        with self.assertRaisesRegex(InvalidModelArtifact, "could not be loaded"):
            self.registry.promote("model-2", "v1", "operator", candidate_report)

        active = ModelRegistry(self.root).active()
        self.assertEqual((active.model_id, active.version), ("model-1", "v1"))
        self.assertEqual(active.model.n_features_in_, active.pipeline.n_features_in_)

    def test_version_switch_keeps_model_and_preprocessor_from_same_bundle(self) -> None:
        _, v1_report = self._candidate("v1", "model-1", "v1", ("score",))
        self.registry.promote("model-1", "v1", "operator", v1_report)
        old_bundle = self.registry.active()
        self.assertEqual(old_bundle.model.n_features_in_, old_bundle.pipeline.n_features_in_)

        _, v2_report = self._candidate("v2", "model-1", "v2", ("score", "attendance"))
        self.registry.promote("model-1", "v2", "operator", v2_report)
        new_bundle = ModelRegistry(self.root).active()

        self.assertEqual((new_bundle.model_id, new_bundle.version), ("model-1", "v2"))
        self.assertEqual(new_bundle.model.n_features_in_, 2)
        self.assertEqual(new_bundle.pipeline.n_features_in_, 2)
        self.assertEqual(new_bundle.pipeline.transform([[2.0, 3.0]]).shape, (1, 2))
        self.assertEqual(old_bundle.model.n_features_in_, 1)
        self.assertEqual(old_bundle.pipeline.n_features_in_, 1)

    def test_event_and_cadence_have_independent_active_pointers(self) -> None:
        _, program_report = self._candidate("program", "program-annual", event_code="PROGRAM_DROPOUT_NEXT_EXPECTED_CLOSURE", cadence="ANUAL")
        _, course_report = self._candidate("course", "course-semester", event_code="COURSE_ABANDONMENT", cadence="SEMESTRAL")
        self.registry.promote("program-annual", "v1", "operator", program_report)
        self.registry.promote("course-semester", "v1", "operator", course_report)

        self.assertEqual(self.registry.active("PROGRAM_DROPOUT_NEXT_EXPECTED_CLOSURE", "ANUAL").model_id, "program-annual")
        self.assertEqual(self.registry.active("COURSE_ABANDONMENT", "SEMESTRAL").model_id, "course-semester")
        with self.assertRaises(NoActiveModel):
            self.registry.active("COURSE_ABANDONMENT", "ANUAL")

    def test_scoped_rollback_restores_only_the_requested_event_and_cadence(self) -> None:
        _, first_report = self._candidate("course-first", "course-1", event_code="COURSE_ABANDONMENT", cadence="SEMESTRAL")
        _, other_report = self._candidate("program-other", "program-1", event_code="PROGRAM_DROPOUT_NEXT_EXPECTED_CLOSURE", cadence="ANUAL")
        _, second_report = self._candidate("course-second", "course-2", event_code="COURSE_ABANDONMENT", cadence="SEMESTRAL")
        self.registry.promote("course-1", "v1", "operator", first_report)
        self.registry.promote("program-1", "v1", "operator", other_report)
        self.registry.promote("course-2", "v1", "operator", second_report)

        self.registry.rollback("operator", "COURSE_ABANDONMENT", "SEMESTRAL")

        self.assertEqual(self.registry.active("COURSE_ABANDONMENT", "SEMESTRAL").model_id, "course-1")
        self.assertEqual(self.registry.active("PROGRAM_DROPOUT_NEXT_EXPECTED_CLOSURE", "ANUAL").model_id, "program-1")

    def test_decision_threshold_is_served_from_the_approved_bundle(self) -> None:
        _, report = self._candidate("candidate", "model-1", threshold=0.35)
        self.registry.promote("model-1", "v1", "operator", report)
        self.assertEqual(ModelRegistry(self.root).active().manifest["decision_threshold"], 0.35)

    def test_decision_threshold_cannot_be_changed_after_approval(self) -> None:
        folder, report = self._candidate("candidate", "model-1", threshold=0.35)
        self.registry.promote("model-1", "v1", "operator", report)
        manifest_path = folder / "manifest.json"
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        manifest["decision_threshold"] = 0.01
        manifest_path.write_text(json.dumps(manifest), encoding="utf-8")
        with self.assertRaises(InvalidModelArtifact):
            ModelRegistry(self.root).active()
        # Recomputing the digest still cannot hide the change from the bundle identity.
        self.assertNotEqual(_compute_bundle_digest(manifest), json.loads(
            (self.root / ".model-registry" / "active.json").read_text(encoding="utf-8"))["active"]["artifact_digest"])

    def test_threshold_that_differs_from_evaluation_is_rejected(self) -> None:
        _, report = self._candidate("candidate", "model-1", threshold=0.35, evaluated_threshold=0.5)
        with self.assertRaisesRegex(InvalidModelArtifact, "differs from the evaluated threshold"):
            self.registry.promote("model-1", "v1", "operator", report)

    def test_out_of_range_threshold_is_rejected(self) -> None:
        _, report = self._candidate("candidate", "model-1", threshold=1.5)
        with self.assertRaisesRegex(InvalidModelArtifact, "decision threshold"):
            self.registry.promote("model-1", "v1", "operator", report)

    def test_tampered_bundle_is_rejected_after_restart(self) -> None:
        folder, report = self._candidate("candidate", "model-1")
        self.registry.promote("model-1", "v1", "operator", report)
        (folder / "pipeline.joblib").write_bytes(b"tampered")
        with self.assertRaises(InvalidModelArtifact):
            ModelRegistry(self.root).active()


if __name__ == "__main__":
    unittest.main()
