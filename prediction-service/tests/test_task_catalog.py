"""PRED-101: the task catalog is the single source of prediction targets."""
from __future__ import annotations

import re
import unittest
from pathlib import Path

from fastapi.testclient import TestClient

from feature_contract import COURSE_ABANDONMENT_EVENT, COURSE_FAILURE_EVENT, PROGRAM_DROPOUT_EVENT
from main import PredictionRequest, app
from ml_tasks import UnknownTask, get_task, list_tasks, servable_event_codes, task_for_event_type
from ml_tasks.catalog import event_code_pattern, event_type_pattern
from tests.test_training_api import FakeIdentity
from training.model_registry import ModelRegistry, NoActiveModel

SERVICE_ROOT = Path(__file__).resolve().parent.parent


class TaskCatalogTests(unittest.TestCase):
    def test_registers_the_existing_events(self) -> None:
        codes = {task.code for task in list_tasks()}
        self.assertEqual(codes, {PROGRAM_DROPOUT_EVENT, COURSE_ABANDONMENT_EVENT, COURSE_FAILURE_EVENT})
        self.assertEqual(len(codes), len(list_tasks()))

    def test_serving_event_types_map_to_tasks(self) -> None:
        self.assertEqual(task_for_event_type("program_dropout").code, PROGRAM_DROPOUT_EVENT)
        self.assertEqual(task_for_event_type("course_abandonment").code, COURSE_ABANDONMENT_EVENT)
        self.assertTrue(task_for_event_type("course_abandonment").requires_course_ref)
        with self.assertRaises(UnknownTask):
            task_for_event_type("unknown")
        with self.assertRaises(UnknownTask):
            get_task("UNKNOWN")

    def test_only_tasks_with_a_serving_path_are_servable(self) -> None:
        self.assertEqual(servable_event_codes(), {PROGRAM_DROPOUT_EVENT, COURSE_ABANDONMENT_EVENT})
        self.assertFalse(get_task(COURSE_FAILURE_EVENT).servable)
        self.assertEqual(get_task(COURSE_FAILURE_EVENT).cadences, ("SEMESTRAL",))

    def test_definition_references_come_from_the_catalog(self) -> None:
        task = get_task(PROGRAM_DROPOUT_EVENT)
        self.assertEqual(task.target_definition_ref, f"catalog:{PROGRAM_DROPOUT_EVENT}:target:v1")
        self.assertEqual(task.population_definition_ref, f"catalog:{PROGRAM_DROPOUT_EVENT}:population:v1")

    def test_classification_tasks_declare_distinct_classes(self) -> None:
        for task in list_tasks():
            if task.kind == "classification":
                self.assertTrue(task.positive_class and task.negative_class, task.code)
                self.assertNotEqual(task.positive_class, task.negative_class, task.code)
            self.assertTrue(task.algorithms, task.code)
            self.assertTrue(set(task.cadences) <= {"ANUAL", "SEMESTRAL"}, task.code)

    def test_api_patterns_follow_the_catalog(self) -> None:
        self.assertRegex("program_dropout", event_type_pattern())
        self.assertRegex("course_abandonment", event_type_pattern())
        self.assertNotRegex("course_failure", event_type_pattern())
        self.assertRegex(PROGRAM_DROPOUT_EVENT, event_code_pattern())
        self.assertNotRegex(COURSE_FAILURE_EVENT, event_code_pattern())

    def test_prediction_request_course_ref_rule_comes_from_the_task(self) -> None:
        base = {"contract_version": "1.0", "subject_ref": "s", "program_ref": "P01",
                "academic_cut": {"cut_id": "10"}}
        with self.assertRaises(ValueError):
            PredictionRequest(**base, event_type="course_abandonment")
        with self.assertRaises(ValueError):
            PredictionRequest(**base, event_type="program_dropout", course_ref="MAT101")
        self.assertEqual(PredictionRequest(**base, event_type="course_abandonment", course_ref="MAT101").course_ref, "MAT101")

    def test_registry_scope_rejects_events_outside_the_catalog(self) -> None:
        self.assertEqual(ModelRegistry._scope_key(PROGRAM_DROPOUT_EVENT, "ANUAL"), f"{PROGRAM_DROPOUT_EVENT}|ANUAL")
        with self.assertRaises(NoActiveModel):
            ModelRegistry._scope_key(COURSE_FAILURE_EVENT, "SEMESTRAL")
        with self.assertRaises(NoActiveModel):
            ModelRegistry._scope_key(PROGRAM_DROPOUT_EVENT, "TRIMESTRAL")

    def test_no_hardcoded_event_sets_outside_the_catalog(self) -> None:
        pattern = re.compile(r"\{\s*\"COURSE_ABANDONMENT\"\s*,\s*\"PROGRAM_DROPOUT_NEXT_EXPECTED_CLOSURE\"\s*\}")
        for path in ("main.py", "inference.py", "inference_adapters.py",
                     "training/model_registry.py", "training/trainer.py"):
            text = (SERVICE_ROOT / path).read_text(encoding="utf-8")
            self.assertIsNone(pattern.search(text), path)
            self.assertNotIn('== "course_abandonment" else', text, path)


class TaskCatalogApiTests(unittest.TestCase):
    def setUp(self) -> None:
        app.state.identity_provider = FakeIdentity()
        self.client = TestClient(app)
        self.operator = TestClient(app, headers={"Authorization": "Bearer operator-token"})
        self.rector = TestClient(app, headers={"Authorization": "Bearer rector-token"})

    def tearDown(self) -> None:
        del app.state.identity_provider

    def test_only_ml_operators_can_read_the_catalog(self) -> None:
        self.assertEqual(self.client.get("/v1/ml-tasks").status_code, 401)
        self.assertEqual(self.rector.get("/v1/ml-tasks").status_code, 403)

    def test_lists_the_catalog(self) -> None:
        response = self.operator.get("/v1/ml-tasks")
        self.assertEqual(response.status_code, 200, response.text)
        tasks = {item["code"]: item for item in response.json()}
        self.assertEqual(set(tasks), {PROGRAM_DROPOUT_EVENT, COURSE_ABANDONMENT_EVENT, COURSE_FAILURE_EVENT})
        dropout = tasks[PROGRAM_DROPOUT_EVENT]
        self.assertEqual(dropout["kind"], "classification")
        self.assertEqual(dropout["serving_event_type"], "program_dropout")
        self.assertTrue(dropout["servable"])
        self.assertEqual(dropout["algorithms"], ["random_forest", "xgboost"])
        self.assertEqual(dropout["target_definition_ref"], f"catalog:{PROGRAM_DROPOUT_EVENT}:target:v1")
        self.assertFalse(tasks[COURSE_FAILURE_EVENT]["servable"])


if __name__ == "__main__":
    unittest.main()
