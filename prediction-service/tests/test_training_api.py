"""Unit and integration tests for FastAPI training job endpoints."""

from __future__ import annotations

import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from fastapi.testclient import TestClient

from main import app
from training.job_store import JobStatus, JobStore, TrainingJobRecord


class TrainingApiTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = tempfile.TemporaryDirectory()
        self.artifacts_dir = Path(self.temp_dir.name)
        self.store_path = self.artifacts_dir / "job_store.json"

        # Patch environment variables to use temporary directory
        self.env_patcher = patch.dict(
            "os.environ",
            {
                "WORKER_ARTIFACTS_DIR": str(self.artifacts_dir),
                "WORKER_JOB_STORE_PATH": str(self.store_path),
                "WORKER_MAX_CONCURRENT_JOBS": "2",
            },
        )
        self.env_patcher.start()
        self.client = TestClient(app)

    def tearDown(self) -> None:
        self.env_patcher.stop()
        self.temp_dir.cleanup()

    @patch("training.tasks.train_model_task.delay")
    def test_submit_training_job_success(self, mock_delay) -> None:
        headers = {
            "Idempotency-Key": "test-idempotency-key-0001",
            "X-Request-ID": "req-12345",
        }
        body = {
            "dataset_ref": "fixture:pred003-synthetic-v1",
            "algorithm": "random_forest",
            "configuration_ref": "cfg-rf-default",
        }

        response = self.client.post("/v1/training-jobs", json=body, headers=headers)

        self.assertEqual(response.status_code, 202)
        data = response.json()
        self.assertIn("job_id", data)
        self.assertEqual(data["status"], "QUEUED")
        self.assertEqual(data["algorithm"], "random_forest")
        mock_delay.assert_called_once()

    @patch("training.tasks.train_model_task.delay")
    def test_idempotency_key_returns_existing_job(self, mock_delay) -> None:
        headers = {
            "Idempotency-Key": "test-idempotency-key-0002",
        }
        body = {
            "dataset_ref": "fixture:pred003-synthetic-v1",
            "algorithm": "xgboost",
        }

        # First request creates job
        resp1 = self.client.post("/v1/training-jobs", json=body, headers=headers)
        self.assertEqual(resp1.status_code, 202)
        job_id_1 = resp1.json()["job_id"]

        # Second request with same idempotency key returns existing job
        resp2 = self.client.post("/v1/training-jobs", json=body, headers=headers)
        self.assertEqual(resp2.status_code, 202)
        job_id_2 = resp2.json()["job_id"]

        self.assertEqual(job_id_1, job_id_2)
        # Worker was only invoked once
        mock_delay.assert_called_once()

    def test_submit_missing_idempotency_key_fails(self) -> None:
        body = {
            "dataset_ref": "fixture:pred003-synthetic-v1",
            "algorithm": "random_forest",
        }
        response = self.client.post("/v1/training-jobs", json=body)
        self.assertEqual(response.status_code, 422)

    def test_submit_invalid_algorithm_fails(self) -> None:
        headers = {"Idempotency-Key": "test-idempotency-key-0003"}
        body = {
            "dataset_ref": "fixture:pred003-synthetic-v1",
            "algorithm": "unsupported_algo",
        }
        response = self.client.post("/v1/training-jobs", json=body, headers=headers)
        self.assertEqual(response.status_code, 422)

    def test_get_training_job_found(self) -> None:
        # Prepopulate store with a record
        store = JobStore(self.store_path)
        record = TrainingJobRecord(
            job_id="test-job-found-1",
            dataset_ref="fixture:pred003-synthetic-v1",
            algorithm="random_forest",
            status=JobStatus.SUCCEEDED,
            created_at="2026-10-26T20:00:00Z",
            started_at="2026-10-26T20:01:00Z",
            finished_at="2026-10-26T20:05:00Z",
            submitted_by="test-user",
            model_candidate={"model_id": "m-123", "version": "v1.0"},
            error=None,
            idempotency_key="key-found",
            config={},
            dataset_version="v1",
            dependency_versions={},
        )
        store.create(record)

        response = self.client.get("/v1/training-jobs/test-job-found-1")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["job_id"], "test-job-found-1")
        self.assertEqual(data["status"], "SUCCEEDED")
        self.assertIsNotNone(data["model_candidate"])

    def test_get_training_job_not_found(self) -> None:
        response = self.client.get("/v1/training-jobs/non-existent-job-uuid")
        self.assertEqual(response.status_code, 404)

    def test_legacy_endpoints_unaffected(self) -> None:
        root_resp = self.client.get("/")
        self.assertEqual(root_resp.status_code, 200)

        predict_resp = self.client.post("/predict", json={"student_id": "123"})
        self.assertEqual(predict_resp.status_code, 200)
        self.assertIn("prediction", predict_resp.json())


if __name__ == "__main__":
    unittest.main()
