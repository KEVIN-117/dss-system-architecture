"""IAM-013: prediction access from dss-permissions and the union of every academic context."""
from __future__ import annotations

import os
import unittest
from unittest.mock import MagicMock, patch

import access_policy
from inference import InferenceFailure, Principal, ProgramContext, authorize_program_context
from inference_adapters import ConfiguredAcademicPolicy, KeycloakIdentityProvider

READ = "analytics:read"
GLOBAL = "analytics:global"
FACULTY = "analytics:faculty"
CAREER = "analytics:career"

#: Program P01 of faculty 10 and program P05 of faculty 20.
P01 = ProgramContext("P01", "P01", 10, "42", 2026, 1, "2026-06-01T00:00:00+00:00")
P05 = ProgramContext("P05", "P05", 20, "42", 2026, 1, "2026-06-01T00:00:00+00:00")
P02 = ProgramContext("P02", "P02", 10, "42", 2026, 1, "2026-06-01T00:00:00+00:00")


def principal(permissions=(), contexts=(), roles=()):
    return Principal("user", frozenset(roles), tuple(contexts), frozenset(permissions))


def faculty(faculty_id):
    return {"facultyId": faculty_id, "careerId": None}


def career(faculty_id, career_id):
    return {"facultyId": faculty_id, "careerId": career_id}


def allowed(who, context):
    try:
        authorize_program_context(who, context)
        return True
    except InferenceFailure as failure:
        assert failure.status_code == 403
        return False


class PermissionAndContextMatrixTests(unittest.TestCase):
    """Every combination of scope permission and academic contexts."""

    def test_matrix(self):
        cases = [
            # (permissions, contexts, P01 allowed, P05 allowed, P02 allowed)
            ({READ, GLOBAL}, (), True, True, True),
            ({GLOBAL}, (), False, False, False),  # scope without analytics:read
            ({READ}, (faculty(10),), False, False, False),  # read without scope
            ({READ, FACULTY}, (), False, False, False),  # scope without contexts
            ({READ, FACULTY}, (faculty(10),), True, False, True),
            ({READ, FACULTY}, (faculty(10), faculty(20)), True, True, True),  # acting dean of two faculties
            ({READ, FACULTY}, (career(10, "P01"),), False, False, False),  # career context is not faculty-wide
            ({READ, CAREER}, (career(10, "P01"),), True, False, False),
            ({READ, CAREER}, (career(10, "P01"), career(20, "P05")), True, True, False),  # two careers
            ({READ, CAREER}, (career(20, "P01"),), False, False, False),  # career code under another faculty
            ({READ, CAREER}, (faculty(10),), False, False, False),  # faculty context needs analytics:faculty
            ({READ, FACULTY, CAREER}, (faculty(10), career(20, "P05")), True, True, True),  # union of kinds
            ({READ, FACULTY, CAREER, GLOBAL}, (), True, True, True),
            ({"prediction:train", "iam:users:write"}, (faculty(10),), False, False, False),  # SUPERADMIN-like
        ]
        for permissions, contexts, p01, p05, p02 in cases:
            who = principal(permissions, contexts)
            with self.subTest(permissions=sorted(permissions), contexts=contexts):
                self.assertEqual(allowed(who, P01), p01)
                self.assertEqual(allowed(who, P05), p05)
                self.assertEqual(allowed(who, P02), p02)

    def test_superadmin_role_has_no_academic_access(self):
        self.assertFalse(allowed(principal((), (), {"SUPERADMIN"}), P01))


class RetiredRoleListTests(unittest.TestCase):
    """IAM-019: realm roles and the old role lists grant nothing by themselves; only permissions do."""

    def test_realm_roles_without_permissions_grant_nothing(self):
        for role in ("RECTOR", "DECANO", "DIRECTOR"):
            with self.subTest(role=role):
                self.assertFalse(allowed(principal((), (faculty(10), career(10, "P01")), {role}), P01))

    def test_the_retired_environment_variables_are_ignored(self):
        retired = {"PREDICTION_ALLOWED_ROLES": '["RECTOR"]', "PREDICTION_BATCH_SUBMITTER_ROLES": '["RECTOR"]',
                   "PREDICTION_TRAINING_ROLES": '["SUPERADMIN"]', "PREDICTION_LEGACY_ROLES_ENABLED": "true"}
        with patch.dict(os.environ, retired):
            with self.assertRaises(InferenceFailure) as raised:
                ConfiguredAcademicPolicy().authorize(principal(roles={"RECTOR"}), P01)
            self.assertEqual(raised.exception.status_code, 403)
            self.assertFalse(access_policy.has_permission(principal(roles={"SUPERADMIN"}), "prediction:train"))


class ConfiguredPolicyTests(unittest.TestCase):
    def test_permissions_need_no_role_configuration(self):
        ConfiguredAcademicPolicy().authorize(principal({READ, GLOBAL}), P01)


class PermissionHelperTests(unittest.TestCase):
    def test_has_permission(self):
        self.assertTrue(access_policy.has_permission(principal({"prediction:train"}), "prediction:train"))
        self.assertFalse(access_policy.has_permission(principal(roles={"SUPERADMIN"}), "prediction:train"))
        self.assertFalse(access_policy.has_permission(principal({"prediction:publish"}), "prediction:train"))


class KeycloakPermissionClaimTests(unittest.TestCase):
    """The identity provider reads permissions from the catalog client only."""

    ENV = {
        "KEYCLOAK_AUDIENCE": "prediction-service",
        "KEYCLOAK_ISSUER_URI": "http://keycloak/realms/uatf-dss-realm",
        "AUTH_SERVICE_URL": "http://auth-service:8000",
    }

    def authenticate(self, claims, env=None):
        jwks = MagicMock()
        jwks.get_signing_key_from_jwt.return_value = MagicMock(key="key")
        profile = MagicMock()
        profile.json.return_value = {"isActive": True,
                                     "academicContexts": [faculty(10), faculty(20)]}
        values = {"KEYCLOAK_PERMISSIONS_CLIENT_ID": "", **self.ENV, **(env or {})}
        with patch.dict(os.environ, values), \
                patch("inference_adapters._jwks_client", return_value=jwks), \
                patch("inference_adapters.jwt.decode", return_value=claims), \
                patch("inference_adapters.httpx.get", return_value=profile):
            return KeycloakIdentityProvider().authenticate("token")

    def test_reads_catalog_permissions_and_every_context(self):
        result = self.authenticate({
            "sub": "user-1",
            "realm_access": {"roles": ["DECANO", "analytics:global"]},
            "resource_access": {
                "dss-permissions": {"roles": ["analytics:read", "analytics:faculty", 7]},
                "olap-service": {"roles": ["analytics:global"]},
            },
        })
        self.assertEqual(result.permissions, frozenset({"analytics:read", "analytics:faculty"}))
        self.assertEqual(result.roles, frozenset({"DECANO", "analytics:global"}))
        self.assertEqual(len(result.academic_contexts), 2)
        # Faculties 10 and 20 from the profile; the realm role named like a permission grants nothing.
        self.assertTrue(allowed(result, P05))
        self.assertNotIn(GLOBAL, result.permissions)

    def test_client_roles_outside_the_catalog_are_ignored_and_the_catalog_is_configurable(self):
        claims = {"sub": "user-1", "resource_access": {"uatf-auth-service": {"roles": ["RECTOR"]},
                                                       "catalog": {"roles": ["prediction:train"]}}}
        default = self.authenticate(claims)
        self.assertEqual(default.roles, frozenset())
        self.assertEqual(default.permissions, frozenset())
        # KEYCLOAK_ROLE_CLIENT_ID was retired in IAM-019: setting it no longer reads that client's roles.
        configured = self.authenticate(claims, {"KEYCLOAK_ROLE_CLIENT_ID": "uatf-auth-service",
                                                "KEYCLOAK_PERMISSIONS_CLIENT_ID": "catalog"})
        self.assertEqual(configured.roles, frozenset())
        self.assertEqual(configured.permissions, frozenset({"prediction:train"}))


if __name__ == "__main__":
    unittest.main()
