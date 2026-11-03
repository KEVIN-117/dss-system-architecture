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
            response = httpx.get(auth_url, headers={"Authorization": f"Bearer {access_token}"}, timeout=5.0)
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

    _FEATURE_COLUMNS = {
        "materias_cursadas": "f.materias_cursadas",
        "materias_aprobadas": "f.materias_aprobadas",
        "materias_reprobadas": "f.materias_reprobadas",
        "materias_arrastradas": "f.materias_arrastradas",
        "ppa_acumulado": "f.ppa_acumulado",
    }

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

    def load_features(self, subject_ref: str, context: ProgramContext, manifest: Mapping[str, Any],
                      event_type: str = "program_dropout", course_ref: str | None = None) -> Mapping[str, Any]:
        if not subject_ref.isdecimal() or int(subject_ref) <= 0:
            raise InferenceFailure("INVALID_REQUEST", 400, "subject_ref must identify a positive academic student ID.")
        expected_event = "COURSE_ABANDONMENT" if event_type == "course_abandonment" else "PROGRAM_DROPOUT_NEXT_EXPECTED_CLOSURE"
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
        if event_type == "course_abandonment":
            if not course_ref or not course_ref.isdecimal() or int(course_ref) <= 0:
                raise InferenceFailure("INVALID_REQUEST", 400, "course_ref must identify a positive academic subject ID.")
            feature_sql = {
                "materia_ciclo": "m.ciclo::text", "materia_nivel": "m.nivel_academico::text",
                "prior_course_count": "coalesce(hist.prior_course_count, 0)::integer",
                "prior_abandonment_count": "coalesce(hist.prior_abandonment_count, 0)::integer",
            }
            if any(name not in feature_sql for name in feature_names):
                raise InferenceFailure("INCOMPATIBLE_SCHEMA", 503, "The course model requests a feature outside the point-in-time DW serving contract.")
            columns = ", ".join(f'{feature_sql[name]} AS "{name}"' for name in feature_names)
            sql = f"""
                WITH cut AS (
                    SELECT closure_id, gestion, periodo, effective_at FROM etl_control.academic_period_closure
                    WHERE closure_id=%s::bigint AND status='PROCESADO' AND processed_at IS NOT NULL
                      AND effective_at <= clock_timestamp()
                ), history AS (
                    SELECT count(*)::integer AS prior_course_count,
                           count(*) FILTER (WHERE fc.es_abandono IS TRUE)::integer AS prior_abandonment_count
                    FROM dw.fact_cursado fc
                    JOIN dw.dim_estudiante e ON e.estudiante_sk=fc.estudiante_sk AND e.member_type='STANDARD'
                    JOIN dw.dim_programa p ON p.programa_sk=fc.programa_sk AND p.member_type='STANDARD'
                    JOIN dw.dim_periodo_academico pa ON pa.periodo_academico_sk=fc.periodo_academico_sk
                    JOIN etl_control.academic_period_closure prev ON prev.closure_id=pa.closure_id
                    CROSS JOIN cut c
                    WHERE e.id_alumno=%s AND p.id_programa=%s AND prev.status='PROCESADO'
                      AND prev.effective_at < c.effective_at
                ), first_course AS (
                    SELECT c0.gestion, c0.periodo
                    FROM dw.fact_cursado fc
                    JOIN dw.dim_estudiante e ON e.estudiante_sk=fc.estudiante_sk AND e.member_type='STANDARD'
                    JOIN dw.dim_programa p ON p.programa_sk=fc.programa_sk AND p.member_type='STANDARD'
                    JOIN dw.dim_periodo_academico pa ON pa.periodo_academico_sk=fc.periodo_academico_sk
                    JOIN etl_control.academic_period_closure c0 ON c0.closure_id=pa.closure_id
                    CROSS JOIN cut requested
                    WHERE e.id_alumno=%s AND p.id_programa=%s AND c0.status='PROCESADO'
                      AND c0.effective_at <= requested.effective_at
                    ORDER BY c0.gestion, CASE c0.periodo WHEN 1 THEN 1 WHEN 2 THEN 2 WHEN 3 THEN 1 ELSE 9 END, c0.closure_id
                    LIMIT 1
                ), cadence AS (
                    SELECT count(DISTINCT CASE WHEN pa.periodo=3 THEN 'ANUAL' WHEN pa.periodo IN (1,2) THEN 'SEMESTRAL' END) AS n,
                           min(CASE WHEN pa.periodo=3 THEN 'ANUAL' WHEN pa.periodo IN (1,2) THEN 'SEMESTRAL' END) AS value
                    FROM dw.fact_cursado fc
                    JOIN dw.dim_estudiante e ON e.estudiante_sk=fc.estudiante_sk AND e.member_type='STANDARD'
                    JOIN dw.dim_programa p ON p.programa_sk=fc.programa_sk AND p.member_type='STANDARD'
                    JOIN dw.dim_periodo_academico pa ON pa.periodo_academico_sk=fc.periodo_academico_sk
                    JOIN etl_control.academic_period_closure c0 ON c0.closure_id=pa.closure_id
                    CROSS JOIN cut c
                    WHERE e.id_alumno=%s AND p.id_programa=%s AND pa.periodo IN (1,2,3)
                      AND c0.status='PROCESADO' AND c0.effective_at<=c.effective_at
                )
                SELECT {columns}, cd.n, cd.value, fc_target.run_id
                FROM cut c
                JOIN dw.dim_estudiante e ON e.member_type='STANDARD' AND e.id_alumno=%s
                JOIN dw.dim_programa p ON p.member_type='STANDARD' AND p.id_programa=%s AND p.activo='A'
                JOIN dw.fact_cursado fc_target ON fc_target.estudiante_sk=e.estudiante_sk AND fc_target.programa_sk=p.programa_sk
                JOIN dw.dim_materia m ON m.materia_sk=fc_target.materia_sk AND m.member_type='STANDARD' AND m.id_materia=%s
                JOIN dw.dim_periodo_academico pa ON pa.periodo_academico_sk=fc_target.periodo_academico_sk AND pa.closure_id=c.closure_id
                JOIN history hist ON TRUE CROSS JOIN first_course st CROSS JOIN cadence cd
                WHERE EXISTS (SELECT 1 FROM etl_control.etl_execution run WHERE run.run_id=fc_target.run_id AND run.status='EXITOSA')
                  AND ((cd.value='ANUAL' AND c.periodo=3 AND (c.gestion-st.gestion+1) BETWEEN 1 AND 3)
                    OR (cd.value='SEMESTRAL' AND c.periodo IN (1,2)
                      AND ((c.gestion-st.gestion)*2+c.periodo-st.periodo+1) BETWEEN 1 AND 6))
                  AND cd.n=1
            """
            params = (int(context.cut_id), int(subject_ref), context.program_code, int(subject_ref), context.program_code,
                      int(subject_ref), context.program_code, int(subject_ref), context.program_code, int(course_ref))
            try:
                with psycopg.connect(self.database_url, connect_timeout=5, options="-c default_transaction_read_only=on") as connection:
                    rows = connection.execute(sql, params).fetchall()
            except Exception as exc:
                raise InferenceFailure("DATA_UNAVAILABLE", 503, "Trusted course feature data could not be loaded from the DW.") from exc
            if len(rows) != 1:
                raise InferenceFailure("INELIGIBLE_PROFILE", 422, "No eligible course record is available at the requested cut.")
            row = rows[0]
            if row[-3] != 1 or row[-2] != context.cadence:
                raise InferenceFailure("INELIGIBLE_PROFILE", 422, "The student's academic cadence is mixed or differs from the requested cut.")
            return {name: row[index] for index, name in enumerate(feature_names)}

        if course_ref is not None:
            raise InferenceFailure("INVALID_REQUEST", 400, "course_ref is only valid for course_abandonment.")
        if any(name not in self._FEATURE_COLUMNS for name in feature_names):
            raise InferenceFailure("INCOMPATIBLE_SCHEMA", 503, "The active model requests a feature not exposed by the DW serving contract.")

        columns = ", ".join(f"{self._FEATURE_COLUMNS[name]} AS \"{name}\"" for name in feature_names)
        sql = f"""
            SELECT {columns}, c.gestion, c.periodo, start_period.gestion, start_period.periodo,
                   e.fec_inscripcion
            FROM dw.fact_retencion_desercion f
            JOIN etl_control.academic_period_closure c ON c.closure_id = f.closure_id
              AND c.status = 'PROCESADO' AND c.processed_at IS NOT NULL
              AND c.effective_at <= clock_timestamp()
            JOIN dw.dim_estudiante e ON e.estudiante_sk = f.estudiante_sk
              AND e.member_type = 'STANDARD' AND e.id_alumno = %s
              AND e.valid_from <= c.effective_at
              AND (e.valid_to IS NULL OR e.valid_to > c.effective_at)
              AND e.fec_inscripcion <= c.effective_at::date
            JOIN dw.dim_programa p ON p.programa_sk = f.programa_sk
              AND p.member_type = 'STANDARD' AND p.id_programa = %s
            JOIN LATERAL (
                SELECT first_cut.gestion, first_cut.periodo
                FROM dw.fact_cursado fc
                JOIN dw.dim_estudiante first_student ON first_student.estudiante_sk = fc.estudiante_sk
                  AND first_student.member_type = 'STANDARD' AND first_student.id_alumno = e.id_alumno
                JOIN dw.dim_programa first_program ON first_program.programa_sk = fc.programa_sk
                  AND first_program.member_type = 'STANDARD' AND first_program.id_programa = p.id_programa
                JOIN dw.dim_periodo_academico first_period ON first_period.periodo_academico_sk = fc.periodo_academico_sk
                JOIN etl_control.academic_period_closure first_cut ON first_cut.closure_id = first_period.closure_id
                  AND first_cut.status = 'PROCESADO' AND first_cut.effective_at <= c.effective_at
                ORDER BY first_cut.gestion,
                    CASE first_cut.periodo WHEN 1 THEN 1 WHEN 2 THEN 2 WHEN 3 THEN 1 ELSE 9 END,
                    first_cut.closure_id
                LIMIT 1
            ) start_period ON TRUE
            WHERE f.closure_id = %s::bigint
              AND EXISTS (SELECT 1 FROM etl_control.etl_execution run
                          WHERE run.run_id = f.run_id AND run.status = 'EXITOSA')
        """
        try:
            with psycopg.connect(self.database_url, connect_timeout=5, options="-c default_transaction_read_only=on") as connection:
                rows = connection.execute(sql, (int(subject_ref), context.program_code, int(context.cut_id))).fetchall()
                distinct_cadences = connection.execute(
                    """SELECT count(DISTINCT CASE WHEN pa.periodo = 3 THEN 'ANUAL'
                                WHEN pa.periodo IN (1,2) THEN 'SEMESTRAL' ELSE 'OTRO' END)
                       FROM dw.fact_cursado fc
                       JOIN dw.dim_estudiante e ON e.estudiante_sk=fc.estudiante_sk AND e.id_alumno=%s
                       JOIN dw.dim_programa p ON p.programa_sk=fc.programa_sk AND p.id_programa=%s
                       JOIN dw.dim_periodo_academico pa ON pa.periodo_academico_sk=fc.periodo_academico_sk
                       JOIN etl_control.academic_period_closure c ON c.closure_id=pa.closure_id AND c.status='PROCESADO'
                       WHERE pa.periodo IN (1,2,3) AND c.effective_at <= %s::timestamptz""",
                    (int(subject_ref), context.program_code, context.effective_at),
                ).fetchone()[0]
        except Exception as exc:
            raise InferenceFailure("DATA_UNAVAILABLE", 503, "Trusted feature data could not be loaded from the DW.") from exc
        if len(rows) != 1:
            raise InferenceFailure("RESOURCE_NOT_FOUND", 404, "No eligible student record is available in this academic scope.")

        values = rows[0]
        current_year, current_period, start_year, start_period, enrollment_date = values[-5:]
        if enrollment_date is None:
            raise InferenceFailure("INELIGIBLE_PROFILE", 422, "The student has no trusted enrollment date.")
        if distinct_cadences != 1:
            raise InferenceFailure("INELIGIBLE_PROFILE", 422, "The student's academic cadence is mixed or cannot be established.")
        if int(current_period) == 3 and int(start_period) == 3:
            elapsed_academic_periods = int(current_year) - int(start_year) + 1
        elif int(current_period) in (1, 2) and int(start_period) in (1, 2):
            elapsed_academic_periods = (int(current_year) - int(start_year)) * 2 + int(current_period) - int(start_period) + 1
        else:
            elapsed_academic_periods = 0
        maximum = 3 if int(current_period) == 3 else 6
        if elapsed_academic_periods < 1 or elapsed_academic_periods > maximum:
            raise InferenceFailure("INELIGIBLE_PROFILE", 422, "The student is outside the first-three-academic-years prediction window.")
        return {name: values[index] for index, name in enumerate(feature_names)}


def _required_env(name: str) -> str:
    value = os.getenv(name, "").strip()
    if not value:
        raise InferenceFailure("AUTHORIZATION_UNAVAILABLE", 503, f"Required inference configuration is missing: {name}.")
    return value


@lru_cache(maxsize=8)
def _jwks_client(uri: str) -> PyJWKClient:
    return PyJWKClient(uri)
