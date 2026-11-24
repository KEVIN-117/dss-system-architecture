"""Activation and deactivation of models from the admin portal (no PRED-004 report)."""
from __future__ import annotations

import json
import platform
import tempfile
import unittest
from pathlib import Path

import joblib
import sklearn
import xgboost
from sklearn.dummy import DummyClassifier
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

from training.artifact_writer import _compute_bundle_digest, _compute_file_digest, write_training_artifacts
from training.model_registry import ADMIN_ACTIVATION, InvalidModelArtifact, ModelRegistry, NoActiveModel

EVENT = "PROGRAM_DROPOUT_NEXT_EXPECTED_CLOSURE"
APPROVED_DATASET = {
    "dataset_ref": "custom:ds-1", "dataset_id": "ds-1", "dataset_digest": "digest-dataset", "fixture_only": False,
    "target_definition_ref": "dsa:objetivo:2026-001:v1", "population_definition_ref": "dsa:poblacion:2026-002:v1",
}


def build_candidate(root: Path, name: str, model_id: str, version: str = "v1", dataset: dict | None = None,
                    cadence: str | None = "SEMESTRAL", evidence_kind: str = "institutional_unverified") -> Path:
    """Write a complete, loadable candidate bundle under ``root``."""
    values = [[float(row)] for row in range(1, 5)]
    model = DummyClassifier(strategy="prior").fit(values, [0, 0, 1, 1])
    pipeline = Pipeline([("scale", StandardScaler())]).fit(values)
    manifest = {
        "contract_version": "1.0", "model_id": model_id, "version": version, "algorithm": "random_forest",
        "dataset_id": "ds-1", "input_schema_version": "raw-v1",
        "classes": {"positive_class": "RISK", "negative_class": "NO_RISK", "event_code": EVENT},
        "created_at": f"2026-11-16T00:00:0{len(name) % 10}Z", "evaluation_ref": f"eval-{name}",
        "lifecycle_state": "CANDIDATE",
    }
    if cadence:
        manifest["serving_scope"] = {"event_type": "program_dropout", "cadence": cadence, "evaluation_unit": "unit"}
    metrics = {
        "recall": 0.64, "precision": 0.5, "f1_score": 0.56, "roc_auc": 0.88, "pr_auc": 0.53,
        "holdout_alert_rate": 0.17, "test_row_count": 100,
        "per_class": {"0": {"class_name": "NO_RISK", "recall": 0.9, "precision": 0.94, "f1_score": 0.92, "support": 87},
                      "1": {"class_name": "RISK", "recall": 0.64, "precision": 0.5, "f1_score": 0.56, "support": 13}},
        "confusion_matrix": {"rows": "actual", "columns": "predicted", "label_names": ["NO_RISK", "RISK"],
                             "values": [[78, 9], [5, 8]]},
    }
    config = {"evaluation_protocol": {"split": {"evidence_kind": evidence_kind}},
              "tuning": {"best_mean_recall": 0.66, "best_mean_f1": 0.58, "method": "StratifiedGroupKFold", "n_splits": 5}}
    write_training_artifacts(
        name, root, model, pipeline, manifest, metrics, config, {"technique": None}, ["score"],
        {"python": "3.14.0", "scikit_learn": "test", "xgboost": "test", "joblib": "test"},
        dataset if dataset is not None else APPROVED_DATASET,
    )
    folder = root / name
    deps = {"python": platform.python_version(), "scikit_learn": sklearn.__version__,
            "xgboost": xgboost.__version__, "joblib": joblib.__version__}
    (folder / "dependency_lock.json").write_text(json.dumps(deps), encoding="utf-8")
    manifest_path = folder / "manifest.json"
    current = json.loads(manifest_path.read_text(encoding="utf-8"))
    current["artifact_files"]["dependency_lock.json"] = _compute_file_digest(folder / "dependency_lock.json")
    current["artifact_digest"] = _compute_bundle_digest(current)
    manifest_path.write_text(json.dumps(current), encoding="utf-8")
    return folder


class AdminActivationTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.registry = ModelRegistry(self.root)

    def tearDown(self) -> None:
        self.temp.cleanup()

    def _candidate(self, name: str, model_id: str, **kwargs) -> Path:
        return build_candidate(self.root, name, model_id, **kwargs)

    def test_lists_candidates_with_metrics_and_activation_eligibility(self) -> None:
        self._candidate("approved", "model-a")
        self._candidate("explore", "model-b", dataset={**APPROVED_DATASET, "exploratory_only": True})
        self._candidate("synthetic", "model-c", dataset={**APPROVED_DATASET, "fixture_only": True})
        models = {item["model_id"]: item for item in self.registry.list_models()}
        self.assertTrue(models["model-a"]["activatable"])
        self.assertIsNone(models["model-a"]["not_activatable_reason"])
        self.assertEqual(models["model-a"]["test_metrics"]["recall"], 0.64)
        self.assertEqual(models["model-a"]["test_metrics"]["f1_score"], 0.56)
        self.assertEqual(models["model-a"]["validation"]["mean_recall"], 0.66)
        self.assertEqual(models["model-a"]["confusion_matrix"]["values"], [[78, 9], [5, 8]])
        self.assertEqual([c["class_name"] for c in models["model-a"]["per_class"]], ["NO_RISK", "RISK"])
        self.assertEqual(models["model-a"]["scope_key"], f"{EVENT}|SEMESTRAL")
        # Without the DSA requirement, real exploratory data is activatable;
        # only synthetic fixtures stay blocked.
        self.assertTrue(models["model-b"]["activatable"])
        self.assertIsNone(models["model-b"]["not_activatable_reason"])
        self.assertEqual(models["model-b"]["dataset"]["evidence_kind"], "exploratory_unapproved")
        self.assertFalse(models["model-c"]["activatable"])
        self.assertIn("sintéticos", models["model-c"]["not_activatable_reason"])

    def test_admin_activation_serves_the_model_and_is_audited(self) -> None:
        self._candidate("approved", "model-a")
        pointer = self.registry.activate("model-a", "v1", "admin-subject", "Mejor recall en validación")
        self.assertEqual(pointer["activation_kind"], ADMIN_ACTIVATION)
        loaded = self.registry.active(EVENT, "SEMESTRAL")
        self.assertEqual((loaded.model_id, loaded.version), ("model-a", "v1"))
        event = self.registry.registry_state()["events"][-1]
        self.assertEqual((event["action"], event["approved_by"], event["reason"]),
                         ("ACTIVATE", "admin-subject", "Mejor recall en validación"))
        self.assertTrue(next(m for m in self.registry.list_models() if m["model_id"] == "model-a")["is_active"])
        # The model keeps loading after a restart of the registry.
        self.assertEqual(ModelRegistry(self.root).active(EVENT, "SEMESTRAL").model_id, "model-a")

    def test_synthetic_data_cannot_be_activated(self) -> None:
        self._candidate("synthetic", "model-c", dataset={**APPROVED_DATASET, "fixture_only": True})
        with self.assertRaises(InvalidModelArtifact):
            self.registry.activate("model-c", "v1", "admin-subject", "intento")
        self.assertFalse(self.registry.active_path.exists())

    def test_real_data_without_dsa_references_can_be_activated(self) -> None:
        self._candidate("explore", "model-b", dataset={**APPROVED_DATASET, "exploratory_only": True})
        self._candidate("norefs", "model-d", version="v2",
                        dataset={"dataset_ref": "custom:x", "dataset_digest": "d", "fixture_only": False})
        self.registry.activate("model-b", "v1", "admin-subject", "Exploratorio sin DSA")
        self.assertEqual(self.registry.active(EVENT, "SEMESTRAL").model_id, "model-b")
        self.registry.activate("model-d", "v2", "admin-subject", "Sin referencias DSA")
        self.assertEqual(self.registry.active(EVENT, "SEMESTRAL").model_id, "model-d")

    def test_activation_requires_operator_and_reason(self) -> None:
        self._candidate("approved", "model-a")
        with self.assertRaises(ValueError):
            self.registry.activate("model-a", "v1", " ", "motivo")
        with self.assertRaises(ValueError):
            self.registry.activate("model-a", "v1", "admin-subject", " ")

    def test_activating_another_candidate_replaces_only_its_scope(self) -> None:
        self._candidate("first", "model-a")
        self._candidate("second", "model-b", version="v2")
        self.registry.activate("model-a", "v1", "admin-subject", "primero")
        self.registry.activate("model-b", "v2", "admin-subject", "segundo")
        self.assertEqual(self.registry.active(EVENT, "SEMESTRAL").model_id, "model-b")
        self.assertEqual(self.registry.registry_state()["events"][-1]["previous"]["model_id"], "model-a")
        # Reactivating the earlier candidate is the way back.
        self.registry.activate("model-a", "v1", "admin-subject", "volver")
        self.assertEqual(self.registry.active(EVENT, "SEMESTRAL").model_id, "model-a")

    def test_deactivation_leaves_the_scope_without_a_model(self) -> None:
        self._candidate("approved", "model-a")
        self.registry.activate("model-a", "v1", "admin-subject", "activar")
        event = self.registry.deactivate(EVENT, "SEMESTRAL", "admin-subject", "Revisión de métricas")
        self.assertEqual((event["action"], event["previous"]["model_id"]), ("DEACTIVATE", "model-a"))
        with self.assertRaises(NoActiveModel):
            self.registry.active(EVENT, "SEMESTRAL")
        with self.assertRaises(NoActiveModel):
            self.registry.active()
        self.assertFalse(next(m for m in self.registry.list_models() if m["model_id"] == "model-a")["is_active"])
        with self.assertRaises(NoActiveModel):
            self.registry.deactivate(EVENT, "SEMESTRAL", "admin-subject", "otra vez")

    def test_tampered_activation_record_stops_serving(self) -> None:
        self._candidate("approved", "model-a")
        pointer = self.registry.activate("model-a", "v1", "admin-subject", "activar")
        record = self.root / pointer["approval_report_ref"]
        data = json.loads(record.read_text(encoding="utf-8"))
        data["evidence_kind"] = "synthetic_fixture"
        record.write_text(json.dumps(data), encoding="utf-8")
        with self.assertRaises(InvalidModelArtifact):
            ModelRegistry(self.root).active(EVENT, "SEMESTRAL")


if __name__ == "__main__":
    unittest.main()
