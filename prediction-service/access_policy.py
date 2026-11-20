"""Permission-based access to prediction-service (IAM-013).

Permissions come from the catalog client of the token (``resource_access.dss-permissions.roles``) and are
managed from the admin portal, so changing who may read, publish or train needs no deployment:

* ``analytics:read`` plus a scope permission reads predictions: ``analytics:global`` (institution-wide),
  ``analytics:faculty`` (faculty contexts) or ``analytics:career`` (career contexts). The scope of a user is the
  union of all their academic contexts (IAM-009) across all their scope permissions.
* ``prediction:publish`` starts population scoring, always within that academic scope.
* ``prediction:train`` trains models and manages datasets and models.

During the coexistence (``PREDICTION_LEGACY_ROLES_ENABLED``, default ``true``) the previous role lists still
work: ``PREDICTION_ALLOWED_ROLES`` (``RECTOR`` = global, ``DECANO`` = faculty, ``DIRECTOR`` = career),
``PREDICTION_BATCH_SUBMITTER_ROLES`` and ``PREDICTION_TRAINING_ROLES``. With it off they are ignored.
"""
from __future__ import annotations

import json
import os
from collections.abc import Collection

from inference import (  # noqa: F401  (re-exported for callers of the access policy)
    ANALYTICS_CAREER,
    ANALYTICS_FACULTY,
    ANALYTICS_GLOBAL,
    ANALYTICS_READ,
    LEGACY_ROLE_PERMISSIONS,
    InferenceFailure,
    Principal,
    academic_permissions,
)

PREDICTION_PUBLISH = "prediction:publish"
PREDICTION_TRAIN = "prediction:train"

ACADEMIC_ROLES = frozenset(LEGACY_ROLE_PERMISSIONS)
_DEFAULT_TRAINING_ROLES = '["SUPERADMIN"]'


def permissions_client_id() -> str:
    return os.getenv("KEYCLOAK_PERMISSIONS_CLIENT_ID", "").strip() or "dss-permissions"


def legacy_roles_enabled() -> bool:
    raw = os.getenv("PREDICTION_LEGACY_ROLES_ENABLED", "true").strip().lower()
    if raw in {"true", "1", "yes", ""}:
        return True
    if raw in {"false", "0", "no"}:
        return False
    raise InferenceFailure("AUTHORIZATION_UNAVAILABLE", 503, "PREDICTION_LEGACY_ROLES_ENABLED must be true or false.")


def legacy_academic_roles() -> frozenset[str]:
    """``PREDICTION_ALLOWED_ROLES`` during the coexistence; unset means no legacy academic role is accepted."""
    if not legacy_roles_enabled():
        return frozenset()
    raw = os.getenv("PREDICTION_ALLOWED_ROLES", "").strip()
    if not raw:
        return frozenset()
    roles = _role_list(raw, "Prediction academic role policy is invalid.")
    if not roles or not roles <= ACADEMIC_ROLES:
        raise InferenceFailure("AUTHORIZATION_UNAVAILABLE", 503, "Prediction role policy must list approved academic roles.")
    return roles


def legacy_submitter_roles() -> frozenset[str]:
    """``PREDICTION_BATCH_SUBMITTER_ROLES`` during the coexistence; an empty list accepts no legacy role."""
    if not legacy_roles_enabled():
        return frozenset()
    roles = _role_list(os.getenv("PREDICTION_BATCH_SUBMITTER_ROLES", "[]"), "Population scoring role policy is invalid.")
    if not roles <= ACADEMIC_ROLES:
        raise InferenceFailure("AUTHORIZATION_UNAVAILABLE", 503, "Population scoring role policy lists an unapproved role.")
    return roles


def legacy_training_roles() -> frozenset[str]:
    """``PREDICTION_TRAINING_ROLES`` (default ``["SUPERADMIN"]``) during the coexistence."""
    if not legacy_roles_enabled():
        return frozenset()
    roles = _role_list(os.getenv("PREDICTION_TRAINING_ROLES", _DEFAULT_TRAINING_ROLES).strip() or _DEFAULT_TRAINING_ROLES,
                       "ML operator role policy is invalid.")
    if not roles:
        raise InferenceFailure("AUTHORIZATION_UNAVAILABLE", 503, "ML operator role policy must list at least one role.")
    return roles


def has_permission(principal: Principal, permission: str, legacy_roles: Collection[str] = frozenset()) -> bool:
    return permission in principal.permissions or bool(principal.roles & frozenset(legacy_roles))


def _role_list(raw: str, message: str) -> frozenset[str]:
    try:
        roles = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise InferenceFailure("AUTHORIZATION_UNAVAILABLE", 503, message) from exc
    if not isinstance(roles, list) or any(not isinstance(role, str) or not role.strip() for role in roles):
        raise InferenceFailure("AUTHORIZATION_UNAVAILABLE", 503, message)
    return frozenset(role.strip() for role in roles)
