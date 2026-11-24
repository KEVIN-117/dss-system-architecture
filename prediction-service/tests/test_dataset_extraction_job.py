"""PRED-102: dataset extraction jobs, job list, cancellation and EDA endpoints."""
from __future__ import annotations

import json
import os
import shutil
import sqlite3
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from uuid import uuid4

from fastapi.testclient import TestClient

from main import app
from tests.test_feature_contract import CUTS, synthetic_contract_rows
from tests.test_training_api import FakeIdentity
from training.dataset_extraction import (
    ExtractionCancelled,
    ExtractionError,
    run_extraction,
    validate_params,
)
from training.job_store import JobKind, JobStatus, JobStore, TrainingJobRecord

DROPOUT = "PROGRAM_DROPOUT_NEXT_EXPECTED_CLOSURE"
FIXTURES = Path(__file__).parent / "fixtures"
DS_1 = "0b4f7c1e-1d2a-4f5b-8c6d-7e8f9a0b1c01"
DS_TASK = "0b4f7c1e-1d2a-4f5b-8c6d-7e8f9a0b1c02"
DS_API = "0b4f7c1e-1d2a-4f5b-8c6d-7e8f9a0b1c03"


def fake_dropout_extract(dsn, programs, cadence, features):
    return synthetic_contract_rows(), CUTS


def record(job_id: str, kind: str = JobKind.TRAIN.value, status: JobStatus = JobStatus.QUEUED,
           created_at: str = "2026-01-01T00:00:00+00:00", **extra) -> TrainingJobRecord:
    return TrainingJobRecord(
        job_id=job_id, dataset_ref=extra.pop("dataset_ref", "fixture:pred003_synthetic-v1"),
        algorithm="random_forest" if kind == JobKind.TRAIN.value else "", status=status,
        created_at=created_at, started_at=None, finished_at=None, submitted_by="operator-1",
        model_candidate=None, error=None, idempotency_key=f"key-{job_id}", config={},
        dataset_version="v1", dependency_versions={}, job_kind=kind, **extra,
    )


class ExtractionParamsTests(unittest.TestCase):
    def test_valid_dropout_request(self) -> None:
        params = validate_params({"task_code": DROPOUT, "cadence": "SEMESTRAL", "programs": ["P01", "P01", " "],
                                  "horizon_years": 4})
        self.assertEqual(params.programs, ("P01",))
        self.assertEqual(params.horizon_years, 4)

    def test_rejections_use_catalog_rules(self) -> None:
        cases = [
            ({"task_code": "UNKNOWN", "cadence": "ANUAL"}, "UNKNOWN_TASK"),
            ({"task_code": "COURSE_ABANDONMENT", "cadence": "ANUAL"}, "TASK_NOT_EXTRACTABLE"),
            ({"task_code": "COURSE_FAILURE", "cadence": "ANUAL"}, "INVALID_CADENCE"),
            ({"task_code": "COURSE_FAILURE", "cadence": "SEMESTRAL", "horizon_years": 2}, "INVALID_HORIZON"),
            ({"task_code": DROPOUT, "cadence": "ANUAL", "horizon_years": 0}, "INVALID_HORIZON"),
            ({"task_code": DROPOUT, "cadence": "ANUAL", "features": ["nope"]}, "UNKNOWN_FEATURES"),
        ]
        for raw, code in cases:
            with self.assertRaises(ExtractionError) as ctx:
                validate_params(raw)
            self.assertEqual(ctx.exception.code, code, raw)


class RunExtractionTests(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        self.params = validate_params({"task_code": DROPOUT, "cadence": "SEMESTRAL", "programs": ["P01"],
                                       "features": ["materias_cursadas", "materias_reprobadas", "ppa_acumulado"]})

    def tearDown(self) -> None:
        self.tmp.cleanup()

    def test_publishes_a_ready_dataset_with_profile_and_provenance(self) -> None:
        result = run_extraction(self.params, dsn="postgresql://fake", output_root=self.root, dataset_id=DS_1,
                                job_id="job-1", requested_by="operator-1", extract=fake_dropout_extract)
        folder = self.root / DS_1
        self.assertEqual(result.dataset_ref, f"custom:{DS_1}")
        self.assertEqual(sorted(p.name for p in folder.iterdir()),
                         ["extraction.json", "manifest.json", "profile.json", "rows.jsonl"])
        manifest = json.loads((folder / "manifest.json").read_text(encoding="utf-8"))
        self.assertEqual(manifest["dataset_id"], DS_1)
        self.assertEqual(manifest["extraction"]["job_id"], "job-1")
        profile = json.loads((folder / "profile.json").read_text(encoding="utf-8"))
        self.assertEqual(profile["row_count"], result.row_count)
        self.assertFalse([p for p in self.root.iterdir() if p.name.startswith(".")])

    def test_cancellation_leaves_no_partial_output(self) -> None:
        for checks_before_cancel in (0, 1, 2):
            calls = {"n": 0}

            def should_cancel() -> bool:
                calls["n"] += 1
                return calls["n"] > checks_before_cancel

            with self.assertRaises(ExtractionCancelled):
                run_extraction(self.params, dsn="postgresql://fake", output_root=self.root,
                               dataset_id=str(uuid4()), job_id="job-1", requested_by="op",
                               should_cancel=should_cancel, extract=fake_dropout_extract)
        self.assertEqual(list(self.root.iterdir()), [])

    def test_missing_dsn_and_empty_dw_fail_with_codes(self) -> None:
        with self.assertRaises(ExtractionError) as ctx:
            run_extraction(self.params, dsn="", output_root=self.root, dataset_id="x", job_id="j", requested_by="op")
        self.assertEqual(ctx.exception.code, "DW_NOT_CONFIGURED")
        with self.assertRaises(ExtractionError) as ctx:
            run_extraction(self.params, dsn="postgresql://fake", output_root=self.root, dataset_id="x", job_id="j",
                           requested_by="op", extract=lambda *args: ([], []))
        self.assertEqual(ctx.exception.code, "NO_PROCESSED_CUTS")


class ExtractionTaskTests(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        base = Path(self.tmp.name)
        self.extracted = base / "extracted"
        self.env = patch.dict(os.environ, {
            "PREDICTION_DATABASE_URL": f"sqlite://{base / 'jobs.sqlite'}",
            "PREDICTION_EXTRACTED_DATASET_ROOT": str(self.extracted),
            "PREDICTION_DW_DATABASE_URL": "postgresql://fake",
        })
        self.env.start()
        self.store = JobStore()
        self.job_id = "6f1c5d2a-1111-4c8b-9f9c-2f5e3d4c6b01"
        params = validate_params({"task_code": DROPOUT, "cadence": "SEMESTRAL", "programs": ["P01"],
                                  "features": ["materias_cursadas", "materias_reprobadas", "ppa_acumulado"]})
        self.store.create(record(self.job_id, JobKind.EXTRACT_DATASET.value, dataset_ref=f"custom:{DS_TASK}",
                                 params=params.to_json()), "test")

    def tearDown(self) -> None:
        self.env.stop()
        self.tmp.cleanup()

    def test_task_publishes_dataset_and_records_result_ref(self) -> None:
        from training.tasks import extract_dataset_task
        with patch("training.dw_extract.extract_from_dw", side_effect=fake_dropout_extract):
            outcome = extract_dataset_task.run(job_id=self.job_id)
        self.assertEqual(outcome["status"], "SUCCEEDED")
        job = self.store.get(self.job_id)
        self.assertEqual((job.status, job.result_ref), (JobStatus.SUCCEEDED, f"custom:{DS_TASK}"))
        self.assertTrue((self.extracted / DS_TASK / "profile.json").is_file())

    def test_task_failure_is_recorded_with_its_code(self) -> None:
        from training.tasks import extract_dataset_task
        with patch("training.dw_extract.extract_from_dw", return_value=([], [])):
            outcome = extract_dataset_task.run(job_id=self.job_id)
        self.assertEqual(outcome["status"], "FAILED")
        job = self.store.get(self.job_id)
        self.assertEqual((job.status, job.error["code"]), (JobStatus.FAILED, "NO_PROCESSED_CUTS"))

    def test_cancelled_while_running_discards_the_dataset(self) -> None:
        from training.tasks import extract_dataset_task

        def cancel_then_extract(*args):
            self.assertTrue(self.store.cancel(self.job_id, include_running=True))
            return fake_dropout_extract(*args)

        with patch("training.dw_extract.extract_from_dw", side_effect=cancel_then_extract):
            outcome = extract_dataset_task.run(job_id=self.job_id)
        self.assertEqual(outcome["status"], "CANCELLED")
        self.assertEqual(self.store.get(self.job_id).status, JobStatus.CANCELLED)
        self.assertFalse((self.extracted / DS_TASK).exists())


class JobStoreKindTests(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        self.db = Path(self.tmp.name) / "jobs.sqlite"
        self.store = JobStore(f"sqlite://{self.db}")

    def tearDown(self) -> None:
        self.tmp.cleanup()

    def test_kind_params_and_result_ref_round_trip(self) -> None:
        self.store.create(record("j-1", JobKind.EXTRACT_DATASET.value, params={"task_code": DROPOUT}))
        self.store.claim_attempt("j-1")
        self.store.update_status("j-1", JobStatus.SUCCEEDED, result_ref="custom:abc")
        job = self.store.get("j-1")
        self.assertEqual((job.job_kind, job.params, job.result_ref),
                         ("EXTRACT_DATASET", {"task_code": DROPOUT}, "custom:abc"))

    def test_list_recent_filters_and_orders(self) -> None:
        self.store.create(record("a", created_at="2026-01-01T00:00:00+00:00"))
        self.store.create(record("b", JobKind.EXTRACT_DATASET.value, created_at="2026-01-02T00:00:00+00:00"))
        self.store.create(record("c", created_at="2026-01-03T00:00:00+00:00"))
        self.assertEqual([j.job_id for j in self.store.list_recent()], ["c", "b", "a"])
        self.assertEqual([j.job_id for j in self.store.list_recent("EXTRACT_DATASET")], ["b"])
        self.store.cancel("a")
        self.assertEqual([j.job_id for j in self.store.list_recent(status="CANCELLED")], ["a"])
        self.assertEqual(len(self.store.list_recent(limit=1)), 1)

    def test_running_jobs_cancel_only_when_requested(self) -> None:
        self.store.create(record("r"))
        self.store.claim_attempt("r")
        self.assertFalse(self.store.cancel("r"))
        self.assertTrue(self.store.cancel("r", include_running=True))
        self.assertTrue(self.store.is_cancelled("r"))
        self.assertIsNone(self.store.claim_attempt("r"))
        self.assertFalse(self.store.update_status("r", JobStatus.SUCCEEDED, expected_attempt=1))

    def test_training_digest_is_unchanged(self) -> None:
        legacy = JobStore.request_digest("fixture:x", "xgboost", {"configuration_ref": None})
        import hashlib
        expected = hashlib.sha256(json.dumps({"dataset_ref": "fixture:x", "algorithm": "xgboost",
                                              "config": {"configuration_ref": None}}, sort_keys=True,
                                             separators=(",", ":")).encode()).hexdigest()
        self.assertEqual(legacy, expected)

    def test_pre_pred102_sqlite_database_is_upgraded(self) -> None:
        old = Path(self.tmp.name) / "old.sqlite"
        with sqlite3.connect(old) as c:
            c.execute("""CREATE TABLE jobs (job_id TEXT PRIMARY KEY, idempotency_scope TEXT NOT NULL,
              idempotency_key TEXT NOT NULL, request_digest TEXT NOT NULL, dataset_ref TEXT NOT NULL,
              algorithm TEXT NOT NULL, status TEXT NOT NULL, created_at TEXT NOT NULL, started_at TEXT,
              finished_at TEXT, submitted_by TEXT NOT NULL, model_candidate TEXT, error TEXT, config TEXT NOT NULL,
              dataset_version TEXT NOT NULL, dependency_versions TEXT NOT NULL, attempt INTEGER NOT NULL DEFAULT 0,
              lease_until TEXT, UNIQUE(idempotency_scope,idempotency_key))""")
            c.execute("INSERT INTO jobs VALUES ('legacy','s','k','d','fixture:x','xgboost','SUCCEEDED','2025-01-01',"
                      "NULL,NULL,'op',NULL,NULL,'{}','v','{}',1,NULL)")
        c.close()
        store = JobStore(f"sqlite://{old}")
        self.assertEqual(store.get("legacy").job_kind, "TRAIN")


class ExtractionApiTests(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        base = Path(self.tmp.name)
        self.custom = base / "custom"
        self.extracted = base / "extracted"
        self.env = patch.dict(os.environ, {
            "PREDICTION_DATABASE_URL": f"sqlite://{base / 'jobs.sqlite'}",
            "PREDICTION_CUSTOM_DATASET_ROOT": str(self.custom),
            "PREDICTION_EXTRACTED_DATASET_ROOT": str(self.extracted),
            "WORKER_ARTIFACTS_DIR": str(base),
            "WORKER_MAX_CONCURRENT_JOBS": "1",
            "PREDICTION_MAX_QUEUED_JOBS": "2",
        })
        self.env.start()
        app.state.identity_provider = FakeIdentity()
        self.operator = TestClient(app, headers={"Authorization": "Bearer operator-token"})
        self.rector = TestClient(app, headers={"Authorization": "Bearer rector-token"})
        self.anonymous = TestClient(app)
        self.dispatch = patch("training.tasks.extract_dataset_task.apply_async")
        self.dispatch_mock = self.dispatch.start()
        self.train_dispatch = patch("training.tasks.train_model_task.apply_async")
        self.train_dispatch.start()

    def tearDown(self) -> None:
        self.dispatch.stop()
        self.train_dispatch.stop()
        del app.state.identity_provider
        self.env.stop()
        self.tmp.cleanup()

    def _extract(self, key: str, **body):
        payload = {"task_code": DROPOUT, "cadence": "SEMESTRAL", "programs": ["P01"], **body}
        return self.operator.post("/v1/dataset-extractions", json=payload, headers={"Idempotency-Key": key})

    def test_extraction_is_queued_dispatched_and_idempotent(self) -> None:
        response = self._extract("extract-key-000001", horizon_years=4)
        self.assertEqual(response.status_code, 202, response.text)
        job = response.json()
        self.assertEqual((job["job_kind"], job["status"], job["algorithm"]), ("EXTRACT_DATASET", "QUEUED", ""))
        self.assertTrue(job["dataset_ref"].startswith("custom:"))
        self.assertEqual(job["params"]["horizon_years"], 4)
        self.dispatch_mock.assert_called_once()
        self.assertEqual(self.dispatch_mock.call_args.kwargs["kwargs"], {"job_id": job["job_id"]})
        again = self._extract("extract-key-000001", horizon_years=4)
        self.assertEqual(again.json()["job_id"], job["job_id"])
        conflict = self._extract("extract-key-000001", horizon_years=3)
        self.assertEqual(conflict.status_code, 409)

    def test_invalid_requests_and_permissions(self) -> None:
        invalid = self._extract("extract-key-000002", task_code="COURSE_FAILURE", cadence="ANUAL")
        self.assertEqual((invalid.status_code, invalid.json()["code"]), (422, "INVALID_CADENCE"))
        payload = {"task_code": DROPOUT, "cadence": "SEMESTRAL"}
        self.assertEqual(self.rector.post("/v1/dataset-extractions", json=payload,
                                          headers={"Idempotency-Key": "extract-key-000003"}).status_code, 403)
        self.assertEqual(self.anonymous.get("/v1/jobs").status_code, 401)
        self.assertEqual(self.rector.get("/v1/jobs").status_code, 403)
        self.assertEqual(self.rector.get("/v1/datasets/fixture:pred003_synthetic-v1/profile").status_code, 403)

    def test_extraction_needs_configured_storage(self) -> None:
        with patch.dict(os.environ, {"PREDICTION_EXTRACTED_DATASET_ROOT": ""}):
            response = self._extract("extract-key-000004")
        self.assertEqual((response.status_code, response.json()["code"]), (503, "DATASET_STORAGE_UNAVAILABLE"))

    def test_job_list_mixes_kinds_and_filters(self) -> None:
        extraction = self._extract("extract-key-000005").json()
        training = self.operator.post("/v1/training-jobs", headers={"Idempotency-Key": "train-key-0000001"},
                                      json={"dataset_ref": "fixture:pred003_synthetic-v1", "algorithm": "xgboost"}).json()
        listed = self.operator.get("/v1/jobs").json()
        self.assertEqual({job["job_id"] for job in listed}, {extraction["job_id"], training["job_id"]})
        self.assertEqual([j["job_id"] for j in self.operator.get("/v1/jobs?kind=EXTRACT_DATASET").json()],
                         [extraction["job_id"]])
        self.assertEqual(self.operator.get("/v1/jobs?kind=OTHER").status_code, 422)
        self.assertEqual(self.operator.get(f"/v1/jobs/{training['job_id']}").json()["job_kind"], "TRAIN")
        self.assertEqual(self.operator.get("/v1/jobs/not-a-uuid").status_code, 404)

    def test_cancel_running_and_finished_jobs(self) -> None:
        job_id = self._extract("extract-key-000006").json()["job_id"]
        store = JobStore()
        store.claim_attempt(job_id)
        cancelled = self.operator.post(f"/v1/jobs/{job_id}/cancel")
        self.assertEqual((cancelled.status_code, cancelled.json()["status"]), (200, "CANCELLED"))
        again = self.operator.post(f"/v1/jobs/{job_id}/cancel")
        self.assertEqual((again.status_code, again.json()["code"]), (409, "JOB_NOT_CANCELLABLE"))
        missing = self.operator.post("/v1/jobs/9d2c0e7a-5e2f-4c8b-9f9c-2f5e3d4c6b32/cancel")
        self.assertEqual(missing.status_code, 404)

    def test_profile_and_sample_of_an_extracted_dataset(self) -> None:
        run_extraction(validate_params({"task_code": DROPOUT, "cadence": "SEMESTRAL", "programs": ["P01"],
                                        "features": ["materias_cursadas", "materias_reprobadas", "ppa_acumulado"]}),
                       dsn="postgresql://fake", output_root=self.extracted, dataset_id=DS_API, job_id="j",
                       requested_by="op", extract=fake_dropout_extract)
        listed = {item["dataset_ref"] for item in self.operator.get("/v1/datasets").json()}
        self.assertIn(f"custom:{DS_API}", listed)
        profile = self.operator.get(f"/v1/datasets/custom:{DS_API}/profile")
        self.assertEqual(profile.status_code, 200, profile.text)
        self.assertEqual(profile.json()["dataset_id"], DS_API)
        sample = self.operator.get(f"/v1/datasets/custom:{DS_API}/sample?limit=2").json()
        self.assertEqual(len(sample["rows"]), 2)
        self.assertIn("student_ref", sample["columns"])
        self.assertNotIn("subject_ref", sample["columns"])
        self.assertEqual(set(sample["rows"][0]), set(sample["columns"]))
        self.assertEqual(self.operator.get("/v1/datasets/custom:missing/profile").status_code, 404)
        self.assertEqual(self.operator.get("/v1/datasets/..%2Fescape/sample").status_code, 404)
        self.assertEqual(self.operator.get(f"/v1/datasets/custom:{DS_API}/sample?limit=500").status_code, 422)

    def test_profile_is_computed_for_datasets_without_one(self) -> None:
        shutil.copytree(FIXTURES / "pred003_synthetic", self.custom / "legacy")
        response = self.operator.get("/v1/datasets/custom:legacy/profile")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["row_count"], len(
            (FIXTURES / "pred003_synthetic" / "rows.jsonl").read_text(encoding="utf-8").splitlines()))
        self.assertFalse((self.custom / "legacy" / "profile.json").exists())
        fixture = self.operator.get("/v1/datasets/fixture:pred003_synthetic-v1/profile")
        self.assertEqual(fixture.status_code, 200)


if __name__ == "__main__":
    unittest.main()
