"""Keycloak/Auth Service and read-only DW adapters for online inference."""

from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from functools import lru_cache
from typing import Any, Mapping
from urllib.parse import quote

import httpx
import jwt
import psycopg
from jwt import PyJWKClient

from feature_contract import (
    COURSE_ABANDONMENT_EVENT,
    PROGRAM_DROPOUT_EVENT,
    FeatureContractError,
    course_abandonment_query,
    program_dropout_ineligibility,
    program_dropout_query,
    verify_reference,
)
from inference import (
    AuthorizationPolicy,
    InferenceFailure,
    Principal,
    ProgramContext,
    authorize_program_context,
)


class KeycloakIdentityProvider:
    def authenticate(self, access_token: str) -> Principal:
        audience = _required_env("KEYCLOAK_AUDIENCE")
        role_client_id = _required_env("KEYCLOAK_ROLE_CLIENT_ID")
        issuer = os.getenv("KEYCLOAK_ISSUER_URI", "").strip()
        if not issuer:
            keycloak_url = _required_env("KEYCLOAK_URL")
            realm = _required_env("KEYCLOAK_REALM")
            issuer = f"{keycloak_url.rstrip('/')}/realms/{quote(realm, safe='')}"
        jwks_uri = os.getenv("KEYCLOAK_JWKS_URL", "").strip()
        if not jwks_uri:
            jwks_uri = f"{issuer.rstrip('/')}/protocol/openid-connect/certs"
        jwks = _jwks_client(jwks_uri)
        try:
            signing_key = jwks.get_signing_key_from_jwt(access_token)
            claims = jwt.decode(
                access_token,
                signing_key.key,
                algorithms=["RS256"],
                audience=audience,
                issuer=issuer,
                options={"require": ["aud", "exp", "iss", "sub"]},
            )
        except Exception as exc:
            raise InferenceFailure("INVALID_TOKEN", 401, "The access token is invalid or expired.") from exc
        subject = claims.get("sub")
        if not isinstance(subject, str) or not subject:
            raise InferenceFailure("INVALID_TOKEN", 401, "The access token has no valid subject.")

        role_names: set[str] = set()
        realm_access = claims.get("realm_access")
        if isinstance(realm_access, dict) and isinstance(realm_access.get("roles"), list):
            role_names.update(role for role in realm_access["roles"] if isinstance(role, str))
        resource_access = claims.get("resource_access")
        if isinstance(resource_access, dict):
            client_access = resource_access.get(role_client_id)
            if isinstance(client_access, dict) and isinstance(client_access.get("roles"), list):
                role_names.update(role for role in client_access["roles"] if isinstance(role, str))

        # AUTH_SERVICE_URL is the service origin (for example,
        # http://auth-service:8000); Auth Service is mounted below /api/v1.
        auth_url = _required_env("AUTH_SERVICE_URL").rstrip("/") + "/api/v1/auth/me"
        try:
            http_timeout = httpx.Timeout(connect=3.0, read=5.0, write=5.0, pool=5.0)
            response = httpx.get(auth_url, headers={"Authorization": f"Bearer {access_token}"}, timeout=http_timeout)
            response.raise_for_status()
            profile = response.json()
        except Exception as exc:
            raise InferenceFailure("DATA_UNAVAILABLE", 503, "The identity profile service is unavailable.") from exc
        if not isinstance(profile, dict) or profile.get("isActive") is not True:
            raise InferenceFailure("INVALID_TOKEN", 401, "The account is inactive or has no valid profile.")
        contexts = profile.get("academicContexts")
        if not isinstance(contexts, list) or any(not isinstance(item, dict) for item in contexts):
            raise InferenceFailure("DATA_UNAVAILABLE", 503, "The identity profile has no valid academic scope.")
        return Principal(subject=subject, roles=frozenset(role_names), academic_contexts=tuple(contexts))


class ConfiguredAcademicPolicy(AuthorizationPolicy):
    def __init__(self) -> None:
        self.raw_roles = os.getenv("PREDICTION_ALLOWED_ROLES", "").strip()

    def authorize(self, principal: Principal, context: ProgramContext) -> None:
        if not self.raw_roles:
            raise InferenceFailure("AUTHORIZATION_UNAVAILABLE", 503, "Prediction academic role policy is not configured.")
        try:
            roles = json.loads(self.raw_roles)
        except json.JSONDecodeError as exc:
            raise InferenceFailure("AUTHORIZATION_UNAVAILABLE", 503, "Prediction role policy is invalid.") from exc
        if not isinstance(roles, list) or not roles or any(role not in {"DIRECTOR", "DECANO", "RECTOR"} for role in roles):
            raise InferenceFailure("AUTHORIZATION_UNAVAILABLE", 503, "Prediction role policy must list approved academic roles.")
        authorize_program_context(principal, context, set(roles))


class DwPredictionDataProvider:
    """Resolve one processed DW cut and its point-in-time academic features."""

    def __init__(self, database_url: str | None = None):
        self.database_url = database_url or os.getenv("PREDICTION_DW_DATABASE_URL", "").strip()

    def resolve_context(self, program_ref: str, cut_id: str) -> ProgramContext:
        if not self.database_url:
            raise InferenceFailure("DATA_UNAVAILABLE", 503, "The read-only prediction DW connection is not configured.")
        if not cut_id.isdecimal():
            raise InferenceFailure("INVALID_REQUEST", 400, "academic_cut.cut_id must identify a numeric DW closure.")
        sql = """
            SELECT p.id_programa, p.id_facultad, c.closure_id::text, c.gestion,
                   c.periodo, c.effective_at
            FROM dw.dim_programa p
            CROSS JOIN etl_control.academic_period_closure c
            WHERE p.member_type = 'STANDARD' AND p.activo = 'A'
              AND p.id_programa = %s
              AND c.closure_id = %s::bigint
              AND c.status = 'PROCESADO'
              AND c.processed_at IS NOT NULL
              AND c.effective_at <= clock_timestamp()
              AND EXISTS (
                  SELECT 1
                  FROM dw.fact_retencion_desercion f
                  WHERE f.programa_sk = p.programa_sk
                    AND f.closure_id = c.closure_id
                    AND EXISTS (
                        SELECT 1 FROM etl_control.etl_execution run
                        WHERE run.run_id = f.run_id AND run.status = 'EXITOSA'
                    )
              )
        """
        try:
            with psycopg.connect(self.database_url, connect_timeout=5, options="-c default_transaction_read_only=on") as connection:
                rows = connection.execute(sql, (program_ref, cut_id)).fetchall()
        except Exception as exc:
            raise InferenceFailure("DATA_UNAVAILABLE", 503, "The requested DW cut is unavailable.") from exc
        if len(rows) != 1 or rows[0][1] is None:
            raise InferenceFailure("RESOURCE_NOT_FOUND", 404, "The requested program or academic cut is unavailable.")
        program_code, faculty_id, closure, year, period, effective_at = rows[0]
        return ProgramContext(
            program_ref=program_ref,
            program_code=program_code,
            faculty_id=int(faculty_id),
            cut_id=closure,
            academic_year=int(year),
            academic_period=int(period),
            effective_at=effective_at.astimezone(timezone.utc).isoformat(),
            cadence="ANUAL" if int(period) == 3 else "SEMESTRAL" if int(period) in (1, 2) else "OTRO",
        )

    def list_available_contexts(self) -> list[tuple[ProgramContext, str]]:
        """List active program/cut pairs backed by successful processed DW facts."""
        if not self.database_url:
            raise InferenceFailure("DATA_UNAVAILABLE", 503, "The read-only prediction DW connection is not configured.")
        sql = """
            SELECT DISTINCT p.id_programa, p.id_facultad, p.programa,
                   c.closure_id::text, c.gestion, c.periodo, c.effective_at
            FROM dw.dim_programa p
            JOIN dw.fact_retencion_desercion f ON f.programa_sk=p.programa_sk
            JOIN etl_control.academic_period_closure c ON c.closure_id=f.closure_id
              AND c.status='PROCESADO' AND c.processed_at IS NOT NULL
              AND c.effective_at<=clock_timestamp()
            WHERE p.member_type='STANDARD' AND p.activo='A'
              AND EXISTS (SELECT 1 FROM etl_control.etl_execution run
                          WHERE run.run_id=f.run_id AND run.status='EXITOSA')
            ORDER BY p.programa, c.gestion DESC, c.periodo DESC, p.id_programa
        """
        try:
            with psycopg.connect(self.database_url, connect_timeout=5, options="-c default_transaction_read_only=on") as connection:
                rows = connection.execute(sql).fetchall()
        except Exception as exc:
            raise InferenceFailure("DATA_UNAVAILABLE", 503, "Available academic programs and cuts could not be loaded.") from exc
        contexts: list[tuple[ProgramContext, str]] = []
        for program_code, faculty_id, program_name, closure, year, period, effective_at in rows:
            if faculty_id is None:
                continue
            academic_period = int(period)
            contexts.append((ProgramContext(
                program_ref=program_code,
                program_code=program_code,
                faculty_id=int(faculty_id),
                cut_id=closure,
                academic_year=int(year),
                academic_period=academic_period,
                effective_at=effective_at.astimezone(timezone.utc).isoformat(),
                cadence="ANUAL" if academic_period == 3 else "SEMESTRAL" if academic_period in (1, 2) else "OTRO",
            ), program_name or program_code))
        return contexts

    def list_program_population(self, context: ProgramContext, limit: int = 25000) -> tuple[list[str], list[str]]:
        """Return student references and source executions visible in one processed cut.

        Eligibility is intentionally checked again per student by ``load_features``;
        this query only finds the closed-cut candidate population and its ETL lineage.
        """
        if not self.database_url:
            raise InferenceFailure("DATA_UNAVAILABLE", 503, "The read-only prediction DW connection is not configured.")
        sql = """
            SELECT DISTINCT e.id_alumno::text AS subject_ref
            FROM dw.fact_retencion_desercion f
            JOIN etl_control.academic_period_closure c ON c.closure_id=f.closure_id
              AND c.status='PROCESADO' AND c.processed_at IS NOT NULL AND c.effective_at<=clock_timestamp()
            JOIN dw.dim_estudiante e ON e.estudiante_sk=f.estudiante_sk AND e.member_type='STANDARD'
              AND e.valid_from<=c.effective_at AND (e.valid_to IS NULL OR e.valid_to>c.effective_at)
              AND e.fec_inscripcion<=c.effective_at::date
            JOIN dw.dim_programa p ON p.programa_sk=f.programa_sk AND p.member_type='STANDARD'
              AND p.id_programa=%s AND p.activo='A'
            WHERE f.closure_id=%s::bigint
              AND EXISTS (SELECT 1 FROM etl_control.etl_execution run
                          WHERE run.run_id=f.run_id AND run.status='EXITOSA')
            ORDER BY subject_ref
            LIMIT %s
        """
        try:
            with psycopg.connect(self.database_url, connect_timeout=5, options="-c default_transaction_read_only=on") as connection:
                rows = connection.execute(sql, (context.program_code, int(context.cut_id), limit + 1)).fetchall()
        except Exception as exc:
            raise InferenceFailure("DATA_UNAVAILABLE", 503, "The program population could not be loaded from the DW.") from exc
        if len(rows) > limit:
            raise InferenceFailure("POPULATION_LIMIT_EXCEEDED", 422, "The requested program population exceeds the configured batch limit.")
        lineage_sql = """
            SELECT DISTINCT f.run_id::text AS run_id
            FROM dw.fact_retencion_desercion f
            JOIN dw.dim_programa p ON p.programa_sk=f.programa_sk
              AND p.member_type='STANDARD' AND p.id_programa=%s AND p.activo='A'
            WHERE f.closure_id=%s::bigint
              AND EXISTS (SELECT 1 FROM etl_control.etl_execution run
                          WHERE run.run_id=f.run_id AND run.status='EXITOSA')
            ORDER BY run_id
        """
        try:
            with psycopg.connect(self.database_url, connect_timeout=5, options="-c default_transaction_read_only=on") as connection:
                source_runs = connection.execute(lineage_sql, (context.program_code, int(context.cut_id))).fetchall()
        except Exception as exc:
            raise InferenceFailure("DATA_UNAVAILABLE", 503, "The program population lineage could not be loaded from the DW.") from exc
        return ([row[0] for row in rows], sorted({row[0] for row in source_runs if row[0]}))

    def _serving_schema(self, manifest: Mapping[str, Any], event_type: str, context: ProgramContext) -> list[str]:
        """Validate the bundle against the request and the running feature contract."""
        expected_event = COURSE_ABANDONMENT_EVENT if event_type == "course_abandonment" else PROGRAM_DROPOUT_EVENT
        if manifest.get("classes", {}).get("event_code") != expected_event:
            raise InferenceFailure("INCOMPATIBLE_SCHEMA", 503, "The active model does not serve the requested prediction event.")
        scope = manifest.get("serving_scope", {})
        if scope and scope.get("cadence") != context.cadence:
            raise InferenceFailure("INCOMPATIBLE_SCHEMA", 503, "The active model cadence does not match the requested academic cut.")
        schema = manifest.get("input_schema", {})
        fields = schema.get("fields", []) if isinstance(schema, Mapping) else []
        feature_names = schema.get("feature_names", []) if isinstance(schema, Mapping) else []
        by_name = {field.get("name"): field for field in fields if isinstance(field, Mapping)}
        if not feature_names or set(by_name) != set(feature_names):
            raise InferenceFailure("INCOMPATIBLE_SCHEMA", 503, "The active model serving schema is invalid.")
        if any(by_name[name].get("available_at_cut") is not True for name in feature_names):
            raise InferenceFailure("INCOMPATIBLE_SCHEMA", 503, "A model feature lacks proof of availability at the requested cut.")
        try:
            # The bundle must have been trained on data extracted with exactly
            # the feature definitions this service is about to compute.
            verify_reference(manifest.get("feature_contract"), expected_event, list(feature_names), fields)
        except FeatureContractError as exc:
            raise InferenceFailure("INCOMPATIBLE_SCHEMA", 503, str(exc)) from exc
        return list(feature_names)

    def _connect(self):
        return psycopg.connect(self.database_url, connect_timeout=5, options="-c default_transaction_read_only=on")

    def load_features(self, subject_ref: str, context: ProgramContext, manifest: Mapping[str, Any],
                      event_type: str = "program_dropout", course_ref: str | None = None) -> Mapping[str, Any]:
        if not subject_ref.isdecimal() or int(subject_ref) <= 0:
            raise InferenceFailure("INVALID_REQUEST", 400, "subject_ref must identify a positive academic student ID.")
        if event_type != "course_abandonment" and course_ref is not None:
            raise InferenceFailure("INVALID_REQUEST", 400, "course_ref is only valid for course_abandonment.")
        feature_names = self._serving_schema(manifest, event_type, context)
        if event_type == "course_abandonment":
            return self._load_course_features(subject_ref, context, feature_names, course_ref)

        sql = program_dropout_query(feature_names)
        params = {"program": context.program_code, "closure": int(context.cut_id), "subject": int(subject_ref), "limit": 2}
        try:
            with self._connect() as connection:
                cursor = connection.execute(sql, params)
                columns = [column.name for column in cursor.description]
                rows = [dict(zip(columns, values)) for values in cursor.fetchall()]
        except Exception as exc:
            raise InferenceFailure("DATA_UNAVAILABLE", 503, "Trusted feature data could not be loaded from the DW.") from exc
        if len(rows) != 1:
            raise InferenceFailure("RESOURCE_NOT_FOUND", 404, "No eligible student record is available in this academic scope.")
        reason = program_dropout_ineligibility(rows[0])
        if reason is not None:
            raise InferenceFailure("INELIGIBLE_PROFILE", 422, _INELIGIBILITY_DETAIL[reason])
        return {name: rows[0][name] for name in feature_names}

    def load_population_features(self, context: ProgramContext, manifest: Mapping[str, Any],
                                 limit: int = 25000) -> tuple[dict[str, Mapping[str, Any]], dict[str, int], list[str]]:
        """Load every eligible student's features for one program/cut in a single query.

        Uses the exact query and eligibility rule of ``load_features``. Returns
        ``(features_by_subject, ineligible_counts_by_reason, source_run_ids)``.
        """
        if not self.database_url:
            raise InferenceFailure("DATA_UNAVAILABLE", 503, "The read-only prediction DW connection is not configured.")
        feature_names = self._serving_schema(manifest, "program_dropout", context)
        sql = program_dropout_query(feature_names)
        params = {"program": context.program_code, "closure": int(context.cut_id), "subject": None, "limit": limit + 1}
        try:
            with self._connect() as connection:
                cursor = connection.execute(sql, params)
                columns = [column.name for column in cursor.description]
                rows = [dict(zip(columns, values)) for values in cursor.fetchall()]
        except Exception as exc:
            raise InferenceFailure("DATA_UNAVAILABLE", 503, "The program population could not be loaded from the DW.") from exc
        if len(rows) > limit:
            raise InferenceFailure("POPULATION_LIMIT_EXCEEDED", 422, "The requested program population exceeds the configured batch limit.")
        features: dict[str, Mapping[str, Any]] = {}
        ineligible: dict[str, int] = {}
        for row in rows:
            reason = program_dropout_ineligibility(row)
            if reason is not None:
                ineligible[reason] = ineligible.get(reason, 0) + 1
                continue
            features[row["subject_ref"]] = {name: row[name] for name in feature_names}
        source_runs = sorted({row["source_run_id"] for row in rows if row.get("source_run_id")})
        return features, ineligible, source_runs

    def _load_course_features(self, subject_ref: str, context: ProgramContext, feature_names: list[str],
                              course_ref: str | None) -> Mapping[str, Any]:
        if not course_ref or not course_ref.isdecimal() or int(course_ref) <= 0:
            raise InferenceFailure("INVALID_REQUEST", 400, "course_ref must identify a positive academic subject ID.")
        sql = course_abandonment_query(feature_names)
        params = {"closure": int(context.cut_id), "subject": int(subject_ref), "program": context.program_code,
                  "course": int(course_ref)}
        try:
            with self._connect() as connection:
                rows = connection.execute(sql, params).fetchall()
        except Exception as exc:
            raise InferenceFailure("DATA_UNAVAILABLE", 503, "Trusted course feature data could not be loaded from the DW.") from exc
        if len(rows) != 1:
            raise InferenceFailure("INELIGIBLE_PROFILE", 422, "No eligible course record is available at the requested cut.")
        row = rows[0]
        if row[-3] != 1 or row[-2] != context.cadence:
            raise InferenceFailure("INELIGIBLE_PROFILE", 422, "The student's academic cadence is mixed or differs from the requested cut.")
        return {name: row[index] for index, name in enumerate(feature_names)}


_INELIGIBILITY_DETAIL = {
    "NO_ENROLLMENT_DATE": "The student has no trusted enrollment date.",
    "MIXED_CADENCE": "The student's academic cadence is mixed or cannot be established.",
    "OUTSIDE_WINDOW": "The student is outside the first-three-academic-years prediction window.",
}


def _required_env(name: str) -> str:
    value = os.getenv(name, "").strip()
    if not value:
        raise InferenceFailure("AUTHORIZATION_UNAVAILABLE", 503, f"Required inference configuration is missing: {name}.")
    return value


@lru_cache(maxsize=8)
def _jwks_client(uri: str) -> PyJWKClient:
    return PyJWKClient(uri)
