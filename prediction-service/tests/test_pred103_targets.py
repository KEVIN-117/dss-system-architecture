"""PRED-103: student and enrolment targets, regression training, serving and publication."""
from __future__ import annotations

import json
import os
import sqlite3
import tempfile
import unittest
from datetime import datetime, timezone
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

from fastapi.testclient import TestClient

from dataset_contract import validate_prepared_dataset
from evaluation.comparison import compare_artifacts
from evaluation.metrics import regression_metrics
from feature_contract import (
    COURSE_FAILURE_EVENT,
    COURSE_FAILURE_FEATURES,
    COURSE_FINAL_GRADE_EVENT,
    PROGRAM_DROPOUT_EVENT,
    STUDENT_BACKLOG_EVENT,
    STUDENT_GPA_EVENT,
    contract_digest,
    contract_query,
    program_dropout_query,
)
from inference import InferenceFailure, score_bundle, score_loaded_model
from main import app
from preparation.pipeline import prepare_for_task
from preparation.profiling import profile_dataset
from tests.test_training_api import FakeIdentity
from training.artifact_writer import write_training_artifacts
from training.course_extract import build_course_failure_snapshot
from training.dataset_extraction import run_extraction, validate_params
from training.model_registry import ModelRegistry
from training.prediction_publication_store import PredictionPublicationStore
from training.student_extract import build_student_next_cut_snapshot
from training.trainer import train_for_partition

RUN_ID = "8ef1a80e-a16a-4e89-88e2-45d2d5fab02a"
STUDENT_FEATURES = ["materias_cursadas", "materias_reprobadas", "materias_arrastradas", "ppa_acumulado"]
STUDENT_CUTS = [
    {"closure_id": "101", "effective_at": datetime(2025, 7, 1, tzinfo=timezone.utc), "year": 2025, "period": 1},
    {"closure_id": "102", "effective_at": datetime(2025, 12, 1, tzinfo=timezone.utc), "year": 2025, "period": 2},
    {"closure_id": "103", "effective_at": datetime(2026, 7, 1, tzinfo=timezone.utc), "year": 2026, "period": 1},
    {"closure_id": "104", "effective_at": datetime(2026, 12, 1, tzinfo=timezone.utc), "year": 2026, "period": 2},
]
COURSE_FEATURES = list(COURSE_FAILURE_FEATURES)
COURSE_CUTS = [
    {"closure_id": "201", "effective_at": datetime(2016, 7, 1, tzinfo=timezone.utc)},
    {"closure_id": "203", "effective_at": datetime(2017, 7, 1, tzinfo=timezone.utc)},
]


def student_row(subject: int, cut: dict, *, backlog: int, gpa: float, start=(2025, 1)) -> dict:
    """Shaped like program_dropout_query output (plus program_ref)."""
    return {
        "subject_ref": str(subject), "program_ref": "P01",
        "materias_cursadas": 6, "materias_aprobadas": 6 - backlog, "materias_reprobadas": backlog,
        "materias_arrastradas": backlog, "ppa_acumulado": gpa, "cortes_previos": 1,
        "cut_id": cut["closure_id"], "cut_year": cut["year"], "cut_period": cut["period"],
        "start_year": start[0], "start_period": start[1], "enrollment_date": "2025-02-01",
        "cadence_count": 1, "program_regime": "S", "source_run_id": RUN_ID, "resultado_retencion": "RETENIDO",
        "es_desercion": False, "conteo_snapshot": 1, "conteo_evaluable": 1, "conteo_desercion": 0,
    }


def student_rows() -> list[dict]:
    """Two cohorts, each observed at a cut and the next; backlog rises for every third student."""
    rows = []
    for cohort, (first, second, start) in enumerate(((STUDENT_CUTS[0], STUDENT_CUTS[1], (2025, 1)),
                                                     (STUDENT_CUTS[2], STUDENT_CUTS[3], (2026, 1)))):
        for subject in range(1 + 60 * cohort, 61 + 60 * cohort):
            backlog = subject % 4
            gpa = 50.0 + subject % 20
            rows.append(student_row(subject, first, backlog=backlog, gpa=gpa, start=start))
            rows.append(student_row(subject, second, backlog=backlog + (1 if subject % 3 == 0 else 0),
                                    gpa=gpa + 0.5 * (subject % 5) - 1, start=start))
    # Present only once at a cut that has a later one: absent next cut.
    rows.append(student_row(900, STUDENT_CUTS[0], backlog=1, gpa=60.0))
    return rows


def course_row(subject: int, course: int, *, cut_id: str, year: int, load: int, grade: float | None,
               passed: bool = True) -> dict:
    """Shaped like course_failure_query output (plus program_ref)."""
    row = {name: 1 for name in COURSE_FEATURES}
    row.update(carga_periodo=load, subject_ref=str(subject), course_ref=str(course), program_ref="SIS", cut_id=cut_id,
               cut_year=year, cut_period=1, start_t=year * 2, history_start_t=4000, program_regime="S",
               source_run_id="00000000-0000-0000-0000-000000000001", es_aprobado=passed,
               es_reprobado=not passed, es_abandono=False, final_grade=grade)
    return row


def course_rows() -> list[dict]:
    rows = []
    for cohort, (cut_id, year) in enumerate((("201", 2016), ("203", 2017))):
        for subject in range(1 + 50 * cohort, 51 + 50 * cohort):
            load = 3 + subject % 4
            grade = 30.0 + 10 * load + (subject % 3)
            rows.append(course_row(subject, 10, cut_id=cut_id, year=year, load=load, grade=grade, passed=subject % 3 != 0))
    rows.append(course_row(999, 10, cut_id="203", year=2017, load=4, grade=None))
    return rows


def write_bundle(root: Path, name: str, partition, result, manifest: dict) -> dict:
    """Persist a training result exactly as the worker task does."""
    if manifest.get("feature_contract") is not None:
        result.manifest["feature_contract"] = manifest["feature_contract"]
    return write_training_artifacts(
        job_id=name, artifacts_dir=root, model=result.model, preprocessing_pipeline=result.preprocessing_pipeline,
        manifest=result.manifest, metrics=result.metrics, training_config=result.training_config,
        balance_report=result.balance_report, feature_names=result.feature_names,
        dependency_lock=result.dependency_lock,
        dataset_ref={"dataset_ref": f"custom:{manifest['dataset_id']}", "manifest_ref": partition.manifest_ref,
                     "dataset_id": manifest["dataset_id"], "dataset_digest": manifest["content_digest"],
                     "snapshot_ref": manifest["snapshot_ref"], "target_definition_ref": manifest["target_definition_ref"],
                     "population_definition_ref": manifest["population_definition_ref"], "fixture_only": False,
                     "source": manifest["source"], "academic_cut": manifest["academic_cut"],
                     "partition_id": partition.partition_metadata["partition_id"],
                     "split_method": partition.partition_metadata["split_method"],
                     "target_definition": manifest["target_definition"]},
        feature_schema=[{"name": f["name"], "logical_type": f["logical_type"], "nullable": f.get("nullable", True),
                         "available_at_cut": f.get("available_at_cut"), "source_field": f.get("source_field")}
                        for f in manifest["fields"] if f.get("role") == "feature"],
    ) or json.loads((root / name / "manifest.json").read_text(encoding="utf-8"))


class FeatureContractReuseTests(unittest.TestCase):
    def test_dropout_query_and_digest_are_unchanged_by_student_targets(self) -> None:
        self.assertEqual(contract_query(PROGRAM_DROPOUT_EVENT, STUDENT_FEATURES), program_dropout_query(STUDENT_FEATURES))
        self.assertEqual(contract_query(STUDENT_GPA_EVENT, STUDENT_FEATURES), program_dropout_query(STUDENT_FEATURES))
        # Each event binds its own digest, so bundles cannot serve another event.
        digests = {contract_digest(code) for code in (PROGRAM_DROPOUT_EVENT, STUDENT_BACKLOG_EVENT, STUDENT_GPA_EVENT)}
        self.assertEqual(len(digests), 3)

    def test_course_query_has_serving_filters_and_audit_grade(self) -> None:
        sql = contract_query(COURSE_FINAL_GRADE_EVENT, COURSE_FEATURES)
        self.assertIn("%(subject)s::bigint IS NULL", sql)
        self.assertIn("%(course)s::text IS NULL", sql)
        feature_part = sql.split("SELECT cur.id_alumno::text AS subject_ref", 1)[1].split("c.closure_id::text AS cut_id", 1)[0]
        self.assertNotIn("nota_final", feature_part)
        self.assertIn("cur.nota_final AS final_grade", sql)


class StudentTargetExtractionTests(unittest.TestCase):
    def _snapshot(self, task_code: str):
        return build_student_next_cut_snapshot(
            student_rows(), task_code=task_code, program_ref="P01", cadence="SEMESTRAL",
            feature_names=STUDENT_FEATURES, cuts=STUDENT_CUTS, pseudonym_key=b"k" * 32)

    def test_backlog_labels_and_exclusions(self) -> None:
        manifest, rows = self._snapshot(STUDENT_BACKLOG_EVENT)
        self.assertEqual(len(rows), 120)
        self.assertEqual(sum(r["target_class"] == "RISK" for r in rows), 40)
        # Cohort A's second cut and student 900 have no row at the next cut; cohort B's
        # second cut is the last processed one.
        self.assertEqual(manifest["exclusions"], {"ABSENT_NEXT_CUT": 61, "NEXT_CUT_NOT_OBSERVED": 60})
        self.assertTrue(all(r["next_cut_id"] in {"102", "104"} for r in rows))
        report = validate_prepared_dataset(manifest, rows)
        self.assertEqual(report.status, "READY_FOR_PREPARATION", [i.code for i in report.issues])

    def test_gpa_target_is_the_next_cut_value(self) -> None:
        manifest, rows = self._snapshot(STUDENT_GPA_EVENT)
        self.assertEqual(manifest["target_definition"]["kind"], "regression")
        self.assertEqual(manifest["target_field"], "target_value")
        first = next(r for r in rows if r["cut_id"] == "101" and r["ppa_acumulado"] == 51.0)
        self.assertAlmostEqual(first["target_value"], 51.0 + 0.5 * (1 % 5) - 1)
        report = validate_prepared_dataset(manifest, rows)
        self.assertEqual(report.status, "READY_FOR_PREPARATION", [i.code for i in report.issues])
        profile = profile_dataset(manifest, rows, "regression")
        self.assertNotIn("POSSIBLE_LEAKAGE", {w["code"] for w in profile["warnings"]})
        self.assertTrue(next(f for f in profile["features"] if f["name"] == "ppa_acumulado")["label_source_feature"])

    def test_label_source_feature_is_required(self) -> None:
        with self.assertRaisesRegex(ValueError, "ppa_acumulado"):
            build_student_next_cut_snapshot(student_rows(), task_code=STUDENT_GPA_EVENT, program_ref="P01",
                                            cadence="SEMESTRAL", feature_names=["materias_cursadas"], cuts=STUDENT_CUTS)
        params = validate_params({"task_code": STUDENT_GPA_EVENT, "cadence": "SEMESTRAL", "features": ["materias_cursadas"]})
        self.assertEqual(params.features, ("materias_cursadas", "ppa_acumulado"))


class CourseTargetExtractionTests(unittest.TestCase):
    def test_final_grade_snapshot_is_valid_regression_data(self) -> None:
        manifest, rows = build_course_failure_snapshot(course_rows(), programs=["SIS"], feature_names=COURSE_FEATURES,
                                                       cuts=COURSE_CUTS, pseudonym_key=b"k" * 32,
                                                       task_code=COURSE_FINAL_GRADE_EVENT)
        self.assertEqual(manifest["exclusions"], {"NO_FINAL_GRADE": 1})
        self.assertTrue(all(isinstance(r["target_value"], float) and "target_class" not in r for r in rows))
        report = validate_prepared_dataset(manifest, rows)
        self.assertEqual(report.status, "READY_FOR_PREPARATION", [i.code for i in report.issues])

    def test_course_failure_snapshot_now_passes_the_contract(self) -> None:
        # PRED-102 accepted COURSE_FAILURE extractions the retention-only contract always rejected.
        manifest, rows = build_course_failure_snapshot(course_rows(), programs=["SIS"], feature_names=COURSE_FEATURES,
                                                       cuts=COURSE_CUTS, pseudonym_key=b"k" * 32)
        report = validate_prepared_dataset(manifest, rows)
        self.assertEqual(report.status, "READY_FOR_PREPARATION", [i.code for i in report.issues])

    def test_event_contract_rejects_bad_regression_targets(self) -> None:
        manifest, rows = build_course_failure_snapshot(course_rows(), programs=["SIS"], feature_names=COURSE_FEATURES,
                                                       cuts=COURSE_CUTS, task_code=COURSE_FINAL_GRADE_EVENT)
        broken = [dict(rows[0], target_value="alto"), *rows[1:]]
        codes = {i.code for i in validate_prepared_dataset(manifest, broken).issues}
        self.assertIn("INVALID_TARGET_VALUE", codes)
        constant = [dict(row, target_value=50.0) for row in rows]
        from dataset_contract import compute_snapshot_digest
        report = validate_prepared_dataset(dict(manifest, content_digest=compute_snapshot_digest(constant)), constant)
        self.assertEqual(report.status, "BLOCKED")
        self.assertIn("INSUFFICIENT_TARGET_VARIANCE", {i.code for i in report.issues})
        report = validate_prepared_dataset(dict(manifest, grain="student_program_academic_cut"), rows)
        self.assertIn("UNSUPPORTED_GRAIN", {i.code for i in report.issues})

    def test_extraction_service_publishes_new_targets(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            for task_code, extract, dataset_id in (
                (STUDENT_BACKLOG_EVENT, lambda *a: (student_rows(), STUDENT_CUTS), "0b4f7c1e-1d2a-4f5b-8c6d-7e8f9a0b1d01"),
                (COURSE_FINAL_GRADE_EVENT, lambda *a: (course_rows(), COURSE_CUTS), "0b4f7c1e-1d2a-4f5b-8c6d-7e8f9a0b1d02"),
            ):
                params = validate_params({"task_code": task_code, "cadence": "SEMESTRAL", "programs": ["P01"]})
                result = run_extraction(params, dsn="postgresql://fake", output_root=Path(tmp), dataset_id=dataset_id,
                                        job_id="j", requested_by="op", extract=extract)
                self.assertEqual(result.status, "READY_FOR_PREPARATION")
                profile = json.loads((Path(tmp) / dataset_id / "profile.json").read_text(encoding="utf-8"))
                self.assertEqual(profile["event_code"], task_code)


class RegressionMetricsTests(unittest.TestCase):
    def test_metrics(self) -> None:
        metrics = regression_metrics([10, 20, 30, 40], [12, 18, 33, 40])
        self.assertAlmostEqual(metrics["mae"], 1.75)
        self.assertAlmostEqual(metrics["rmse"], (4 + 4 + 9 + 0) ** 0.5 / 2)
        self.assertAlmostEqual(metrics["bias"], 0.75)
        self.assertGreater(metrics["r2"], 0.9)
        self.assertEqual(sum(b["count"] for b in metrics["residuals_by_bucket"]), 4)
        self.assertIsNone(regression_metrics([5, 5], [4, 6])["r2"])
        self.assertEqual(regression_metrics([0, 2], [1, 2])["mape_skipped_zero_observations"], 1)


class RegressionTrainingAndServingTests(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        self.manifest, rows = build_student_next_cut_snapshot(
            student_rows(), task_code=STUDENT_GPA_EVENT, program_ref="P01", cadence="SEMESTRAL",
            feature_names=STUDENT_FEATURES, cuts=STUDENT_CUTS, pseudonym_key=b"k" * 32)
        self.manifest["dataset_id"] = "0b4f7c1e-1d2a-4f5b-8c6d-7e8f9a0b1e01"
        self.partition = prepare_for_task(self.manifest, rows, seed=7)

    def tearDown(self) -> None:
        self.tmp.cleanup()

    def _train(self, algorithm: str, name: str, grid: dict):
        result = train_for_partition(self.partition, algorithm, config={"search_space": grid}, cpu_limit=1, cv_splits=3)
        write_bundle(self.root, name, self.partition, result, self.manifest)
        return result

    def test_partition_is_regression_without_resampling(self) -> None:
        self.assertEqual(self.partition.partition_metadata["task_kind"], "regression")
        self.assertEqual(self.partition.partition_metadata["cv_method"], "group_k_fold")
        self.assertFalse(self.partition.apply_balancing)
        self.assertEqual(self.partition.balance_report.original_distribution, {})

    def test_ridge_trains_activates_and_serves_a_value_with_intervals(self) -> None:
        result = self._train("ridge", "gpa-ridge", {"alpha": [0.1, 1.0]})
        tuning = result.training_config["tuning"]
        self.assertEqual(tuning["method"], "GroupKFold")
        self.assertFalse(tuning["outer_test_used_for_selection"])
        self.assertLess(result.metrics["rmse"], 2.0)
        self.assertEqual(set(result.metrics["interval_coverage"]), {"0.8", "0.95"})
        offsets = result.manifest["prediction_interval"]["offsets"]
        self.assertLessEqual(offsets["0.95"][0], offsets["0.8"][0])
        self.assertGreaterEqual(offsets["0.95"][1], offsets["0.8"][1])
        self.assertEqual(result.manifest["serving_scope"]["event_type"], "student_gpa")

        registry = ModelRegistry(self.root)
        listed = next(m for m in registry.list_models() if m["algorithm"] == "ridge")
        self.assertEqual(listed["task_kind"], "regression")
        self.assertIsNotNone(listed["regression_metrics"]["rmse"])
        self.assertTrue(listed["activatable"])
        registry.activate(result.manifest["model_id"], result.manifest["version"], "op", "Mejor RMSE")
        bundle = registry.active(STUDENT_GPA_EVENT, "SEMESTRAL")
        scored = score_bundle(bundle, {"materias_cursadas": 6, "materias_reprobadas": 1,
                                       "materias_arrastradas": 1, "ppa_acumulado": 61.0})
        self.assertEqual((scored["task_kind"], scored["predicted_class"]), ("regression", None))
        self.assertAlmostEqual(scored["predicted_value"], 61.0, delta=3.0)
        self.assertLess(scored["prediction_interval"]["0.8"]["lower"], scored["predicted_value"] + 1e-9)
        self.assertEqual(scored["unit"], "puntos de PPA")
        with self.assertRaises(InferenceFailure):
            score_loaded_model(bundle, {"materias_cursadas": 6, "materias_reprobadas": 1,
                                        "materias_arrastradas": 1, "ppa_acumulado": 61.0})

    def test_regression_candidates_are_compared_by_validation_rmse(self) -> None:
        self._train("ridge", "gpa-ridge", {"alpha": [1.0]})
        self._train("random_forest", "gpa-rf", {"n_estimators": [20], "max_depth": [3], "min_samples_leaf": [1]})
        report = compare_artifacts([self.root / "gpa-ridge", self.root / "gpa-rf"])
        self.assertEqual(report["task_kind"], "regression")
        self.assertIn("RMSE", report["selection_rule"])
        best = min(report["models"], key=lambda m: m["validation"]["mean_rmse"])
        self.assertEqual(report["selected_candidate_by_validation"], best["model_id"])

    def test_backlog_classifier_trains_on_the_event_contract(self) -> None:
        manifest, rows = build_student_next_cut_snapshot(
            student_rows(), task_code=STUDENT_BACKLOG_EVENT, program_ref="P01", cadence="SEMESTRAL",
            feature_names=STUDENT_FEATURES, cuts=STUDENT_CUTS, pseudonym_key=b"k" * 32)
        partition = prepare_for_task(manifest, rows, seed=7)
        self.assertEqual(partition.partition_metadata["task_kind"], "classification")
        result = train_for_partition(partition, "random_forest",
                                     config={"search_space": {"n_estimators": [20], "max_depth": [3]}},
                                     cpu_limit=1, cv_splits=3)
        self.assertEqual(result.manifest["classes"]["event_code"], STUDENT_BACKLOG_EVENT)
        self.assertEqual(result.manifest["serving_scope"]["event_type"], "student_backlog")


class TrainingRequestApiTests(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        base = Path(self.tmp.name)
        self.custom = base / "custom"
        self.env = patch.dict(os.environ, {
            "PREDICTION_DATABASE_URL": f"sqlite://{base / 'jobs.sqlite'}",
            "PREDICTION_CUSTOM_DATASET_ROOT": str(self.custom),
            "WORKER_ARTIFACTS_DIR": str(base),
            "WORKER_MAX_CONCURRENT_JOBS": "1",
            "PREDICTION_MAX_QUEUED_JOBS": "4",
        })
        self.env.start()
        app.state.identity_provider = FakeIdentity()
        self.client = TestClient(app, headers={"Authorization": "Bearer operator-token"})
        self.dispatch = patch("training.tasks.train_model_task.apply_async")
        self.dispatch.start()
        manifest, rows = build_student_next_cut_snapshot(
            student_rows(), task_code=STUDENT_GPA_EVENT, program_ref="P01", cadence="SEMESTRAL",
            feature_names=STUDENT_FEATURES, cuts=STUDENT_CUTS)
        folder = self.custom / "gpa"
        folder.mkdir(parents=True)
        (folder / "manifest.json").write_text(json.dumps(manifest), encoding="utf-8")
        (folder / "rows.jsonl").write_text("\n".join(json.dumps(r) for r in rows), encoding="utf-8")

    def tearDown(self) -> None:
        self.dispatch.stop()
        del app.state.identity_provider
        self.env.stop()
        self.tmp.cleanup()

    def _job(self, key: str, **body):
        return self.client.post("/v1/training-jobs", json=body, headers={"Idempotency-Key": key})

    def test_algorithms_and_search_spaces_are_checked_against_the_task(self) -> None:
        self.assertEqual(self._job("ridge-key-000000001", dataset_ref="custom:gpa", algorithm="ridge",
                                   search_space={"alpha": [0.5, 2.0]}).status_code, 202)
        rejected = self._job("ridge-key-000000002", dataset_ref="fixture:pred003_synthetic-v1", algorithm="ridge")
        self.assertEqual((rejected.status_code, rejected.json()["code"]), (422, "INVALID_TRAINING_REQUEST"))
        for space in ({"alpha": [0]}, {"depth": [3]}, {"alpha": list(range(1, 12))}):
            response = self._job("ridge-key-000000003", dataset_ref="custom:gpa", algorithm="ridge", search_space=space)
            self.assertEqual(response.status_code, 422, space)
        big = {"n_estimators": [10, 20, 30, 40], "max_depth": [2, 3, 4, 5], "min_samples_leaf": [1, 2, 3, 4, 5]}
        self.assertEqual(self._job("rf-key-0000000004", dataset_ref="custom:gpa", algorithm="random_forest",
                                   search_space=big).status_code, 422)

    def test_study_creates_one_job_per_algorithm_idempotently(self) -> None:
        body = {"dataset_ref": "custom:gpa", "algorithms": ["ridge", "random_forest", "xgboost"],
                "search_spaces": {"ridge": {"alpha": [1.0]}}}
        response = self.client.post("/v1/training-studies", json=body, headers={"Idempotency-Key": "study-key-00000001"})
        self.assertEqual(response.status_code, 202, response.text)
        study = response.json()
        self.assertEqual(study["task_code"], STUDENT_GPA_EVENT)
        self.assertEqual(sorted(job["algorithm"] for job in study["jobs"]), ["random_forest", "ridge", "xgboost"])
        self.assertEqual({job["study_id"] for job in study["jobs"]}, {study["study_id"]})
        again = self.client.post("/v1/training-studies", json=body, headers={"Idempotency-Key": "study-key-00000001"})
        self.assertEqual({j["job_id"] for j in again.json()["jobs"]}, {j["job_id"] for j in study["jobs"]})
        conflict = self.client.post("/v1/training-studies", json={**body, "algorithms": ["ridge", "xgboost", "random_forest"],
                                                                   "search_spaces": {"ridge": {"alpha": [2.0]}}},
                                    headers={"Idempotency-Key": "study-key-00000001"})
        self.assertEqual(conflict.status_code, 409)
        listed = self.client.get(f"/v1/jobs?study_id={study['study_id']}").json()
        self.assertEqual(len(listed), 3)
        capacity = self.client.post("/v1/training-studies", json={**body, "search_spaces": None},
                                    headers={"Idempotency-Key": "study-key-00000002"})
        self.assertEqual(capacity.status_code, 429)
        mismatch = self.client.post("/v1/training-studies",
                                    json={"dataset_ref": "fixture:pred003_synthetic-v1", "algorithms": ["ridge"]},
                                    headers={"Idempotency-Key": "study-key-00000003"})
        self.assertEqual(mismatch.status_code, 422)


class RegressionPublicationStoreTests(unittest.TestCase):
    def test_regression_rows_publish_per_event_and_old_files_upgrade(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            db = Path(tmp) / "pub.sqlite"
            with sqlite3.connect(db) as c:
                c.execute("""CREATE TABLE prediction_results (batch_id TEXT NOT NULL, subject_ref TEXT NOT NULL,
                    program_ref TEXT NOT NULL, closure_id TEXT NOT NULL, predicted_class TEXT NOT NULL,
                    event_probability REAL, model_id TEXT NOT NULL, model_version TEXT NOT NULL,
                    generated_at TEXT NOT NULL, PRIMARY KEY(batch_id,subject_ref))""")
            c.close()
            store = PredictionPublicationStore(f"sqlite://{db}")
            now = datetime.now(timezone.utc).isoformat()
            for batch_id, event_code in (("b-gpa", STUDENT_GPA_EVENT), ("b-dropout", PROGRAM_DROPOUT_EVENT)):
                store.create({"batch_id": batch_id, "idempotency_key": f"k-{batch_id}",
                              "request_digest": store.digest("P01", "101", "m", "v", event_code),
                              "event_code": event_code, "program_ref": "P01", "closure_id": "101", "model_id": "m",
                              "model_version": "v", "submitted_by": "op", "authorized_scope": {}, "created_at": now},
                             "scope")
                store.claim_attempt(batch_id)
            store.publish("b-gpa", [{"subject_ref": "1", "program_ref": "P01", "closure_id": "101", "predicted_class": None,
                                     "event_probability": None, "predicted_value": 61.5,
                                     "prediction_interval": {"0.8": {"lower": 59.0, "upper": 64.0}},
                                     "model_id": "m", "model_version": "v", "generated_at": now}], [])
            store.publish("b-dropout", [{"subject_ref": "1", "program_ref": "P01", "closure_id": "101",
                                         "predicted_class": "POSITIVE_EVENT", "event_probability": 0.7,
                                         "model_id": "m", "model_version": "v", "generated_at": now}], [])
            self.assertEqual(store.current("P01", "101")["batch_id"], "b-dropout")
            gpa = store.current("P01", "101", STUDENT_GPA_EVENT)
            published = store.get(gpa["batch_id"], include_results=True)["results"][0]
            self.assertEqual(published["predicted_value"], 61.5)
            self.assertEqual(published["prediction_interval"]["0.8"]["upper"], 64.0)
            self.assertIsNone(published["predicted_class"])
        self.assertEqual(PredictionPublicationStore.digest("P01", "1", "m", "v"),
                         PredictionPublicationStore.digest("P01", "1", "m", "v", PROGRAM_DROPOUT_EVENT))
        self.assertNotEqual(PredictionPublicationStore.digest("P01", "1", "m", "v"),
                            PredictionPublicationStore.digest("P01", "1", "m", "v", STUDENT_GPA_EVENT))


class EnrollmentServingTests(unittest.TestCase):
    def test_course_level_serving_filters_the_contract_query(self) -> None:
        from inference_adapters import DwPredictionDataProvider
        from inference import ProgramContext

        provider = DwPredictionDataProvider.__new__(DwPredictionDataProvider)
        provider.database_url = "postgresql://fake"
        captured = {}

        class Cursor:
            description = [SimpleNamespace(name=n) for n in (*COURSE_FEATURES, "cut_year", "cut_period", "start_t",
                                                             "history_start_t", "program_regime")]

            def fetchall(self):
                return [(*([1] * len(COURSE_FEATURES)), 2017, 1, 4034, 4000, "S")]

        class Connection:
            def __enter__(self):
                return self

            def __exit__(self, *exc):
                return False

            def execute(self, sql, params):
                captured.update(sql=sql, params=params)
                return Cursor()

        provider._connect = lambda: Connection()
        context = ProgramContext("SIS", "SIS", 1, "203", 2017, 1, "2017-07-01T00:00:00+00:00", "SEMESTRAL")
        features = provider._load_enrollment_features(COURSE_FINAL_GRADE_EVENT, "15", context, COURSE_FEATURES, "10")
        self.assertEqual(set(features), set(COURSE_FEATURES))
        self.assertEqual((captured["params"]["subject"], captured["params"]["course"]), (15, "10"))
        self.assertEqual(captured["sql"], contract_query(COURSE_FINAL_GRADE_EVENT, COURSE_FEATURES))


class RegressionPredictionApiTests(unittest.TestCase):
    def test_regression_response_and_course_ref_rules(self) -> None:
        from uuid import uuid4

        class Stub:
            def predict(self, token, subject_ref, program_ref, cut_id, event_type, course_ref):
                return {"contract_version": "1.0", "prediction_id": uuid4(), "subject_ref": subject_ref,
                        "program_ref": program_ref, "event_type": event_type, "event_code": STUDENT_GPA_EVENT,
                        "course_ref": course_ref, "task_kind": "regression", "predicted_class": None,
                        "event_probability": None, "predicted_value": 63.2,
                        "prediction_interval": {"0.8": {"lower": 60.0, "upper": 66.0}}, "unit": "puntos de PPA",
                        "model": {"model_id": "m", "version": "v"}, "academic_cut": {"cut_id": cut_id},
                        "generated_at": datetime.now(timezone.utc)}

        app.state.prediction_service = Stub()
        client = TestClient(app, headers={"Authorization": "Bearer any"})
        base = {"contract_version": "1.0", "subject_ref": "100", "program_ref": "P01", "academic_cut": {"cut_id": "42"}}
        try:
            response = client.post("/v1/predictions", json={**base, "event_type": "student_gpa"})
            self.assertEqual(response.status_code, 200, response.text)
            body = response.json()
            self.assertEqual((body["task_kind"], body["predicted_value"], body["predicted_class"]),
                             ("regression", 63.2, None))
            self.assertEqual(body["prediction_interval"]["0.8"]["upper"], 66.0)
            self.assertEqual(client.post("/v1/predictions", json={**base, "event_type": "course_final_grade"}).status_code, 422)
            self.assertEqual(client.post("/v1/predictions", json={**base, "event_type": "student_gpa",
                                                                  "course_ref": "10"}).status_code, 422)
            self.assertEqual(client.post("/v1/predictions", json={**base, "event_type": "course_failure",
                                                                  "course_ref": "10"}).status_code, 200)
        finally:
            del app.state.prediction_service


if __name__ == "__main__":
    unittest.main()
