"""Attempt limits, fencing tokens, cancellation and admission control (PRED-011)."""

from __future__ import annotations

import os
import sqlite3
from contextlib import closing
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from fastapi.testclient import TestClient

from inference import InferenceFailure, Principal, ProgramContext
from main import app
from training.job_store import JobStatus, JobStore, TrainingJobRecord
from training.population_publication import PopulationPublicationService
from training.prediction_publication_store import PredictionPublicationStore, PublicationConflict

EXPIRED = "2000-01-01 00:00:00"
JOB_ID = "6b0a8f5e-3c0f-4a9e-9d7a-0d3f1c2b4a10"


def _record(job_id: str = JOB_ID, key: str = "robustness-key-0001") -> TrainingJobRecord:
    return TrainingJobRecord(
        job_id=job_id, dataset_ref="fixture:pred003_synthetic-v1", algorithm="random_forest",
        status=JobStatus.QUEUED, created_at="2026-11-12T10:00:00+00:00", started_at=None,
        finished_at=None, submitted_by="operator-1", model_candidate=None, error=None,
        idempotency_key=key, config={}, dataset_version="v1", dependency_versions={},
    )


def _batch(batch_id: str = "batch-a", key: str = "idempotency-key-0001") -> dict:
    return {
        "batch_id": batch_id, "idempotency_key": key,
        "request_digest": PredictionPublicationStore.digest("P01", "42", "rf", "1"),
        "event_code": "PROGRAM_DROPOUT_NEXT_EXPECTED_CLOSURE", "program_ref": "P01",
        "closure_id": "42", "model_id": "rf", "model_version": "1", "submitted_by": "actor-1",
        "authorized_scope": {"kind": "program"}, "created_at": "2026-11-12T10:00:00+00:00",
    }


ROW = {"subject_ref": "1", "program_ref": "P01", "closure_id": "42", "predicted_class": "NEGATIVE_EVENT",
       "event_probability": 0.1, "model_id": "rf", "model_version": "1", "generated_at": "2026-11-12T10:01:00+00:00"}


class JobStoreFencingTests(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        self.store = JobStore(Path(self.tmp.name) / "jobs.sqlite")
        self.store.create(_record())

    def tearDown(self) -> None:
        self.tmp.cleanup()

    def _expire(self) -> None:
        with self.store._connect() as c:
            c.execute("UPDATE jobs SET lease_until=? WHERE job_id=?", (EXPIRED, JOB_ID))

    def test_claim_returns_increasing_attempt_numbers(self) -> None:
        self.assertEqual(self.store.claim_attempt(JOB_ID), 1)
        self.assertIsNone(self.store.claim_attempt(JOB_ID))
        self._expire()
        self.assertEqual(self.store.claim_attempt(JOB_ID), 2)

    def test_superseded_attempt_cannot_overwrite_newer_claim(self) -> None:
        stale = self.store.claim_attempt(JOB_ID)
        self._expire()
        current = self.store.claim_attempt(JOB_ID)
        self.assertFalse(self.store.update_status(JOB_ID, JobStatus.FAILED, expected_attempt=stale, error={"code": "X"}))
        self.assertEqual(self.store.get(JOB_ID).status, JobStatus.RUNNING)
        self.assertTrue(self.store.update_status(JOB_ID, JobStatus.SUCCEEDED, expected_attempt=current,
                                                 model_candidate={"model_id": "m", "version": "v"}))
        self.assertEqual(self.store.get(JOB_ID).status, JobStatus.SUCCEEDED)

    def test_attempts_are_bounded_and_exhausted_job_fails(self) -> None:
        for _ in range(3):
            self.assertIsNotNone(self.store.claim_attempt(JOB_ID, max_attempts=3))
            self._expire()
        self.assertIsNone(self.store.claim_attempt(JOB_ID, max_attempts=3))
        self.assertTrue(self.store.fail_exhausted(JOB_ID, 3, {"code": "ATTEMPTS_EXHAUSTED"}))
        failed = self.store.get(JOB_ID)
        self.assertEqual(failed.status, JobStatus.FAILED)
        self.assertEqual(failed.error["code"], "ATTEMPTS_EXHAUSTED")

    def test_live_last_attempt_is_not_failed_prematurely(self) -> None:
        for _ in range(2):
            self.store.claim_attempt(JOB_ID, max_attempts=2)
            self._expire()
        self.store.claim_attempt(JOB_ID, max_attempts=2)  # no-op: limit reached
        with self.store._connect() as c:
            c.execute("UPDATE jobs SET lease_until=datetime('now','+1 hour') WHERE job_id=?", (JOB_ID,))
        self.assertFalse(self.store.fail_exhausted(JOB_ID, 2, {"code": "ATTEMPTS_EXHAUSTED"}))
        self.assertEqual(self.store.get(JOB_ID).status, JobStatus.RUNNING)

    def test_only_queued_jobs_can_be_cancelled_and_then_never_claimed(self) -> None:
        self.assertTrue(self.store.cancel(JOB_ID))
        self.assertEqual(self.store.get(JOB_ID).status, JobStatus.CANCELLED)
        self.assertIsNone(self.store.claim_attempt(JOB_ID))
        other = _record("7c1b9f6f-4d1f-4bae-8e8b-1e4f2d3c5b21", "robustness-key-0002")
        self.store.create(other)
        self.store.claim_attempt(other.job_id)
        self.assertFalse(self.store.cancel(other.job_id))


class PublicationFencingTests(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        self.path = Path(self.tmp.name) / "publication.sqlite"
        self.store = PredictionPublicationStore(f"sqlite://{self.path}")
        self.store.create(_batch(), "actor-1")

    def tearDown(self) -> None:
        self.tmp.cleanup()

    def _expire(self) -> None:
        with self.store._connect() as c:
            c.execute("UPDATE prediction_batches SET lease_until=? WHERE batch_id='batch-a'", (EXPIRED,))

    def test_superseded_worker_cannot_publish_or_fail(self) -> None:
        stale = self.store.claim_attempt("batch-a")
        self._expire()
        current = self.store.claim_attempt("batch-a")
        with self.assertRaises(RuntimeError):
            self.store.publish("batch-a", [ROW], [], attempt=stale)
        self.assertEqual(self.store.get("batch-a")["result_count"], 0)
        self.assertFalse(self.store.fail("batch-a", {"code": "X"}, attempt=stale))
        self.store.publish("batch-a", [ROW], [], attempt=current)
        self.assertEqual(self.store.get("batch-a")["status"], "PUBLISHED")

    def test_batch_attempts_are_bounded(self) -> None:
        for _ in range(2):
            self.assertIsNotNone(self.store.claim_attempt("batch-a", max_attempts=2))
            self._expire()
        self.assertIsNone(self.store.claim_attempt("batch-a", max_attempts=2))
        self.assertTrue(self.store.fail_exhausted("batch-a", 2, {"code": "ATTEMPTS_EXHAUSTED"}))
        self.assertEqual(self.store.get("batch-a")["status"], "FAILED")

    def test_sqlite_file_from_before_fencing_is_upgraded(self) -> None:
        legacy = Path(self.tmp.name) / "legacy.sqlite"
        with closing(sqlite3.connect(legacy)) as c:
            c.execute("""CREATE TABLE prediction_batches (
                batch_id TEXT PRIMARY KEY, idempotency_scope TEXT NOT NULL, idempotency_key TEXT NOT NULL,
                request_digest TEXT NOT NULL, event_code TEXT NOT NULL, program_ref TEXT NOT NULL,
                closure_id TEXT NOT NULL, model_id TEXT NOT NULL, model_version TEXT NOT NULL,
                submitted_by TEXT NOT NULL, authorized_scope TEXT NOT NULL, status TEXT NOT NULL,
                result_count INTEGER NOT NULL DEFAULT 0, source_execution_ids TEXT NOT NULL DEFAULT '[]',
                error TEXT, created_at TEXT NOT NULL, started_at TEXT, finished_at TEXT, published_at TEXT,
                UNIQUE(idempotency_scope,idempotency_key))""")
            c.commit()
        store = PredictionPublicationStore(f"sqlite://{legacy}")
        store.create(_batch(), "actor-1")
        self.assertEqual(store.claim_attempt("batch-a"), 1)


class Identity:
    def authenticate(self, token):
        return Principal("actor-1", frozenset({"RECTOR"}), ())


class Data:
    def resolve_context(self, program_ref, closure_id):
        return ProgramContext(program_ref, program_ref, 3, closure_id, 2026, 2, "2026-10-01T00:00:00+00:00")


class Policy:
    def authorize(self, principal, context):
        return None


class Registry:
    def active(self, event_code, cadence):
        return type("Bundle", (), {"model_id": "rf", "version": "1"})()


class RacingStore:
    """find_by_key misses, then create loses the race to a different request."""

    digest = staticmethod(PredictionPublicationStore.digest)

    def find_by_key(self, key, scope):
        return None

    def create(self, batch, scope):
        raise PublicationConflict("Idempotency-Key was used for a different publication request.")


class PublicationConflictTests(unittest.TestCase):
    def test_concurrent_idempotency_conflict_maps_to_409(self) -> None:
        service = PopulationPublicationService(RacingStore(), Identity(), Data(), Policy(), Registry())
        with patch.dict(os.environ, {"PREDICTION_BATCH_SUBMITTER_ROLES": '["RECTOR"]'}):
            with self.assertRaises(InferenceFailure) as raised:
                service.submit("token", "P01", "42", "idempotency-key-0001")
        self.assertEqual(raised.exception.status_code, 409)
        self.assertEqual(raised.exception.code, "IDEMPOTENCY_CONFLICT")


class OperatorIdentity:
    def authenticate(self, token):
        if token != "operator-token":
            raise InferenceFailure("INVALID_TOKEN", 401, "invalid")
        return Principal("operator-1", frozenset({"SUPERADMIN"}), ())


class TrainingAdmissionApiTests(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        self.db = Path(self.tmp.name) / "jobs.sqlite"
        self.env = patch.dict(os.environ, {
            "PREDICTION_DATABASE_URL": f"sqlite://{self.db}",
            "WORKER_ARTIFACTS_DIR": self.tmp.name,
            "WORKER_MAX_CONCURRENT_JOBS": "1",
            "PREDICTION_MAX_QUEUED_JOBS": "1",
        })
        self.env.start()
        app.state.identity_provider = OperatorIdentity()
        self.client = TestClient(app, headers={"Authorization": "Bearer operator-token"})
        self.dispatch = patch("training.tasks.train_model_task.apply_async")
        self.dispatch.start()

    def tearDown(self) -> None:
        self.dispatch.stop()
        del app.state.identity_provider
        self.env.stop()
        self.tmp.cleanup()

    def _submit(self, key: str):
        return self.client.post("/v1/training-jobs", json={"dataset_ref": "fixture:pred003_synthetic-v1", "algorithm": "random_forest"},
                                headers={"Idempotency-Key": key})

    def test_running_plus_queued_capacity_is_enforced(self) -> None:
        self.assertEqual(self._submit("admission-key-00001").status_code, 202)
        self.assertEqual(self._submit("admission-key-00002").status_code, 202)
        rejected = self._submit("admission-key-00003")
        self.assertEqual(rejected.status_code, 429)
        self.assertEqual(rejected.json()["code"], "JOB_CAPACITY")

    def test_cancel_frees_capacity_and_only_applies_to_queued_jobs(self) -> None:
        job_id = self._submit("admission-key-00004").json()["job_id"]
        cancelled = self.client.post(f"/v1/training-jobs/{job_id}/cancel")
        self.assertEqual(cancelled.status_code, 200)
        self.assertEqual(cancelled.json()["status"], "CANCELLED")
        again = self.client.post(f"/v1/training-jobs/{job_id}/cancel")
        self.assertEqual(again.status_code, 409)
        self.assertEqual(again.json()["code"], "JOB_NOT_CANCELLABLE")
        missing = self.client.post("/v1/training-jobs/9d2c0e7a-5e2f-4c8b-9f9c-2f5e3d4c6b32/cancel")
        self.assertEqual(missing.status_code, 404)
        self.assertEqual(TestClient(app).post(f"/v1/training-jobs/{job_id}/cancel").status_code, 401)

    def test_invalid_capacity_configuration_fails_closed(self) -> None:
        with patch.dict(os.environ, {"PREDICTION_MAX_QUEUED_JOBS": "-1"}):
            response = self._submit("admission-key-00005")
        self.assertEqual(response.status_code, 503)


class ExhaustedTaskTests(unittest.TestCase):
    def test_worker_fails_job_after_last_attempt_instead_of_retrying_forever(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            db = Path(tmp) / "jobs.sqlite"
            with patch.dict(os.environ, {"PREDICTION_DATABASE_URL": f"sqlite://{db}"}):
                store = JobStore()
                store.create(_record())
                from training.tasks import train_model_task, worker_settings
                for _ in range(worker_settings.max_job_attempts):
                    store.claim_attempt(JOB_ID, max_attempts=worker_settings.max_job_attempts)
                    with store._connect() as c:
                        c.execute("UPDATE jobs SET lease_until=? WHERE job_id=?", (EXPIRED, JOB_ID))
                with patch("training.trainer.train_model") as train:
                    result = train_model_task.run(job_id=JOB_ID, dataset_ref="fixture:pred003_synthetic-v1",
                                                  algorithm="random_forest", config={}, artifacts_dir=tmp)
                train.assert_not_called()
                self.assertEqual(result["status"], "FAILED")
                failed = store.get(JOB_ID)
                self.assertEqual(failed.status, JobStatus.FAILED)
                self.assertEqual(failed.error["code"], "ATTEMPTS_EXHAUSTED")
                self.assertEqual(failed.attempt, worker_settings.max_job_attempts)


if __name__ == "__main__":
    unittest.main()
