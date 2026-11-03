"""Immutable, manifest-driven prediction scoring for one trusted feature row."""

from __future__ import annotations

import math
from dataclasses import dataclass
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any, Mapping, Protocol
from uuid import uuid4

import pandas as pd

from training.model_registry import InvalidModelArtifact, NoActiveModel


class InferenceFailure(RuntimeError):
    def __init__(self, code: str, status_code: int, detail: str):
        super().__init__(detail)
        self.code = code
        self.status_code = status_code
        self.detail = detail


@dataclass(frozen=True)
class ProgramContext:
    program_ref: str
    program_code: str
    faculty_id: int
    cut_id: str
    academic_year: int
    academic_period: int
    effective_at: str
    cadence: str = "SEMESTRAL"


@dataclass(frozen=True)
class Principal:
    subject: str
    roles: frozenset[str]
    academic_contexts: tuple[Mapping[str, Any], ...]


class IdentityProvider(Protocol):
    def authenticate(self, access_token: str) -> Principal: ...


class PredictionDataProvider(Protocol):
    def resolve_context(self, program_ref: str, cut_id: str) -> ProgramContext: ...
    def load_features(
        self, student_ref: str, context: ProgramContext, manifest: Mapping[str, Any],
        event_type: str = "program_dropout", course_ref: str | None = None,
    ) -> Mapping[str, Any]: ...


class AuthorizationPolicy(Protocol):
    def authorize(self, principal: Principal, context: ProgramContext) -> None: ...


class PredictionService:
    def __init__(self, registry: Any, identity: IdentityProvider, data: PredictionDataProvider,
                 authorization: AuthorizationPolicy):
        self.registry = registry
        self.identity = identity
        self.data = data
        self.authorization = authorization

    def predict(self, access_token: str, subject_ref: str, program_ref: str, cut_id: str,
                event_type: str = "program_dropout", course_ref: str | None = None) -> dict[str, Any]:
        principal = self.identity.authenticate(access_token)
        context = self.data.resolve_context(program_ref, cut_id)
        self.authorization.authorize(principal, context)
        try:
            event_code = "COURSE_ABANDONMENT" if event_type == "course_abandonment" else "PROGRAM_DROPOUT_NEXT_EXPECTED_CLOSURE"
            bundle = self.registry.active(event_code=event_code, cadence=context.cadence)
        except NoActiveModel as exc:
            raise InferenceFailure("NO_ACTIVE_MODEL", 503, "No approved model is active.") from exc
        except InvalidModelArtifact as exc:
            raise InferenceFailure("DATA_UNAVAILABLE", 503, "The active model bundle is unavailable.") from exc
        features = self.data.load_features(subject_ref, context, bundle.manifest, event_type, course_ref)
        predicted_class, probability, event_code = score_loaded_model(bundle, features)
        return {
            "contract_version": "1.0",
            "prediction_id": uuid4(),
            "subject_ref": subject_ref,
            "program_ref": program_ref,
            "event_type": event_type,
            "event_code": event_code,
            "course_ref": course_ref,
            "predicted_class": predicted_class,
            "event_probability": probability,
            "model": {"model_id": bundle.model_id, "version": bundle.version},
            "academic_cut": {"cut_id": context.cut_id},
            "generated_at": datetime.now(timezone.utc),
        }


def authorize_program_context(principal: Principal, context: ProgramContext, allowed_roles: set[str]) -> None:
    """Apply the existing DSS academic hierarchy to one requested program.

    The enabled role set is mandatory configuration. SUPERADMIN has no
    academic access. Rector is institution-wide; decano and director are
    constrained by current Auth Service academicContexts.
    """
    roles = principal.roles & allowed_roles
    if "RECTOR" in roles:
        return
    if "DECANO" in roles:
        if any(
            item.get("facultyId") == context.faculty_id and item.get("careerId") is None
            for item in principal.academic_contexts
        ):
            return
        raise InferenceFailure("INSUFFICIENT_SCOPE", 403, "The requested academic program is outside the authorized scope.")
    if "DIRECTOR" in roles:
        if any(
            item.get("facultyId") == context.faculty_id and item.get("careerId") == context.program_code
            for item in principal.academic_contexts
        ):
            return
    raise InferenceFailure("INSUFFICIENT_SCOPE", 403, "The requested academic program is outside the authorized scope.")


def validate_feature_row(manifest: Mapping[str, Any], features: Mapping[str, Any]) -> list[str]:
    schema = manifest.get("input_schema")
    if not isinstance(schema, Mapping):
        raise InferenceFailure("INCOMPATIBLE_SCHEMA", 503, "The active model has no serving input schema.")
    names = schema.get("feature_names")
    fields = schema.get("fields")
    if not isinstance(names, list) or not names or not isinstance(fields, list):
        raise InferenceFailure("INCOMPATIBLE_SCHEMA", 503, "The active model serving schema is invalid.")
    by_name = {field.get("name"): field for field in fields if isinstance(field, Mapping)}
    if len(by_name) != len(fields) or set(by_name) != set(names):
        raise InferenceFailure("INCOMPATIBLE_SCHEMA", 503, "The active model serving schema is inconsistent.")
    if set(features) != set(names):
        raise InferenceFailure("INCOMPATIBLE_SCHEMA", 503, "Trusted features do not match the active model schema.")
    ordered: list[str] = []
    for name in names:
        field = by_name[name]
        if field.get("available_at_cut") is not True:
            raise InferenceFailure("INCOMPATIBLE_SCHEMA", 503, "A model feature lacks proof of availability at the requested cut.")
        value = features[name]
        if value is None:
            if field.get("nullable") is not True:
                raise InferenceFailure("DATA_UNAVAILABLE", 422, "A required feature is missing at the requested cut.")
            ordered.append(name)
            continue
        logical_type = field.get("logical_type")
        valid = (
            logical_type in {"number", "integer"} and isinstance(value, (int, float, Decimal)) and not isinstance(value, bool)
            or logical_type == "boolean" and isinstance(value, bool)
            or logical_type in {"string", "category", "date", "datetime"} and isinstance(value, str)
        )
        if not valid or (isinstance(value, (float, Decimal)) and not math.isfinite(float(value))):
            raise InferenceFailure("INCOMPATIBLE_SCHEMA", 503, f"Trusted feature '{name}' has an incompatible value.")
        if logical_type == "integer" and value is not None and int(value) != value:
            raise InferenceFailure("INCOMPATIBLE_SCHEMA", 503, f"Trusted feature '{name}' must be an integer.")
        ordered.append(name)
    return ordered


def score_loaded_model(bundle: Any, features: Mapping[str, Any]) -> tuple[str, float | None, str]:
    """Transform a fresh one-row frame and map output/probability via manifest."""
    manifest = bundle.manifest
    names = validate_feature_row(manifest, features)
    positive = manifest["classes"]["positive_class"]
    negative = manifest["classes"]["negative_class"]
    event_code = manifest["classes"]["event_code"]
    try:
        row = {
            name: float(features[name]) if isinstance(features[name], Decimal) else features[name]
            for name in names
        }
        frame = pd.DataFrame([row], columns=names).copy(deep=True)
        transformed = bundle.pipeline.transform(frame)
        raw_prediction = bundle.model.predict(transformed)[0]
        predicted_class = _class_label(raw_prediction, positive, negative)
        probability: float | None = None
        if callable(getattr(bundle.model, "predict_proba", None)):
            class_order = list(getattr(bundle.model, "classes_", []))
            positive_index = next(
                (index for index, label in enumerate(class_order) if _is_positive(label, positive)),
                None,
            )
            if positive_index is None:
                raise InferenceFailure("INCOMPATIBLE_SCHEMA", 503, "Model probability classes do not match its manifest.")
            values = bundle.model.predict_proba(transformed)[0]
            probability = float(values[positive_index])
            if not math.isfinite(probability) or not 0 <= probability <= 1:
                raise InferenceFailure("INTERNAL_ERROR", 500, "The model produced an invalid event probability.")
        return predicted_class, probability, event_code
    except InferenceFailure:
        raise
    except Exception as exc:
        raise InferenceFailure("INTERNAL_ERROR", 500, "The active model could not score the trusted feature row.") from exc


def _is_positive(value: Any, positive_label: str) -> bool:
    return value == 1 or str(value) == positive_label


def _class_label(value: Any, positive_label: str, negative_label: str) -> str:
    if _is_positive(value, positive_label):
        return "POSITIVE_EVENT"
    if value == 0 or str(value) == negative_label:
        return "NEGATIVE_EVENT"
    raise InferenceFailure("INCOMPATIBLE_SCHEMA", 503, "Model prediction classes do not match its manifest.")
