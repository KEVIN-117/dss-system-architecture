"""Unit and integration tests for FastAPI training job endpoints."""

from __future__ import annotations

import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from fastapi.testclient import TestClient

from inference import InferenceFailure, Principal
from main import app
from training.job_store import JobStatus, JobStore, TrainingJobRecord


class FakeIdentity:
    """Token -> principal map; the real provider verifies Keycloak JWTs."""

    PRINCIPALS = {
        "operator-token": Principal("operator-1", frozenset({"SUPERADMIN"}), ()),
        "rector-token": Principal("rector-1", frozenset({"RECTOR"}), ()),
    }

    def authenticate(self, access_token: str) -> Principal:
        if access_token not in self.PRINCIPALS:
            raise InferenceFailure("INVALID_TOKEN", 401, "The access token is invalid or expired.")
        return self.PRINCIPALS[access_token]


class TrainingApiTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = tempfile.TemporaryDirectory()
        self.artifacts_dir = Path(self.temp_dir.name)
        self.store_path = self.artifacts_dir / "jobs.sqlite"

        # Patch environment variables to use temporary directory
        self.env_patcher = patch.dict(
            "os.environ",
            {
                "WORKER_ARTIFACTS_DIR": str(self.artifacts_dir),
                "PREDICTION_DATABASE_URL": f"sqlite://{self.store_path}",
                "WORKER_MAX_CONCURRENT_JOBS": "2",
            },
        )
        self.env_patcher.start()
        app.state.identity_provider = FakeIdentity()
        self.client = TestClient(app)
        self.operator = TestClient(app, headers={"Authorization": "Bearer operator-token"})

    def tearDown(self) -> None:
        del app.state.identity_provider
        self.env_patcher.stop()
        self.temp_dir.cleanup()

    @patch("training.tasks.train_model_task.apply_async")
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

        response = self.operator.post("/v1/training-jobs", json=body, headers=headers)

        self.assertEqual(response.status_code, 202)
        data = response.json()
        self.assertIn("job_id", data)
        self.assertEqual(data["status"], "QUEUED")
        self.assertEqual(data["algorithm"], "random_forest")
        mock_delay.assert_called_once()

    @patch("training.tasks.train_model_task.apply_async")
    def test_idempotency_key_returns_existing_job(self, mock_delay) -> None:
        headers = {
            "Idempotency-Key": "test-idempotency-key-0002",
        }
        body = {
            "dataset_ref": "fixture:pred003-synthetic-v1",
            "algorithm": "xgboost",
        }

        # First request creates job
        resp1 = self.operator.post("/v1/training-jobs", json=body, headers=headers)
        self.assertEqual(resp1.status_code, 202)
        job_id_1 = resp1.json()["job_id"]

        # Second request with same idempotency key returns existing job
        resp2 = self.operator.post("/v1/training-jobs", json=body, headers=headers)
        self.assertEqual(resp2.status_code, 202)
        job_id_2 = resp2.json()["job_id"]

        self.assertEqual(job_id_1, job_id_2)
        # Worker was only invoked once
        mock_delay.assert_called_once()

    @patch("training.tasks.train_model_task.apply_async")
    def test_idempotency_key_rejects_changed_body(self, mock_dispatch) -> None:
        headers = {"Idempotency-Key": "same-key-different-body"}
        first = self.operator.post("/v1/training-jobs", json={"dataset_ref":"fixture:pred003_synthetic-v1","algorithm":"random_forest"}, headers=headers)
        second = self.operator.post("/v1/training-jobs", json={"dataset_ref":"fixture:pred003_synthetic-v1","algorithm":"xgboost"}, headers=headers)
        self.assertEqual(first.status_code, 202)
        self.assertEqual(second.status_code, 409)
        self.assertEqual(mock_dispatch.call_count, 1)

    @patch("training.tasks.train_model_task.apply_async", side_effect=RuntimeError("broker unavailable"))
    def test_dispatch_failure_keeps_job_queued_for_outbox_retry(self, mock_dispatch) -> None:
        response = self.operator.post("/v1/training-jobs", json={"dataset_ref":"fixture:pred003_synthetic-v1","algorithm":"random_forest"}, headers={"Idempotency-Key":"outbox-retry-key-001"})
        self.assertEqual(response.status_code, 202)
        self.assertEqual(response.json()["status"], "QUEUED")
        store = JobStore(self.store_path)
        self.assertEqual(store.pending_outbox(), [])  # exponential retry delay avoids a tight retry loop
        with store._connect() as connection:
            connection.execute("UPDATE outbox SET next_attempt_at='2000-01-01 00:00:00' WHERE job_id=?", (response.json()["job_id"],))
        self.assertEqual(store.pending_outbox(), [response.json()["job_id"]])

    @patch("training.tasks.train_model_task.apply_async")
    def test_training_submission_requires_bearer_token(self, mock_dispatch) -> None:
        response = self.client.post("/v1/training-jobs", json={"dataset_ref": "fixture:pred003_synthetic-v1", "algorithm": "random_forest"},
                                    headers={"Idempotency-Key": "unauthenticated-key-01"})
        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.json()["code"], "INVALID_TOKEN")
        mock_dispatch.assert_not_called()
        self.assertIsNone(JobStore(self.store_path).find_by_idempotency_key("unauthenticated-key-01", "development:operator-1"))

    @patch("training.tasks.train_model_task.apply_async")
    def test_training_submission_rejects_non_operator_role(self, mock_dispatch) -> None:
        response = self.client.post("/v1/training-jobs", json={"dataset_ref": "fixture:pred003_synthetic-v1", "algorithm": "random_forest"},
                                    headers={"Idempotency-Key": "academic-role-key-01", "Authorization": "Bearer rector-token"})
        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.json()["code"], "INSUFFICIENT_SCOPE")
        mock_dispatch.assert_not_called()

    @patch("training.tasks.train_model_task.apply_async")
    def test_training_submission_records_verified_subject(self, mock_dispatch) -> None:
        response = self.operator.post("/v1/training-jobs", json={"dataset_ref": "fixture:pred003_synthetic-v1", "algorithm": "random_forest"},
                                      headers={"Idempotency-Key": "audited-operator-key"})
        self.assertEqual(response.status_code, 202)
        self.assertEqual(response.json()["submitted_by"], "operator-1")
        stored = JobStore(self.store_path).get(response.json()["job_id"])
        self.assertEqual(stored.submitted_by, "operator-1")

    def test_invalid_operator_role_policy_fails_closed(self) -> None:
        with patch.dict("os.environ", {"PREDICTION_TRAINING_ROLES": "not-json"}):
            response = self.operator.post("/v1/training-jobs", json={"dataset_ref": "fixture:pred003_synthetic-v1", "algorithm": "random_forest"},
                                          headers={"Idempotency-Key": "bad-policy-key-0001"})
        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.json()["code"], "AUTHORIZATION_UNAVAILABLE")

    def test_training_job_status_requires_operator(self) -> None:
        job_id = "d8b9e194-87bf-41e6-a668-2f8c95dab731"
        self.assertEqual(self.client.get(f"/v1/training-jobs/{job_id}").status_code, 401)
        forbidden = self.client.get(f"/v1/training-jobs/{job_id}", headers={"Authorization": "Bearer rector-token"})
        self.assertEqual(forbidden.status_code, 403)

    def test_unknown_dataset_ref_is_not_replaced_with_fixture(self) -> None:
        from training.tasks import _resolve_dataset
        with self.assertRaises(FileNotFoundError):
            _resolve_dataset("institutional-snapshot-that-does-not-exist")

    def test_submit_missing_idempotency_key_fails(self) -> None:
        body = {
            "dataset_ref": "fixture:pred003-synthetic-v1",
            "algorithm": "random_forest",
        }
        response = self.operator.post("/v1/training-jobs", json=body)
        self.assertEqual(response.status_code, 422)

    def test_submit_invalid_algorithm_fails(self) -> None:
        headers = {"Idempotency-Key": "test-idempotency-key-0003"}
        body = {
            "dataset_ref": "fixture:pred003-synthetic-v1",
            "algorithm": "unsupported_algo",
        }
        response = self.operator.post("/v1/training-jobs", json=body, headers=headers)
        self.assertEqual(response.status_code, 422)

    def test_get_training_job_found(self) -> None:
        # Prepopulate store with a record
        store = JobStore(self.store_path)
        record = TrainingJobRecord(
            job_id="d8b9e194-87bf-41e6-a668-2f8c95dab731",
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

        response = self.operator.get("/v1/training-jobs/d8b9e194-87bf-41e6-a668-2f8c95dab731")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["job_id"], "d8b9e194-87bf-41e6-a668-2f8c95dab731")
        self.assertEqual(data["status"], "SUCCEEDED")
        self.assertIsNotNone(data["model_candidate"])

    def test_get_training_job_not_found(self) -> None:
        response = self.operator.get("/v1/training-jobs/non-existent-job-uuid")
        self.assertEqual(response.status_code, 404)

    def test_prediction_never_returns_simulated_result_without_active_model(self) -> None:
        root_resp = self.client.get("/")
        self.assertEqual(root_resp.status_code, 200)

        predict_resp = self.client.post("/predict", json={"student_id": "123"})
        self.assertEqual(predict_resp.status_code, 503)
        self.assertEqual(predict_resp.json()["detail"]["code"], "NO_ACTIVE_MODEL")
        self.assertNotIn("confidence", predict_resp.json())

    def test_v1_prediction_requires_bearer_token(self) -> None:
        response = self.client.post("/v1/predictions", json={
            "contract_version": "1.0", "subject_ref": "100", "program_ref": "P01",
            "academic_cut": {"cut_id": "42"},
        })
        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.json()["code"], "INVALID_TOKEN")

    def test_course_prediction_requires_course_reference(self) -> None:
        response = self.client.post("/v1/predictions", json={
            "contract_version": "1.0", "event_type": "course_abandonment",
            "subject_ref": "100", "program_ref": "P01", "academic_cut": {"cut_id": "42"},
        }, headers={"Authorization": "Bearer valid-test-token"})
        self.assertEqual(response.status_code, 422)

    def test_v1_prediction_returns_contract_result_from_injected_service(self) -> None:
        class PredictionStub:
            def predict(self, token, subject_ref, program_ref, cut_id, event_type="program_dropout", course_ref=None):
                self.assertions = (token, subject_ref, program_ref, cut_id, event_type, course_ref)
                return {
                    "contract_version": "1.0",
                    "prediction_id": "c6ea3c27-e3e2-4c43-9d51-5a9519873810",
                    "subject_ref": subject_ref,
                    "program_ref": program_ref,
                    "event_type": event_type,
                    "course_ref": course_ref,
                    "event_code": "NEXT_CLOSURE_DROPOUT",
                    "predicted_class": "POSITIVE_EVENT",
                    "event_probability": 0.73,
                    "model": {"model_id": "model-1", "version": "v1"},
                    "academic_cut": {"cut_id": cut_id},
                    "generated_at": "2026-11-03T12:00:00Z",
                }

        stub = PredictionStub()
        app.state.prediction_service = stub
        try:
            response = self.client.post("/v1/predictions", json={
                "contract_version": "1.0", "subject_ref": "100", "program_ref": "P01",
                "academic_cut": {"cut_id": "42"},
            }, headers={"Authorization": "Bearer valid-test-token"})
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.json()["predicted_class"], "POSITIVE_EVENT")
            self.assertEqual(response.json()["event_probability"], 0.73)
            self.assertEqual(response.json()["subject_ref"], "100")
            self.assertEqual(stub.assertions[-2:], ("program_dropout", None))
            course_response = self.client.post("/v1/predictions", json={
                "contract_version": "1.0", "event_type": "course_abandonment", "course_ref": "901",
                "subject_ref": "100", "program_ref": "P01", "academic_cut": {"cut_id": "42"},
            }, headers={"Authorization": "Bearer valid-test-token"})
            self.assertEqual(course_response.status_code, 200)
            self.assertEqual(stub.assertions[-2:], ("course_abandonment", "901"))
        finally:
            del app.state.prediction_service

    def test_readiness_probe_returns_detailed_health(self) -> None:
        response = self.client.get("/v1/health/ready")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("status", data)
        self.assertEqual(data["service"], "prediction-service")
        self.assertTrue(data["database"]["connected"])
        self.assertIn("outbox", data)
        self.assertIn("active_model", data)

    def test_metrics_endpoint_returns_prometheus_format(self) -> None:
        response = self.client.get("/metrics")
        self.assertEqual(response.status_code, 200)
        self.assertIn("text/plain", response.headers["content-type"])
        body = response.text
        self.assertIn("prediction_service_up", body)
        self.assertIn("prediction_active_jobs_count", body)
        self.assertIn("prediction_pending_outbox_count", body)
        self.assertIn("prediction_active_model_available", body)

    def test_openapi_schema_documents_problem_responses_and_deprecated_predict(self) -> None:
        response = self.client.get("/openapi.json")
        self.assertEqual(response.status_code, 200)
        schema = response.json()
        # Verificar endpoint legacy deprecado
        predict_spec = schema["paths"]["/predict"]["post"]
        self.assertTrue(predict_spec.get("deprecated", False))

        # Verificar responses documentadas en endpoints v1
        v1_predictions = schema["paths"]["/v1/predictions"]["post"]["responses"]
        for code in ("401", "403", "422", "503"):
            self.assertIn(code, v1_predictions)
            self.assertIn("ProblemResponse", str(v1_predictions[code]))

        v1_batches = schema["paths"]["/v1/prediction-batches"]["post"]["responses"]
        self.assertIn("409", v1_batches)

    def test_config_validate_runtime_in_production(self) -> None:
        from config import Settings
        import os

        old_env = os.environ.get("PREDICTION_ENV")
        try:
            os.environ["PREDICTION_ENV"] = "production"
            # Settings para producción sin vars requeridas debe fallar
            prod_settings = Settings("production", "0.0.0.0", 8000, "info", False)
            with self.assertRaises(RuntimeError) as ctx:
                prod_settings.validate_runtime()
            self.assertIn("Runtime configuration missing or invalid", str(ctx.exception))
        finally:
            if old_env is not None:
                os.environ["PREDICTION_ENV"] = old_env
            else:
                os.environ.pop("PREDICTION_ENV", None)


if __name__ == "__main__":
    unittest.main()
