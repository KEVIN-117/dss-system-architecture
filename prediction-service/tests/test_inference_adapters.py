from __future__ import annotations

import unittest
from unittest.mock import Mock, patch

from inference import InferenceFailure, ProgramContext
from inference_adapters import DwPredictionDataProvider


class DwPredictionAdapterTests(unittest.TestCase):
    def setUp(self) -> None:
        self.context = ProgramContext("P01", "P01", 10, "42", 2026, 1, "2026-06-01T00:00:00+00:00", "SEMESTRAL")

    @staticmethod
    def _manifest(event_code: str, feature_names: list[str]) -> dict:
        return {
            "classes": {"event_code": event_code},
            "serving_scope": {"cadence": "SEMESTRAL"},
            "input_schema": {
                "feature_names": feature_names,
                "fields": [{"name": name, "available_at_cut": True} for name in feature_names],
            },
        }

    @patch("inference_adapters.psycopg.connect")
    def test_course_features_use_prior_history_and_do_not_select_course_label(self, connect: Mock) -> None:
        connection = Mock()
        cursor = Mock()
        cursor.fetchall.return_value = [("4", "2", 3, 0, 1, "SEMESTRAL", "run-id")]
        connection.__enter__ = Mock(return_value=connection)
        connection.__exit__ = Mock(return_value=False)
        connection.execute.return_value = cursor
        connect.return_value = connection

        provider = DwPredictionDataProvider("postgresql://read-only")
        features = provider.load_features(
            "100", self.context,
            self._manifest("COURSE_ABANDONMENT", ["materia_ciclo", "materia_nivel", "prior_course_count", "prior_abandonment_count"]),
            "course_abandonment", "901",
        )

        self.assertEqual(features, {
            "materia_ciclo": "4", "materia_nivel": "2", "prior_course_count": 3,
            "prior_abandonment_count": 0,
        })
        sql = connection.execute.call_args.args[0]
        self.assertIn("prev.effective_at < c.effective_at", sql)
        self.assertNotIn("fc_target.es_abandono", sql)
        self.assertEqual(connection.execute.call_args.args[1][-1], 901)

    def test_requested_target_must_match_the_bundle_event(self) -> None:
        provider = DwPredictionDataProvider("postgresql://read-only")
        manifest = self._manifest("COURSE_ABANDONMENT", ["materias_cursadas"])
        with self.assertRaises(InferenceFailure) as raised:
            provider.load_features("100", self.context, manifest, "program_dropout")
        self.assertEqual(raised.exception.code, "INCOMPATIBLE_SCHEMA")

    def test_cadence_mismatch_is_rejected_before_scoring(self) -> None:
        provider = DwPredictionDataProvider("postgresql://read-only")
        manifest = self._manifest("COURSE_ABANDONMENT", ["materia_ciclo"])
        manifest["serving_scope"]["cadence"] = "ANUAL"
        with self.assertRaises(InferenceFailure) as raised:
            provider.load_features("100", self.context, manifest, "course_abandonment", "901")
        self.assertEqual(raised.exception.code, "INCOMPATIBLE_SCHEMA")


if __name__ == "__main__":
    unittest.main()
