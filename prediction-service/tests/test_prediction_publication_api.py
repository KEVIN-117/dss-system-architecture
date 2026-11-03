from __future__ import annotations

import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient

from inference import InferenceFailure
from main import app


class FakePublicationService:
    def __init__(self):
        # Match the production service surface: the dispatcher drains the
        # committed outbox from this store after the service creates a batch.
        self.store = object()

    def submit(self, token, program_ref, cut_id, idempotency_key):
        if token != "valid-token":
            raise InferenceFailure("INVALID_TOKEN", 401, "invalid")
        return {"batch_id": "9f321dd1-51cc-4da5-85d2-c6b686cbdf40", "status": "QUEUED", "program_ref": program_ref, "closure_id": cut_id}

    def current(self, token, program_ref, cut_id, limit, offset):
        if token != "valid-token":
            raise InferenceFailure("INVALID_TOKEN", 401, "invalid")
        return {"publication": None}

    def get_batch(self, token, batch_id, limit, offset):
        if token == "out-of-scope":
            raise InferenceFailure("INSUFFICIENT_SCOPE", 403, "outside scope")
        if token != "valid-token":
            raise InferenceFailure("INVALID_TOKEN", 401, "invalid")
        return {"batch_id": batch_id, "status": "PUBLISHED", "results": []}


class PredictionPublicationApiTests(unittest.TestCase):
    def setUp(self):
        app.state.publication_service = FakePublicationService()
        self.client = TestClient(app)

    def tearDown(self):
        del app.state.publication_service

    @patch("main._dispatch_pending_prediction_batches")
    def test_submit_returns_accepted_and_dispatches_committed_batch(self, dispatch):
        response = self.client.post("/v1/prediction-batches", json={
            "contract_version": "1.0", "event_type": "program_dropout", "program_ref": "P01",
            "academic_cut": {"cut_id": "42"},
        }, headers={"Authorization": "Bearer valid-token", "Idempotency-Key": "population-idempotency-01"})
        self.assertEqual(response.status_code, 202)
        self.assertEqual(response.json()["status"], "QUEUED")
        dispatch.assert_called_once_with(self.client.app.state.publication_service.store)

    def test_submit_and_query_require_authentication(self):
        response = self.client.post("/v1/prediction-batches", json={
            "program_ref": "P01", "academic_cut": {"cut_id": "42"},
        }, headers={"Idempotency-Key": "population-idempotency-02"})
        self.assertEqual(response.status_code, 401)
        response = self.client.get("/v1/prediction-publications?program_ref=P01&cut_id=42")
        self.assertEqual(response.status_code, 401)

    def test_empty_current_publication_is_explicit(self):
        response = self.client.get("/v1/prediction-publications?program_ref=P01&cut_id=42", headers={"Authorization": "Bearer valid-token"})
        self.assertEqual(response.status_code, 200)
        self.assertIsNone(response.json()["publication"])

    def test_batch_detail_propagates_server_side_scope_rejection(self):
        response = self.client.get("/v1/prediction-batches/9f321dd1-51cc-4da5-85d2-c6b686cbdf40", headers={"Authorization": "Bearer out-of-scope"})
        self.assertEqual(response.status_code, 403)


if __name__ == "__main__":
    unittest.main()
