"""Immutable, manifest-driven prediction scoring for one trusted feature row."""

from __future__ import annotations

import math
from dataclasses import dataclass
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any, Mapping, Protocol
from uuid import uuid4

import pandas as pd

from ml_tasks import UnknownTask, task_for_event_type
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
    #: Catalog permissions (``resource_access.dss-permissions.roles``), IAM-013.
    permissions: frozenset[str] = frozenset()


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
            event_code = task_for_event_type(event_type).code
            bundle = self.registry.active(event_code=event_code, cadence=context.cadence)
        except UnknownTask as exc:
            raise InferenceFailure("INVALID_REQUEST", 400, "The requested prediction event is not supported.") from exc
        except NoActiveModel as exc:
            raise InferenceFailure("NO_ACTIVE_MODEL", 503, "No approved model is active.") from exc
        except InvalidModelArtifact as exc:
            raise InferenceFailure("DATA_UNAVAILABLE", 503, "The active model bundle is unavailable.") from exc
        features = self.data.load_features(subject_ref, context, bundle.manifest, event_type, course_ref)
        scored = score_bundle(bundle, features)
        return {
            "contract_version": "1.0",
            "prediction_id": uuid4(),
            "subject_ref": subject_ref,
            "program_ref": program_ref,
            "event_type": event_type,
            "event_code": scored["event_code"],
            "course_ref": course_ref,
            "task_kind": scored["task_kind"],
            "predicted_class": scored["predicted_class"],
            "event_probability": scored["event_probability"],
            "predicted_value": scored["predicted_value"],
            "prediction_interval": scored["prediction_interval"],
            "unit": scored.get("unit"),
            "model": {"model_id": bundle.model_id, "version": bundle.version},
            "academic_cut": {"cut_id": context.cut_id},
            "generated_at": datetime.now(timezone.utc),
        }


ANALYTICS_READ = "analytics:read"
ANALYTICS_GLOBAL = "analytics:global"
ANALYTICS_FACULTY = "analytics:faculty"
ANALYTICS_CAREER = "analytics:career"
def authorize_program_context(principal: Principal, context: ProgramContext) -> None:
    """Authorize one requested program against the principal's permissions and academic contexts.

    ``analytics:read`` is required, then a scope: ``analytics:global`` is institution-wide,
    ``analytics:faculty`` covers the faculty of any faculty context (``careerId`` empty) and
    ``analytics:career`` the program of any career context. The scope is the union over every
    context and every scope permission (IAM-009). SUPERADMIN has no academic permission, hence no
    academic access.
    """
    permissions = principal.permissions
    if ANALYTICS_READ in permissions:
        if ANALYTICS_GLOBAL in permissions:
            return
        if ANALYTICS_FACULTY in permissions and any(
            item.get("facultyId") == context.faculty_id and item.get("careerId") is None
            for item in principal.academic_contexts
        ):
            return
        if ANALYTICS_CAREER in permissions and any(
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


def score_bundle(bundle: Any, features: Mapping[str, Any]) -> dict[str, Any]:
    """Score one trusted feature row with any bundle kind (PRED-103).

    Classification bundles return ``predicted_class`` and ``event_probability``;
    regression bundles return ``predicted_value`` and the bundled
    out-of-fold residual intervals around it.
    """
    manifest = bundle.manifest
    if manifest.get("task_kind") != "regression":
        predicted_class, probability, event_code = score_loaded_model(bundle, features)
        return {"task_kind": "classification", "event_code": event_code, "predicted_class": predicted_class,
                "event_probability": probability, "predicted_value": None, "prediction_interval": None}
    names = validate_feature_row(manifest, features)
    try:
        row = {name: float(features[name]) if isinstance(features[name], Decimal) else features[name] for name in names}
        frame = pd.DataFrame([row], columns=names).copy(deep=True)
        value = float(bundle.model.predict(bundle.pipeline.transform(frame))[0])
    except Exception as exc:
        raise InferenceFailure("INTERNAL_ERROR", 500, "The active model could not score the trusted feature row.") from exc
    if not math.isfinite(value):
        raise InferenceFailure("INTERNAL_ERROR", 500, "The model produced an invalid predicted value.")
    offsets = (manifest.get("prediction_interval") or {}).get("offsets") or {}
    interval = {level: {"lower": value + float(bounds[0]), "upper": value + float(bounds[1])}
                for level, bounds in sorted(offsets.items())}
    return {"task_kind": "regression", "event_code": manifest["classes"]["event_code"], "predicted_class": None,
            "event_probability": None, "predicted_value": value, "prediction_interval": interval,
            "unit": (manifest.get("target_definition") or {}).get("unit")}


def score_loaded_model(bundle: Any, features: Mapping[str, Any]) -> tuple[str, float | None, str]:
    """Transform a fresh one-row frame and map output/probability via manifest."""
    manifest = bundle.manifest
    if manifest.get("task_kind") == "regression":
        raise InferenceFailure("INCOMPATIBLE_SCHEMA", 503, "A regression bundle has no class prediction.")
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
        threshold = _decision_threshold(manifest)
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
        if threshold is not None:
            # The bundle was evaluated with this validation-selected threshold,
            # so serving must apply it instead of the estimator's implicit 0.5.
            if probability is None:
                raise InferenceFailure("INCOMPATIBLE_SCHEMA", 503, "The model declares a decision threshold but exposes no probabilities.")
            predicted_class = "POSITIVE_EVENT" if probability >= threshold else "NEGATIVE_EVENT"
        else:
            # Legacy bundles without a stored threshold keep estimator semantics.
            predicted_class = _class_label(bundle.model.predict(transformed)[0], positive, negative)
        return predicted_class, probability, event_code
    except InferenceFailure:
        raise
    except Exception as exc:
        raise InferenceFailure("INTERNAL_ERROR", 500, "The active model could not score the trusted feature row.") from exc


def _decision_threshold(manifest: Mapping[str, Any]) -> float | None:
    if "decision_threshold" not in manifest:
        return None
    value = manifest["decision_threshold"]
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value) or not 0 <= value <= 1:
        raise InferenceFailure("INCOMPATIBLE_SCHEMA", 503, "The active model decision threshold is invalid.")
    return float(value)


def _is_positive(value: Any, positive_label: str) -> bool:
    return value == 1 or str(value) == positive_label


def _class_label(value: Any, positive_label: str, negative_label: str) -> str:
    if _is_positive(value, positive_label):
        return "POSITIVE_EVENT"
    if value == 0 or str(value) == negative_label:
        return "NEGATIVE_EVENT"
    raise InferenceFailure("INCOMPATIBLE_SCHEMA", 503, "Model prediction classes do not match its manifest.")
