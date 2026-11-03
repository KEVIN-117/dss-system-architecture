from __future__ import annotations

import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from inference import InferenceFailure, Principal, ProgramContext
from training.population_publication import PopulationPublicationService
from training.prediction_publication_store import PredictionPublicationStore


class Identity:
    def __init__(self, roles=("RECTOR",)):
        self.principal = Principal("actor-1", frozenset(roles), ())

    def authenticate(self, token):
        return self.principal


class Data:
    def resolve_context(self, program_ref, closure_id):
        return ProgramContext(program_ref, program_ref, 3, closure_id, 2026, 2, "2026-10-01T00:00:00+00:00")


class Policy:
    def authorize(self, principal, context):
        if "RECTOR" not in principal.roles:
            raise InferenceFailure("INSUFFICIENT_SCOPE", 403, "outside scope")


class Registry:
    def active(self, event_code, cadence):
        return type("Bundle", (), {"model_id": "rf", "version": "v1"})()


class PopulationPublicationTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.store = PredictionPublicationStore(f"sqlite://{Path(self.tmp.name) / 'publication.sqlite'}")
        self.service = PopulationPublicationService(self.store, Identity(), Data(), Policy(), Registry())
        self.env = patch.dict(os.environ, {"PREDICTION_BATCH_SUBMITTER_ROLES": '["RECTOR"]'})
        self.env.start()

    def tearDown(self):
        self.env.stop()
        self.tmp.cleanup()

    def test_submission_pins_bundle_and_uses_idempotent_outbox(self):
        first = self.service.submit("token", "P01", "42", "idempotency-key-0001")
        retry = self.service.submit("token", "P01", "42", "idempotency-key-0001")
        self.assertEqual(first["batch_id"], retry["batch_id"])
        self.assertEqual(first["status"], "QUEUED")
        self.assertEqual(first["model_version"], "v1")
        self.assertNotIn("authorized_scope", first)
        self.assertEqual(self.store.pending(), [first["batch_id"]])

    def test_explicit_submitter_policy_fails_closed(self):
        self.env.stop()
        with patch.dict(os.environ, {"PREDICTION_BATCH_SUBMITTER_ROLES": "[]"}):
            with self.assertRaises(InferenceFailure) as error:
                self.service.submit("token", "P01", "42", "idempotency-key-0002")
        self.assertEqual(error.exception.status_code, 503)

    def test_account_without_submitter_role_is_rejected(self):
        self.service.identity = Identity(("DIRECTOR",))
        with self.assertRaises(InferenceFailure) as error:
            self.service.submit("token", "P01", "42", "idempotency-key-0003")
        self.assertEqual(error.exception.status_code, 403)


if __name__ == "__main__":
    unittest.main()
