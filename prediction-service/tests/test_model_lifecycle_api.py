"""PRED-105: model comparison, rollback and history -- registry and HTTP contract."""
from __future__ import annotations

import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from fastapi.testclient import TestClient

from main import app
from preparation.pipeline import prepare_for_task
from tests.test_model_admin_activation import APPROVED_DATASET, EVENT, build_candidate
from tests.test_pred103_targets import STUDENT_CUTS, STUDENT_FEATURES, student_rows, write_bundle
from tests.test_training_api import FakeIdentity
from feature_contract import STUDENT_GPA_EVENT
from training.model_registry import ModelRegistry, NoActiveModel
from training.student_extract import build_student_next_cut_snapshot
from training.trainer import train_for_partition


class RollbackChainTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.registry = ModelRegistry(self.root)
        for name in ("a", "b", "c"):
            build_candidate(self.root, name, f"model-{name}", version=f"v-{name}")

    def tearDown(self) -> None:
        self.temp.cleanup()

    def _activate(self, name: str) -> None:
        self.registry.activate(f"model-{name}", f"v-{name}", "op", f"activar {name}")

    def _active(self) -> str:
        return self.registry.active(EVENT, "SEMESTRAL").model_id

    def test_portal_activations_can_be_rolled_back_step_by_step(self) -> None:
        for name in ("a", "b", "c"):
            self._activate(name)
        self.registry.rollback("op", EVENT, "SEMESTRAL", "métricas peores")
        self.assertEqual(self._active(), "model-b")
        # A second rollback keeps walking back instead of toggling to C.
        self.registry.rollback("op", EVENT, "SEMESTRAL", "otra vez")
        self.assertEqual(self._active(), "model-a")
        with self.assertRaises(NoActiveModel):
            self.registry.rollback("op", EVENT, "SEMESTRAL", "nada antes de A")
        event = self.registry.registry_state()["events"][-1]
        self.assertEqual((event["action"], event["reason"], event["previous"]["model_id"]),
                         ("ROLLBACK", "otra vez", "model-b"))

    def test_rollback_after_deactivation_restores_the_last_active_model(self) -> None:
        self._activate("a")
        self._activate("b")
        self.registry.deactivate(EVENT, "SEMESTRAL", "op", "revisión")
        self.registry.rollback("op", EVENT, "SEMESTRAL", "volver")
        self.assertEqual(self._active(), "model-b")

    def test_reactivating_an_older_model_extends_the_chain(self) -> None:
        for name in ("a", "b", "a"):
            self._activate(name)
        self.registry.rollback("op", EVENT, "SEMESTRAL", "deshacer")
        self.assertEqual(self._active(), "model-b")

    def test_rollback_requires_an_operator_and_a_real_reason(self) -> None:
        self._activate("a")
        self._activate("b")
        with self.assertRaises(ValueError):
            self.registry.rollback(" ", EVENT, "SEMESTRAL", "motivo")
        with self.assertRaises(ValueError):
            self.registry.rollback("op", EVENT, "SEMESTRAL", "  ")

    def test_history_lists_the_events_of_one_model(self) -> None:
        for name in ("a", "b"):
            self._activate(name)
        self.registry.rollback("op", EVENT, "SEMESTRAL", "volver a A")
        actions = [event["action"] for event in self.registry.model_history("model-a")]
        self.assertEqual(actions, ["ACTIVATE", "ACTIVATE", "ROLLBACK"])
        self.assertEqual([e["action"] for e in self.registry.model_history("model-c")], [])


class ModelLifecycleApiTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.env = patch.dict("os.environ", {"WORKER_ARTIFACTS_DIR": str(self.root)})
        self.env.start()
        app.state.identity_provider = FakeIdentity()
        self.operator = TestClient(app, headers={"Authorization": "Bearer operator-token"})
        self.rector = TestClient(app, headers={"Authorization": "Bearer rector-token"})
        for name in ("a", "b"):
            build_candidate(self.root, name, f"model-{name}", version=f"v-{name}")
        build_candidate(self.root, "synthetic", "model-s", dataset={**APPROVED_DATASET, "fixture_only": True})

    def tearDown(self) -> None:
        del app.state.identity_provider
        self.env.stop()
        self.temp.cleanup()

    def _activate(self, name: str) -> None:
        response = self.operator.post("/v1/models/activate", json={"model_id": f"model-{name}", "version": f"v-{name}",
                                                                   "reason": f"activar {name}"})
        self.assertEqual(response.status_code, 200, response.text)

    def test_rollback_endpoint(self) -> None:
        body = {"event_code": EVENT, "cadence": "SEMESTRAL", "reason": "peores métricas"}
        self.assertEqual(self.rector.post("/v1/models/rollback", json=body).status_code, 403)
        nothing = self.operator.post("/v1/models/rollback", json=body)
        self.assertEqual((nothing.status_code, nothing.json()["code"]), (409, "NO_PREVIOUS_MODEL"))
        self._activate("a")
        self._activate("b")
        response = self.operator.post("/v1/models/rollback", json=body)
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json()["active"]["model_id"], "model-a")
        self.assertEqual(response.json()["active"]["approved_by"], "operator-1")
        self.assertEqual(self.operator.post("/v1/models/rollback", json={**body, "reason": ""}).status_code, 422)
        self.assertEqual(self.operator.post("/v1/models/rollback",
                                            json={**body, "event_code": "UNKNOWN"}).status_code, 422)

    def test_history_endpoint(self) -> None:
        self._activate("a")
        self._activate("b")
        history = self.operator.get("/v1/models/model-a/history")
        self.assertEqual(history.status_code, 200, history.text)
        data = history.json()
        self.assertEqual((data["event_code"], data["cadence"]), (EVENT, "SEMESTRAL"))
        self.assertEqual([e["action"] for e in data["events"]], ["ACTIVATE", "ACTIVATE"])
        self.assertEqual(self.operator.get("/v1/models/missing/history").status_code, 404)
        self.assertEqual(self.rector.get("/v1/models/model-a/history").status_code, 403)

    def test_compare_rejects_bad_requests(self) -> None:
        self.assertEqual(self.operator.get("/v1/models/compare?ids=model-a").status_code, 422)
        self.assertEqual(self.operator.get("/v1/models/compare?ids=model-a,missing").status_code, 404)
        # Bundles without a shared evaluation partition cannot be compared.
        incomparable = self.operator.get("/v1/models/compare?ids=model-a,model-b")
        self.assertEqual((incomparable.status_code, incomparable.json()["code"]), (422, "INCOMPARABLE_MODELS"))
        self.assertEqual(self.rector.get("/v1/models/compare?ids=model-a,model-b").status_code, 403)


class CompareTrainedCandidatesApiTests(unittest.TestCase):
    def test_compares_real_candidates_and_marks_a_unique_winner_apto(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            manifest, rows = build_student_next_cut_snapshot(
                student_rows(), task_code=STUDENT_GPA_EVENT, program_ref="P01", cadence="SEMESTRAL",
                feature_names=STUDENT_FEATURES, cuts=STUDENT_CUTS, pseudonym_key=b"k" * 32)
            manifest["dataset_id"] = "0b4f7c1e-1d2a-4f5b-8c6d-7e8f9a0b1f01"
            partition = prepare_for_task(manifest, rows, seed=7)
            ids = []
            for name, algorithm, grid in (("ridge", "ridge", {"alpha": [1.0]}),
                                          ("rf", "random_forest", {"n_estimators": [20], "max_depth": [3],
                                                                   "min_samples_leaf": [1]})):
                result = train_for_partition(partition, algorithm, config={"search_space": grid}, cpu_limit=1,
                                             cv_splits=3)
                write_bundle(root, name, partition, result, manifest)
                ids.append(result.manifest["model_id"])
            with patch.dict("os.environ", {"WORKER_ARTIFACTS_DIR": str(root)}):
                app.state.identity_provider = FakeIdentity()
                try:
                    client = TestClient(app, headers={"Authorization": "Bearer operator-token"})
                    response = client.get(f"/v1/models/compare?ids={','.join(ids)}")
                finally:
                    del app.state.identity_provider
            self.assertEqual(response.status_code, 200, response.text)
            report = response.json()
            self.assertEqual(report["task_kind"], "regression")
            self.assertEqual(report["decision_status"], "APTO")
            self.assertTrue(report["crisp_dm_next_step"]["deployment_allowed"])
            self.assertIn(report["selected_candidate_by_validation"], ids)
            self.assertTrue(all("training_config" not in model for model in report["models"]))


if __name__ == "__main__":
    unittest.main()
