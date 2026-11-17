"""HTTP contract of the admin model registry endpoints."""
from __future__ import annotations

import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from fastapi.testclient import TestClient

from main import app
from tests.test_model_admin_activation import APPROVED_DATASET, EVENT, build_candidate
from tests.test_training_api import FakeIdentity


class ModelAdminApiTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.env = patch.dict("os.environ", {"WORKER_ARTIFACTS_DIR": str(self.root)})
        self.env.start()
        app.state.identity_provider = FakeIdentity()
        self.client = TestClient(app)
        self.operator = TestClient(app, headers={"Authorization": "Bearer operator-token"})
        self.rector = TestClient(app, headers={"Authorization": "Bearer rector-token"})
        build_candidate(self.root, "approved", "model-a")
        build_candidate(self.root, "explore", "model-b", dataset={**APPROVED_DATASET, "exploratory_only": True})

    def tearDown(self) -> None:
        del app.state.identity_provider
        self.env.stop()
        self.temp.cleanup()

    def test_only_ml_operators_can_use_the_registry(self) -> None:
        self.assertEqual(self.client.get("/v1/models").status_code, 401)
        self.assertEqual(self.rector.get("/v1/models").status_code, 403)
        body = {"model_id": "model-a", "version": "v1", "reason": "activar"}
        self.assertEqual(self.rector.post("/v1/models/activate", json=body).status_code, 403)
        self.assertEqual(self.rector.post("/v1/models/deactivate",
                                          json={"event_code": EVENT, "cadence": "SEMESTRAL", "reason": "x" * 5}).status_code, 403)

    def test_lists_models_with_metrics(self) -> None:
        response = self.operator.get("/v1/models")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.headers["cache-control"], "no-store")
        data = response.json()
        models = {item["model_id"]: item for item in data["models"]}
        self.assertEqual(set(models), {"model-a", "model-b"})
        self.assertTrue(models["model-a"]["activatable"])
        self.assertFalse(models["model-b"]["activatable"])
        self.assertEqual(models["model-a"]["test_metrics"]["f1_score"], 0.56)
        self.assertEqual(data["active_by_scope"], {})
        self.assertEqual(data["events"], [])

    def test_activate_and_deactivate_are_audited_with_the_token_subject(self) -> None:
        activated = self.operator.post("/v1/models/activate",
                                       json={"model_id": "model-a", "version": "v1", "reason": "Mejor recall"})
        self.assertEqual(activated.status_code, 200, activated.text)
        self.assertEqual(activated.json()["active"]["approved_by"], "operator-1")
        listing = self.operator.get("/v1/models").json()
        self.assertIn(f"{EVENT}|SEMESTRAL", listing["active_by_scope"])
        self.assertTrue(next(m for m in listing["models"] if m["model_id"] == "model-a")["is_active"])

        deactivated = self.operator.post("/v1/models/deactivate",
                                         json={"event_code": EVENT, "cadence": "SEMESTRAL", "reason": "Revisión"})
        self.assertEqual(deactivated.status_code, 200, deactivated.text)
        self.assertEqual(deactivated.json()["event"]["approved_by"], "operator-1")
        listing = self.operator.get("/v1/models").json()
        self.assertEqual(listing["active_by_scope"], {})
        self.assertEqual([e["action"] for e in listing["events"]], ["ACTIVATE", "DEACTIVATE"])

    def test_unapproved_candidate_and_missing_scope_are_conflicts(self) -> None:
        rejected = self.operator.post("/v1/models/activate",
                                      json={"model_id": "model-b", "version": "v1", "reason": "intento"})
        self.assertEqual(rejected.status_code, 409)
        self.assertEqual(rejected.json()["code"], "MODEL_NOT_ACTIVATABLE")
        nothing = self.operator.post("/v1/models/deactivate",
                                     json={"event_code": EVENT, "cadence": "SEMESTRAL", "reason": "nada"})
        self.assertEqual(nothing.status_code, 409)
        self.assertEqual(nothing.json()["code"], "NO_ACTIVE_MODEL")

    def test_request_bodies_are_validated(self) -> None:
        self.assertEqual(self.operator.post("/v1/models/activate",
                                            json={"model_id": "../x", "version": "v1", "reason": "abc"}).status_code, 422)
        self.assertEqual(self.operator.post("/v1/models/activate",
                                            json={"model_id": "model-a", "version": "v1", "reason": ""}).status_code, 422)
        self.assertEqual(self.operator.post("/v1/models/deactivate",
                                            json={"event_code": "OTHER", "cadence": "SEMESTRAL", "reason": "abc"}).status_code, 422)


if __name__ == "__main__":
    unittest.main()
