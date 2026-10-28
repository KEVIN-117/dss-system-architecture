"""Unit tests for the thread-safe JobStore."""

from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from training.job_store import JobStatus, JobStore, TrainingJobRecord


class JobStoreTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = tempfile.TemporaryDirectory()
        self.store_path = Path(self.temp_dir.name) / "job_store.json"
        self.store = JobStore(self.store_path)

    def tearDown(self) -> None:
        self.temp_dir.cleanup()

    def _sample_record(self, job_id: str = "job-001", key: str = "key-001") -> TrainingJobRecord:
        return TrainingJobRecord(
            job_id=job_id,
            dataset_ref="fixture:pred003-synthetic-v1",
            algorithm="random_forest",
            status=JobStatus.QUEUED,
            created_at="2026-10-26T20:00:00Z",
            started_at=None,
            finished_at=None,
            submitted_by="test-operator",
            model_candidate=None,
            error=None,
            idempotency_key=key,
            config={"seed": 42},
            dataset_version="bbbbbbbb-cccc-4ddd-8eee-ffffffffffff",
            dependency_versions={"python": "3.14"},
        )

    def test_create_and_retrieve_job(self) -> None:
        record = self._sample_record()
        self.store.create(record)

        retrieved = self.store.get("job-001")
        self.assertIsNotNone(retrieved)
        self.assertEqual(retrieved.job_id, "job-001")
        self.assertEqual(retrieved.status, JobStatus.QUEUED)
        self.assertEqual(retrieved.algorithm, "random_forest")

    def test_create_duplicate_job_raises_error(self) -> None:
        record = self._sample_record()
        self.store.create(record)
        duplicate_id = self._sample_record(key="a-different-key")
        import sqlite3
        with self.assertRaises(sqlite3.IntegrityError):
            self.store.create(duplicate_id)

    def test_update_status_transitions(self) -> None:
        record = self._sample_record()
        self.store.create(record)

        # Transition to RUNNING
        self.store.update_status("job-001", JobStatus.RUNNING, started_at="2026-10-26T20:01:00Z")
        running = self.store.get("job-001")
        self.assertEqual(running.status, JobStatus.RUNNING)
        self.assertEqual(running.started_at, "2026-10-26T20:01:00Z")

        # Transition to SUCCEEDED
        candidate = {"model_id": "model-123", "version": "rf-v1"}
        self.store.update_status(
            "job-001",
            JobStatus.SUCCEEDED,
            finished_at="2026-10-26T20:05:00Z",
            model_candidate=candidate,
        )
        succeeded = self.store.get("job-001")
        self.assertEqual(succeeded.status, JobStatus.SUCCEEDED)
        self.assertEqual(succeeded.finished_at, "2026-10-26T20:05:00Z")
        self.assertEqual(succeeded.model_candidate, candidate)

    def test_update_status_to_failed_with_error(self) -> None:
        record = self._sample_record()
        self.store.create(record)

        error_data = {
            "type": "about:blank",
            "title": "Out of memory",
            "status": 500,
            "code": "JOB_FAILED",
            "detail": "Worker killed by OOM",
            "request_id": "job-001",
        }
        self.store.update_status(
            "job-001",
            JobStatus.FAILED,
            finished_at="2026-10-26T20:02:00Z",
            error=error_data,
        )
        failed = self.store.get("job-001")
        self.assertEqual(failed.status, JobStatus.FAILED)
        self.assertEqual(failed.error, error_data)
        self.assertIsNone(failed.model_candidate)

    def test_find_by_idempotency_key(self) -> None:
        record = self._sample_record(job_id="job-abc", key="idempotency-xyz")
        self.store.create(record)

        found = self.store.find_by_idempotency_key("idempotency-xyz")
        self.assertIsNotNone(found)
        self.assertEqual(found.job_id, "job-abc")

        missing = self.store.find_by_idempotency_key("non-existent-key")
        self.assertIsNone(missing)

    def test_same_key_with_different_request_conflicts(self) -> None:
        from training.job_store import IdempotencyConflict
        record = self._sample_record(key="same-key")
        self.store.create(record)
        changed = self._sample_record(job_id="job-002", key="same-key")
        changed.algorithm = "xgboost"
        changed.request_digest = self.store.request_digest(changed.dataset_ref, changed.algorithm, changed.config)
        with self.assertRaises(IdempotencyConflict):
            self.store.create(changed)

    def test_only_one_duplicate_delivery_can_claim_job(self) -> None:
        record = self._sample_record()
        self.store.create(record)
        self.assertTrue(self.store.claim(record.job_id))
        self.assertFalse(self.store.claim(record.job_id))

    def test_expired_running_job_can_be_reclaimed(self) -> None:
        record = self._sample_record()
        self.store.create(record)
        self.assertTrue(self.store.claim(record.job_id))
        with self.store._connect() as connection:
            connection.execute("UPDATE jobs SET lease_until='2000-01-01 00:00:00' WHERE job_id=?", (record.job_id,))
        self.assertTrue(self.store.claim(record.job_id))
        self.assertEqual(self.store.get(record.job_id).attempt, 2)

    def test_list_active_jobs(self) -> None:
        rec1 = self._sample_record("job-1", "k1")
        rec2 = self._sample_record("job-2", "k2")
        rec3 = self._sample_record("job-3", "k3")

        self.store.create(rec1)
        self.store.create(rec2)
        self.store.create(rec3)

        self.assertTrue(self.store.claim("job-2"))
        self.store.update_status("job-3", JobStatus.SUCCEEDED)

        active = self.store.list_active()
        active_ids = {j.job_id for j in active}
        self.assertEqual(active_ids, {"job-1", "job-2"})

    def test_expired_running_lease_does_not_consume_capacity(self) -> None:
        record = self._sample_record()
        self.store.create(record)
        self.assertTrue(self.store.claim(record.job_id))
        with self.store._connect() as connection:
            connection.execute("UPDATE jobs SET lease_until='2000-01-01 00:00:00' WHERE job_id=?", (record.job_id,))

        self.assertEqual(self.store.list_active(), [])


if __name__ == "__main__":
    unittest.main()
