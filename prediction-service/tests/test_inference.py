from __future__ import annotations

import unittest
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from unittest.mock import Mock

import numpy as np

from inference import (
    InferenceFailure,
    Principal,
    ProgramContext,
    PredictionService,
    authorize_program_context,
    score_loaded_model,
    validate_feature_row,
)


class EchoPipeline:
    def transform(self, frame):
        return frame.to_numpy(dtype=float)


class ThresholdModel:
    classes_ = np.asarray([1, 0])

    def predict(self, frame):
        return np.asarray([1 if row[0] >= 0.5 else 0 for row in frame])

    def predict_proba(self, frame):
        return np.asarray([[0.8, 0.2] if row[0] >= 0.5 else [0.1, 0.9] for row in frame])


@dataclass(frozen=True)
class Bundle:
    model_id: str = "model-1"
    version: str = "v1"
    manifest: dict | None = None
    model: object = ThresholdModel()
    pipeline: object = EchoPipeline()

    def __post_init__(self):
        object.__setattr__(self, "manifest", {
            "classes": {"positive_class": "DESERTOR", "negative_class": "RETENIDO", "event_code": "NEXT_CLOSURE_DROPOUT"},
            "input_schema": {
                "feature_names": ["signal"],
                "fields": [{"name": "signal", "logical_type": "number", "nullable": False, "available_at_cut": True}],
            },
        })


class InferenceTests(unittest.TestCase):
    def test_probability_is_associated_with_manifest_positive_class_order(self):
        bundle = Bundle()
        predicted, probability, event_code = score_loaded_model(bundle, {"signal": 0.9})
        self.assertEqual(predicted, "POSITIVE_EVENT")
        self.assertEqual(probability, 0.8)
        self.assertEqual(event_code, "NEXT_CLOSURE_DROPOUT")

        predicted, probability, _ = score_loaded_model(bundle, {"signal": 0.1})
        self.assertEqual(predicted, "NEGATIVE_EVENT")
        self.assertEqual(probability, 0.1)

    def test_model_without_predict_proba_returns_null(self):
        class Classifier:
            def predict(self, frame):
                return np.asarray([0])

        bundle = Bundle(model=Classifier())
        predicted, probability, _ = score_loaded_model(bundle, {"signal": 0.2})
        self.assertEqual(predicted, "NEGATIVE_EVENT")
        self.assertIsNone(probability)

    def test_unproven_or_incompatible_feature_fails_closed(self):
        manifest = Bundle().manifest
        invalid = {**manifest, "input_schema": {"feature_names": ["signal"], "fields": [
            {"name": "signal", "logical_type": "number", "nullable": False, "available_at_cut": False}
        ]}}
        with self.assertRaises(InferenceFailure) as raised:
            validate_feature_row(invalid, {"signal": 0.2})
        self.assertEqual(raised.exception.code, "INCOMPATIBLE_SCHEMA")

        with self.assertRaises(InferenceFailure) as raised:
            validate_feature_row(manifest, {"signal": 0.2, "resultado_retencion": "DESERTOR"})
        self.assertEqual(raised.exception.code, "INCOMPATIBLE_SCHEMA")

    def test_decano_and_director_are_restricted_to_profile_contexts(self):
        context = ProgramContext("P01", "P01", 10, "42", 2026, 1, "2026-06-01T00:00:00+00:00")
        authorize_program_context(
            Principal("user", frozenset({"DECANO"}), ({"facultyId": 10, "careerId": None},)),
            context, {"DECANO"},
        )
        with self.assertRaises(InferenceFailure):
            authorize_program_context(
                Principal("user", frozenset({"DIRECTOR"}), ({"facultyId": 10, "careerId": "P02"},)),
                context, {"DIRECTOR"},
            )
        with self.assertRaises(InferenceFailure):
            authorize_program_context(
                Principal("admin", frozenset({"SUPERADMIN"}), ()), context, {"RECTOR", "DECANO", "DIRECTOR"},
            )

    def test_a_b_a_and_concurrent_requests_do_not_contaminate_features(self):
        service = self._service()
        a1 = service.predict("token", "100", "P01", "42")
        b = service.predict("token", "200", "P01", "42")
        a2 = service.predict("token", "100", "P01", "42")
        self.assertEqual(a1["predicted_class"], "POSITIVE_EVENT")
        self.assertEqual(b["predicted_class"], "NEGATIVE_EVENT")
        self.assertEqual(a1["event_probability"], a2["event_probability"])

        with ThreadPoolExecutor(max_workers=8) as executor:
            results = list(executor.map(
                lambda student: service.predict("token", student, "P01", "42")["predicted_class"],
                ["100", "200"] * 20,
            ))
        self.assertEqual(results, ["POSITIVE_EVENT", "NEGATIVE_EVENT"] * 20)

    def test_event_and_cadence_select_a_matching_bundle(self):
        service = self._service()
        service.predict("token", "100", "P01", "42", "course_abandonment", "900")
        service.registry.active.assert_called_with(event_code="COURSE_ABANDONMENT", cadence="SEMESTRAL")
        service.data.load_features.assert_called_with(
            "100", service.data.resolve_context.return_value, service.registry.active.return_value.manifest,
            "course_abandonment", "900",
        )

    def _service(self):
        registry = Mock()
        registry.active.return_value = Bundle()
        identity = Mock()
        identity.authenticate.return_value = Principal("operator", frozenset({"RECTOR"}), ())
        data = Mock()
        data.resolve_context.return_value = ProgramContext("P01", "P01", 10, "42", 2026, 1, "2026-06-01T00:00:00+00:00")
        data.load_features.side_effect = lambda student, context, manifest, event_type="program_dropout", course_ref=None: {"signal": 0.9 if student == "100" else 0.1}
        authorization = Mock()
        return PredictionService(registry, identity, data, authorization)


if __name__ == "__main__":
    unittest.main()
