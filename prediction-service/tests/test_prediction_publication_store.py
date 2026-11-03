from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from training.prediction_publication_store import PredictionPublicationStore


class PredictionPublicationStoreTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.store = PredictionPublicationStore(f"sqlite://{Path(self.tmp.name) / 'publication.sqlite'}")

    def tearDown(self):
        self.tmp.cleanup()

    def _batch(self, batch_id: str, key: str = "idempotency-key-0001"):
        return {
            "batch_id": batch_id,
            "idempotency_key": key,
            "request_digest": PredictionPublicationStore.digest("P01", "42", "rf", "1"),
            "event_code": "PROGRAM_DROPOUT_NEXT_EXPECTED_CLOSURE",
            "program_ref": "P01",
            "closure_id": "42",
            "model_id": "rf",
            "model_version": "1",
            "submitted_by": "actor-1",
            "authorized_scope": {"kind": "program", "program_ref": "P01", "faculty_id": 3, "roles": ["RECTOR"]},
            "created_at": "2026-11-03T10:00:00+00:00",
        }

    def test_running_batch_is_hidden_until_results_and_status_commit_together(self):
        batch = self.store.create(self._batch("batch-a"), "actor-1")
        self.assertEqual(batch["status"], "QUEUED")
        self.assertTrue(self.store.claim("batch-a"))
        self.assertIsNone(self.store.current("P01", "42"))
        self.assertNotIn("results", self.store.get("batch-a", include_results=True))

        self.store.publish("batch-a", [{
            "subject_ref": "student-1", "program_ref": "P01", "closure_id": "42",
            "predicted_class": "POSITIVE_EVENT", "event_probability": 0.75,
            "model_id": "rf", "model_version": "1", "generated_at": "2026-11-03T10:01:00+00:00",
        }], ["6f811a64-f88c-4a0d-8bd3-6d359beaf498"])
        current = self.store.current("P01", "42")
        self.assertEqual(current["status"], "PUBLISHED")
        publication = self.store.get("batch-a", include_results=True)
        self.assertEqual(publication["result_count"], 1)
        self.assertEqual(publication["results"][0]["model_version"], "1")

    def test_failed_or_queued_recalculation_does_not_replace_current_publication(self):
        first = self._batch("batch-a")
        self.store.create(first, "actor-1")
        self.store.claim("batch-a")
        self.store.publish("batch-a", [], [])
        second = self._batch("batch-b", "idempotency-key-0002")
        self.store.create(second, "actor-1")
        self.store.fail("batch-b", {"code": "FAILED"})
        self.assertEqual(self.store.current("P01", "42")["batch_id"], "batch-a")

    def test_idempotency_rejects_reuse_for_different_request(self):
        self.store.create(self._batch("batch-a"), "actor-1")
        changed = self._batch("batch-b")
        changed["request_digest"] = "0" * 64
        with self.assertRaises(ValueError):
            self.store.create(changed, "actor-1")

    def test_outbox_pending_and_dispatch_state(self):
        self.store.create(self._batch("batch-a"), "actor-1")
        self.assertEqual(self.store.pending(), ["batch-a"])
        self.store.mark_dispatched("batch-a", RuntimeError("broker down"))
        self.assertEqual(self.store.pending(), [])


if __name__ == "__main__":
    unittest.main()
