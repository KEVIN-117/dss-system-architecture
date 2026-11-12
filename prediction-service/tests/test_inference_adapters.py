from __future__ import annotations

import unittest
from types import SimpleNamespace
from unittest.mock import Mock, patch

from feature_contract import (
    COURSE_ABANDONMENT_EVENT,
    PROGRAM_DROPOUT_EVENT,
    contract_reference,
    field_definitions,
    program_dropout_query,
)
from inference import InferenceFailure, ProgramContext
from inference_adapters import DwPredictionDataProvider

PROGRAM_FEATURES = ["materias_cursadas", "materias_aprobadas", "ppa_acumulado"]
COURSE_FEATURES = ["materia_ciclo", "materia_nivel", "prior_course_count", "prior_abandonment_count"]


def _connection(rows: list[tuple], columns: list[str] | None = None) -> Mock:
    connection = Mock()
    cursor = Mock()
    cursor.fetchall.return_value = rows
    cursor.description = [SimpleNamespace(name=name) for name in (columns or [])]
    connection.__enter__ = Mock(return_value=connection)
    connection.__exit__ = Mock(return_value=False)
    connection.execute.return_value = cursor
    return connection


def _program_row(subject: str, *, cut_period: int = 1, start_year: int = 2025, start_period: int = 1,
                 cadence_count: int = 1, values: tuple = (5, 4, 3.2)) -> tuple[list[str], tuple]:
    columns = ["subject_ref", *PROGRAM_FEATURES, "cut_id", "cut_year", "cut_period", "start_year", "start_period",
               "enrollment_date", "cadence_count", "source_run_id", "resultado_retencion", "es_desercion",
               "conteo_snapshot", "conteo_evaluable", "conteo_desercion"]
    row = (subject, *values, "42", 2026, cut_period, start_year, start_period, "2025-02-01", cadence_count,
           "8ef1a80e-a16a-4e89-88e2-45d2d5fab02a", "NO_EVALUABLE", None, 1, 0, 0)
    return columns, row


class DwPredictionAdapterTests(unittest.TestCase):
    def setUp(self) -> None:
        self.context = ProgramContext("P01", "P01", 10, "42", 2026, 1, "2026-06-01T00:00:00+00:00", "SEMESTRAL")

    @staticmethod
    def _manifest(event_code: str, feature_names: list[str], contract: bool = True) -> dict:
        manifest = {
            "classes": {"event_code": event_code},
            "serving_scope": {"cadence": "SEMESTRAL"},
            "input_schema": {
                "feature_names": feature_names,
                "fields": field_definitions(event_code, feature_names) if contract else
                [{"name": name, "available_at_cut": True} for name in feature_names],
            },
        }
        if contract:
            manifest["feature_contract"] = contract_reference(event_code, feature_names)
        return manifest

    @patch("inference_adapters.psycopg.connect")
    def test_course_features_use_prior_history_and_do_not_select_course_label(self, connect: Mock) -> None:
        connection = _connection([("4", "2", 3, 0, 1, "SEMESTRAL", "run-id")])
        connect.return_value = connection

        provider = DwPredictionDataProvider("postgresql://read-only")
        features = provider.load_features(
            "100", self.context, self._manifest(COURSE_ABANDONMENT_EVENT, COURSE_FEATURES),
            "course_abandonment", "901",
        )

        self.assertEqual(features, {
            "materia_ciclo": "4", "materia_nivel": "2", "prior_course_count": 3,
            "prior_abandonment_count": 0,
        })
        sql, params = connection.execute.call_args.args
        self.assertIn("prev.effective_at < c.effective_at", sql)
        self.assertNotIn("fc_target.es_abandono", sql)
        self.assertEqual(params["course"], 901)

    @patch("inference_adapters.psycopg.connect")
    def test_program_features_use_the_shared_contract_query_in_one_round_trip(self, connect: Mock) -> None:
        columns, row = _program_row("100")
        connection = _connection([row], columns)
        connect.return_value = connection

        provider = DwPredictionDataProvider("postgresql://read-only")
        features = provider.load_features("100", self.context, self._manifest(PROGRAM_DROPOUT_EVENT, PROGRAM_FEATURES))

        self.assertEqual(features, {"materias_cursadas": 5, "materias_aprobadas": 4, "ppa_acumulado": 3.2})
        self.assertEqual(connection.execute.call_count, 1)
        sql, params = connection.execute.call_args.args
        # Exactly the text the training extractor runs.
        self.assertEqual(sql, program_dropout_query(PROGRAM_FEATURES))
        self.assertEqual(params, {"program": "P01", "closure": 42, "subject": 100, "limit": 2})

    @patch("inference_adapters.psycopg.connect")
    def test_shared_eligibility_rule_rejects_out_of_window_and_mixed_cadence(self, connect: Mock) -> None:
        provider = DwPredictionDataProvider("postgresql://read-only")
        manifest = self._manifest(PROGRAM_DROPOUT_EVENT, PROGRAM_FEATURES)
        for kwargs, detail in (({"start_year": 2020}, "first-three-academic-years"), ({"cadence_count": 2}, "cadence")):
            columns, row = _program_row("100", **kwargs)
            connect.return_value = _connection([row], columns)
            with self.assertRaises(InferenceFailure) as raised:
                provider.load_features("100", self.context, manifest)
            self.assertEqual(raised.exception.code, "INELIGIBLE_PROFILE")
            self.assertIn(detail, raised.exception.detail)

    @patch("inference_adapters.psycopg.connect")
    def test_population_features_load_whole_program_in_one_query(self, connect: Mock) -> None:
        columns, eligible = _program_row("100")
        _, outside = _program_row("200", start_year=2020)
        _, mixed = _program_row("300", cadence_count=2)
        connection = _connection([eligible, outside, mixed], columns)
        connect.return_value = connection

        provider = DwPredictionDataProvider("postgresql://read-only")
        features, ineligible, runs = provider.load_population_features(
            self.context, self._manifest(PROGRAM_DROPOUT_EVENT, PROGRAM_FEATURES))

        self.assertEqual(list(features), ["100"])
        self.assertEqual(ineligible, {"OUTSIDE_WINDOW": 1, "MIXED_CADENCE": 1})
        self.assertEqual(runs, ["8ef1a80e-a16a-4e89-88e2-45d2d5fab02a"])
        self.assertEqual(connection.execute.call_count, 1)
        self.assertIsNone(connection.execute.call_args.args[1]["subject"])

    @patch("inference_adapters.psycopg.connect")
    def test_population_limit_is_enforced(self, connect: Mock) -> None:
        columns, row = _program_row("100")
        connect.return_value = _connection([row, row, row], columns)
        provider = DwPredictionDataProvider("postgresql://read-only")
        with self.assertRaises(InferenceFailure) as raised:
            provider.load_population_features(self.context, self._manifest(PROGRAM_DROPOUT_EVENT, PROGRAM_FEATURES), limit=2)
        self.assertEqual(raised.exception.code, "POPULATION_LIMIT_EXCEEDED")

    @patch("inference_adapters.psycopg.connect")
    def test_bundle_without_or_with_stale_feature_contract_is_not_served(self, connect: Mock) -> None:
        provider = DwPredictionDataProvider("postgresql://read-only")
        missing = self._manifest(PROGRAM_DROPOUT_EVENT, PROGRAM_FEATURES, contract=False)
        stale = self._manifest(PROGRAM_DROPOUT_EVENT, PROGRAM_FEATURES)
        stale["feature_contract"]["digest"] = "0" * 64
        for manifest in (missing, stale):
            with self.assertRaises(InferenceFailure) as raised:
                provider.load_features("100", self.context, manifest)
            self.assertEqual(raised.exception.code, "INCOMPATIBLE_SCHEMA")
        connect.assert_not_called()

    def test_requested_target_must_match_the_bundle_event(self) -> None:
        provider = DwPredictionDataProvider("postgresql://read-only")
        manifest = self._manifest(COURSE_ABANDONMENT_EVENT, ["materia_ciclo"])
        with self.assertRaises(InferenceFailure) as raised:
            provider.load_features("100", self.context, manifest, "program_dropout")
        self.assertEqual(raised.exception.code, "INCOMPATIBLE_SCHEMA")

    def test_cadence_mismatch_is_rejected_before_scoring(self) -> None:
        provider = DwPredictionDataProvider("postgresql://read-only")
        manifest = self._manifest(COURSE_ABANDONMENT_EVENT, ["materia_ciclo"])
        manifest["serving_scope"]["cadence"] = "ANUAL"
        with self.assertRaises(InferenceFailure) as raised:
            provider.load_features("100", self.context, manifest, "course_abandonment", "901")
        self.assertEqual(raised.exception.code, "INCOMPATIBLE_SCHEMA")


if __name__ == "__main__":
    unittest.main()
