"""Authorized population scoring submission and publication reads."""
from __future__ import annotations

import os
import json
from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from inference import InferenceFailure
from inference_adapters import ConfiguredAcademicPolicy, DwPredictionDataProvider, KeycloakIdentityProvider
from training.model_registry import InvalidModelArtifact, ModelRegistry, NoActiveModel
from training.prediction_publication_store import PredictionPublicationStore, PublicationConflict


class PopulationPublicationService:
    def __init__(self, store: Any | None = None, identity: Any | None = None,
                 data: Any | None = None, policy: Any | None = None, registry: Any | None = None):
        self.store = store or PredictionPublicationStore()
        self.identity = identity or KeycloakIdentityProvider()
        self.data = data or DwPredictionDataProvider()
        self.policy = policy or ConfiguredAcademicPolicy()
        self.registry = registry or ModelRegistry(__import__("pathlib").Path(os.getenv("WORKER_ARTIFACTS_DIR", "/app/artifacts")))

    def academic_options(self, access_token: str) -> dict[str, Any]:
        """Return only DW program/cut combinations visible to this principal."""
        principal = self.identity.authenticate(access_token)
        if not (principal.roles & _academic_roles()):
            raise InferenceFailure("INSUFFICIENT_SCOPE", 403, "The account cannot view prediction programs.")
        contexts = self.data.list_available_contexts()
        programs: dict[str, dict[str, Any]] = {}
        cuts: list[dict[str, Any]] = []
        for context, program_name in contexts:
            try:
                self.policy.authorize(principal, context)
            except InferenceFailure as exc:
                if exc.status_code == 403:
                    continue
                raise
            programs[context.program_code] = {
                "program_ref": context.program_code,
                "name": program_name,
                "faculty_id": context.faculty_id,
            }
            cuts.append({
                "program_ref": context.program_code,
                "cut_id": context.cut_id,
                "academic_year": context.academic_year,
                "academic_period": context.academic_period,
                "cadence": context.cadence,
            })
        return {
            "programs": sorted(programs.values(), key=lambda item: (item["name"], item["program_ref"])),
            "cuts": cuts,
        }

    def submit(self, access_token: str, program_ref: str, closure_id: str, idempotency_key: str) -> dict[str, Any]:
        principal = self.identity.authenticate(access_token)
        submitter_roles = _submitter_roles()
        if not (principal.roles & submitter_roles):
            raise InferenceFailure("INSUFFICIENT_SCOPE", 403, "The account cannot start population scoring.")
        context = self.data.resolve_context(program_ref, closure_id)
        self.policy.authorize(principal, context)
        try:
            bundle = self.registry.active("PROGRAM_DROPOUT_NEXT_EXPECTED_CLOSURE", context.cadence)
        except NoActiveModel as exc:
            raise InferenceFailure("NO_ACTIVE_MODEL", 503, "No approved program-dropout model is active for this cadence.") from exc
        except InvalidModelArtifact as exc:
            raise InferenceFailure("ACTIVE_MODEL_UNAVAILABLE", 503, "The active model bundle is unavailable.") from exc
        digest = self.store.digest(program_ref, context.cut_id, bundle.model_id, bundle.version)
        scope = principal.subject
        existing = self.store.find_by_key(idempotency_key, scope)
        if existing:
            if existing["request_digest"] != digest:
                raise InferenceFailure("IDEMPOTENCY_CONFLICT", 409, "Idempotency-Key was already used for a different publication request.")
            return _public_batch(existing)
        batch = {
            "batch_id": str(uuid4()), "idempotency_key": idempotency_key,
            "request_digest": digest, "event_code": "PROGRAM_DROPOUT_NEXT_EXPECTED_CLOSURE",
            "program_ref": program_ref, "closure_id": context.cut_id,
            "model_id": bundle.model_id, "model_version": bundle.version,
            "submitted_by": principal.subject,
            "authorized_scope": {"kind": "program", "program_ref": context.program_code,
                                 "faculty_id": context.faculty_id, "roles": sorted(principal.roles)},
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        try:
            return _public_batch(self.store.create(batch, scope))
        except PublicationConflict as exc:
            # A concurrent request reused the key with a different body.
            raise InferenceFailure("IDEMPOTENCY_CONFLICT", 409, "Idempotency-Key was already used for a different publication request.") from exc

    def current(self, access_token: str, program_ref: str, closure_id: str, limit: int = 100, offset: int = 0) -> dict[str, Any]:
        principal = self.identity.authenticate(access_token)
        context = self.data.resolve_context(program_ref, closure_id)
        self.policy.authorize(principal, context)
        batch = self.store.current(program_ref, context.cut_id)
        if not batch:
            return {"publication": None}
        publication = self.store.get(batch["batch_id"], include_results=True, limit=limit, offset=offset)
        return {"publication": _public_batch(publication)}

    def get_batch(self, access_token: str, batch_id: str, limit: int = 100, offset: int = 0) -> dict[str, Any]:
        principal = self.identity.authenticate(access_token)
        batch = self.store.get(batch_id)
        if not batch:
            raise InferenceFailure("RESOURCE_NOT_FOUND", 404, "Prediction batch was not found.")
        context = self.data.resolve_context(batch["program_ref"], str(batch["closure_id"]))
        self.policy.authorize(principal, context)
        return _public_batch(self.store.get(batch_id, include_results=True, limit=limit, offset=offset) or batch)


def _public_batch(batch: dict[str, Any]) -> dict[str, Any]:
    """Keep authorization evidence internal; expose only publication contract fields."""
    return {key: value for key, value in batch.items() if key not in {"authorized_scope", "submitted_by", "idempotency_scope", "idempotency_key", "request_digest"}}


def _submitter_roles() -> set[str]:
    raw = os.getenv("PREDICTION_BATCH_SUBMITTER_ROLES", "[]")
    try:
        roles = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise InferenceFailure("AUTHORIZATION_UNAVAILABLE", 503, "Population scoring role policy is invalid.") from exc
    allowed = {"RECTOR", "DECANO", "DIRECTOR"}
    if not isinstance(roles, list) or not roles or any(role not in allowed for role in roles):
        raise InferenceFailure("AUTHORIZATION_UNAVAILABLE", 503, "Population scoring requires an explicit approved submitter role configuration.")
    return set(roles)


def _academic_roles() -> set[str]:
    raw = os.getenv("PREDICTION_ALLOWED_ROLES", "").strip()
    try:
        roles = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise InferenceFailure("AUTHORIZATION_UNAVAILABLE", 503, "Prediction academic role policy is invalid.") from exc
    allowed = {"RECTOR", "DECANO", "DIRECTOR"}
    if not isinstance(roles, list) or not roles or any(role not in allowed for role in roles):
        raise InferenceFailure("AUTHORIZATION_UNAVAILABLE", 503, "Prediction academic role policy is not configured correctly.")
    return set(roles)
