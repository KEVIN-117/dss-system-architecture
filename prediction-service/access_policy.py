"""Permission-based access to prediction-service (IAM-013).

Permissions come from the catalog client of the token (``resource_access.dss-permissions.roles``) and are
managed from the admin portal, so changing who may read, publish or train needs no deployment:

* ``analytics:read`` plus a scope permission reads predictions: ``analytics:global`` (institution-wide),
  ``analytics:faculty`` (faculty contexts) or ``analytics:career`` (career contexts). The scope of a user is the
  union of all their academic contexts (IAM-009) across all their scope permissions.
* ``prediction:publish`` starts population scoring, always within that academic scope.
* ``prediction:train`` trains models and manages datasets and models.

The role lists of the coexistence (``PREDICTION_ALLOWED_ROLES``, ``PREDICTION_BATCH_SUBMITTER_ROLES``,
``PREDICTION_TRAINING_ROLES`` and ``PREDICTION_LEGACY_ROLES_ENABLED``) were retired in IAM-019 and are ignored.
"""
from __future__ import annotations

import os

from inference import (  # noqa: F401  (re-exported for callers of the access policy)
    ANALYTICS_CAREER,
    ANALYTICS_FACULTY,
    ANALYTICS_GLOBAL,
    ANALYTICS_READ,
    InferenceFailure,
    Principal,
)

PREDICTION_PUBLISH = "prediction:publish"
PREDICTION_TRAIN = "prediction:train"


def permissions_client_id() -> str:
    return os.getenv("KEYCLOAK_PERMISSIONS_CLIENT_ID", "").strip() or "dss-permissions"


def has_permission(principal: Principal, permission: str) -> bool:
    return permission in principal.permissions
