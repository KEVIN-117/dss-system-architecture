"""Single point-in-time feature contract shared by DW extraction and serving.

Training snapshots and online/batch inference must compute every predictor with
the *same* SQL and the *same* eligibility rule. Both paths import this module:

* ``training.dw_extract`` builds prepared datasets from ``program_dropout_query``.
* ``inference_adapters.DwPredictionDataProvider`` serves features from the same
  query text and applies the same ``program_dropout_ineligibility`` rule.

The contract digest covers feature definitions, query text and eligibility
version. Datasets and model bundles carry it, and serving refuses a bundle whose
digest differs from the running code, so any change to how a feature is
computed forces a new extraction and retraining instead of silent skew.
"""

from __future__ import annotations

import hashlib
import json
from dataclasses import asdict, dataclass
from typing import Any, Mapping

CONTRACT_VERSION = "dw-point-in-time-v1"
PROGRAM_DROPOUT_EVENT = "PROGRAM_DROPOUT_NEXT_EXPECTED_CLOSURE"
COURSE_ABANDONMENT_EVENT = "COURSE_ABANDONMENT"
# Bump when the Python eligibility rule below changes.
ELIGIBILITY_RULE_VERSION = "first-three-academic-years-v1"


@dataclass(frozen=True)
class FeatureSpec:
    name: str
    sql: str
    logical_type: str
    nullable: bool
    source_field: str


PROGRAM_DROPOUT_FEATURES: dict[str, FeatureSpec] = {
    spec.name: spec for spec in (
        FeatureSpec("materias_cursadas", "f.materias_cursadas", "integer", True, "dw.fact_retencion_desercion.materias_cursadas"),
        FeatureSpec("materias_aprobadas", "f.materias_aprobadas", "integer", True, "dw.fact_retencion_desercion.materias_aprobadas"),
        FeatureSpec("materias_reprobadas", "f.materias_reprobadas", "integer", True, "dw.fact_retencion_desercion.materias_reprobadas"),
        FeatureSpec("materias_arrastradas", "f.materias_arrastradas", "integer", True, "dw.fact_retencion_desercion.materias_arrastradas"),
        FeatureSpec("ppa_acumulado", "f.ppa_acumulado", "number", True, "dw.fact_retencion_desercion.ppa_acumulado"),
    )
}

COURSE_ABANDONMENT_FEATURES: dict[str, FeatureSpec] = {
    spec.name: spec for spec in (
        FeatureSpec("materia_ciclo", "m.ciclo::text", "category", True, "dw.dim_materia.ciclo"),
        FeatureSpec("materia_nivel", "m.nivel_academico::text", "category", True, "dw.dim_materia.nivel_academico"),
        FeatureSpec("prior_course_count", "coalesce(hist.prior_course_count, 0)::integer", "integer", False,
                    "dw.fact_cursado count before the cut"),
        FeatureSpec("prior_abandonment_count", "coalesce(hist.prior_abandonment_count, 0)::integer", "integer", False,
                    "dw.fact_cursado es_abandono count before the cut"),
    )
}

FEATURES_BY_EVENT: dict[str, dict[str, FeatureSpec]] = {
    PROGRAM_DROPOUT_EVENT: PROGRAM_DROPOUT_FEATURES,
    COURSE_ABANDONMENT_EVENT: COURSE_ABANDONMENT_FEATURES,
}


# One row per student enrolled in the program at a processed closure. Every
# input is bounded by that closure's effective_at (point in time). Parameters:
#   %(program)s  program id (dw.dim_programa.id_programa)
#   %(closure)s  closure id
#   %(subject)s  optional student id; NULL returns the whole program population
#   %(limit)s    maximum rows
_PROGRAM_DROPOUT_QUERY = """
SELECT e.id_alumno::text AS subject_ref, {columns},
       c.closure_id::text AS cut_id, c.gestion AS cut_year, c.periodo AS cut_period,
       start_period.gestion AS start_year, start_period.periodo AS start_period,
       e.fec_inscripcion AS enrollment_date, cadence.n AS cadence_count,
       f.run_id::text AS source_run_id, f.resultado_retencion, f.es_desercion,
       f.conteo_snapshot, f.conteo_evaluable, f.conteo_desercion
FROM dw.fact_retencion_desercion f
JOIN etl_control.academic_period_closure c ON c.closure_id = f.closure_id
  AND c.status = 'PROCESADO' AND c.processed_at IS NOT NULL
  AND c.effective_at <= clock_timestamp()
JOIN dw.dim_estudiante e ON e.estudiante_sk = f.estudiante_sk
  AND e.member_type = 'STANDARD'
  AND e.valid_from <= c.effective_at
  AND (e.valid_to IS NULL OR e.valid_to > c.effective_at)
  AND e.fec_inscripcion <= c.effective_at::date
JOIN dw.dim_programa p ON p.programa_sk = f.programa_sk
  AND p.member_type = 'STANDARD' AND p.id_programa = %(program)s
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
JOIN LATERAL (
    SELECT count(DISTINCT CASE WHEN pa.periodo = 3 THEN 'ANUAL'
                               WHEN pa.periodo IN (1, 2) THEN 'SEMESTRAL' END) AS n
    FROM dw.fact_cursado hc
    JOIN dw.dim_estudiante he ON he.estudiante_sk = hc.estudiante_sk AND he.id_alumno = e.id_alumno
    JOIN dw.dim_programa hp ON hp.programa_sk = hc.programa_sk AND hp.id_programa = p.id_programa
    JOIN dw.dim_periodo_academico pa ON pa.periodo_academico_sk = hc.periodo_academico_sk
    JOIN etl_control.academic_period_closure hcut ON hcut.closure_id = pa.closure_id
      AND hcut.status = 'PROCESADO'
    WHERE pa.periodo IN (1, 2, 3) AND hcut.effective_at <= c.effective_at
) cadence ON TRUE
WHERE f.closure_id = %(closure)s::bigint
  AND (%(subject)s::bigint IS NULL OR e.id_alumno = %(subject)s::bigint)
  AND EXISTS (SELECT 1 FROM etl_control.etl_execution run
              WHERE run.run_id = f.run_id AND run.status = 'EXITOSA')
ORDER BY e.id_alumno
LIMIT %(limit)s
"""


# Course abandonment serving query (one student/course at a cut). Only prior
# history and subject metadata are used; the course label is never selected.
_COURSE_ABANDONMENT_QUERY = """
WITH cut AS (
    SELECT closure_id, gestion, periodo, effective_at FROM etl_control.academic_period_closure
    WHERE closure_id=%(closure)s::bigint AND status='PROCESADO' AND processed_at IS NOT NULL
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
    WHERE e.id_alumno=%(subject)s::bigint AND p.id_programa=%(program)s AND prev.status='PROCESADO'
      AND prev.effective_at < c.effective_at
), first_course AS (
    SELECT c0.gestion, c0.periodo
    FROM dw.fact_cursado fc
    JOIN dw.dim_estudiante e ON e.estudiante_sk=fc.estudiante_sk AND e.member_type='STANDARD'
    JOIN dw.dim_programa p ON p.programa_sk=fc.programa_sk AND p.member_type='STANDARD'
    JOIN dw.dim_periodo_academico pa ON pa.periodo_academico_sk=fc.periodo_academico_sk
    JOIN etl_control.academic_period_closure c0 ON c0.closure_id=pa.closure_id
    CROSS JOIN cut requested
    WHERE e.id_alumno=%(subject)s::bigint AND p.id_programa=%(program)s AND c0.status='PROCESADO'
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
    WHERE e.id_alumno=%(subject)s::bigint AND p.id_programa=%(program)s AND pa.periodo IN (1,2,3)
      AND c0.status='PROCESADO' AND c0.effective_at<=c.effective_at
)
SELECT {columns}, cd.n AS cadence_count, cd.value AS cadence_value, fc_target.run_id
FROM cut c
JOIN dw.dim_estudiante e ON e.member_type='STANDARD' AND e.id_alumno=%(subject)s::bigint
JOIN dw.dim_programa p ON p.member_type='STANDARD' AND p.id_programa=%(program)s AND p.activo='A'
JOIN dw.fact_cursado fc_target ON fc_target.estudiante_sk=e.estudiante_sk AND fc_target.programa_sk=p.programa_sk
JOIN dw.dim_materia m ON m.materia_sk=fc_target.materia_sk AND m.member_type='STANDARD' AND m.id_materia=%(course)s::bigint
JOIN dw.dim_periodo_academico pa ON pa.periodo_academico_sk=fc_target.periodo_academico_sk AND pa.closure_id=c.closure_id
JOIN history hist ON TRUE CROSS JOIN first_course st CROSS JOIN cadence cd
WHERE EXISTS (SELECT 1 FROM etl_control.etl_execution run WHERE run.run_id=fc_target.run_id AND run.status='EXITOSA')
  AND ((cd.value='ANUAL' AND c.periodo=3 AND (c.gestion-st.gestion+1) BETWEEN 1 AND 3)
    OR (cd.value='SEMESTRAL' AND c.periodo IN (1,2)
      AND ((c.gestion-st.gestion)*2+c.periodo-st.periodo+1) BETWEEN 1 AND 6))
  AND cd.n=1
"""

QUERIES_BY_EVENT = {
    PROGRAM_DROPOUT_EVENT: _PROGRAM_DROPOUT_QUERY,
    COURSE_ABANDONMENT_EVENT: _COURSE_ABANDONMENT_QUERY,
}


class FeatureContractError(ValueError):
    """A dataset or model bundle is not bound to the running feature contract."""


def _columns(event_code: str, feature_names: list[str]) -> str:
    catalog = FEATURES_BY_EVENT[event_code]
    unknown = [name for name in feature_names if name not in catalog]
    if unknown or not feature_names:
        raise FeatureContractError(f"Features outside the {event_code} point-in-time contract: {unknown or 'none requested'}.")
    return ", ".join(f'{catalog[name].sql} AS "{name}"' for name in feature_names)


def program_dropout_query(feature_names: list[str]) -> str:
    return _PROGRAM_DROPOUT_QUERY.format(columns=_columns(PROGRAM_DROPOUT_EVENT, feature_names))


def course_abandonment_query(feature_names: list[str]) -> str:
    return _COURSE_ABANDONMENT_QUERY.format(columns=_columns(COURSE_ABANDONMENT_EVENT, feature_names))


def contract_digest(event_code: str) -> str:
    """Digest of everything that determines a feature value for this event."""
    if event_code not in FEATURES_BY_EVENT:
        raise FeatureContractError(f"No point-in-time feature contract exists for {event_code}.")
    body = {
        "version": CONTRACT_VERSION,
        "event_code": event_code,
        "eligibility_rule": ELIGIBILITY_RULE_VERSION,
        "features": {name: asdict(spec) for name, spec in sorted(FEATURES_BY_EVENT[event_code].items())},
        "query": QUERIES_BY_EVENT[event_code],
    }
    canonical = json.dumps(body, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def contract_reference(event_code: str, feature_names: list[str]) -> dict[str, Any]:
    """The ``feature_contract`` block stamped into datasets and model manifests."""
    _columns(event_code, feature_names)
    return {
        "version": CONTRACT_VERSION,
        "event_code": event_code,
        "digest": contract_digest(event_code),
        "features": list(feature_names),
    }


def field_definitions(event_code: str, feature_names: list[str]) -> list[dict[str, Any]]:
    """Prepared-dataset field entries whose availability is proven by this contract."""
    catalog = FEATURES_BY_EVENT[event_code]
    _columns(event_code, feature_names)
    return [{
        "name": name, "logical_type": catalog[name].logical_type, "role": "feature",
        "nullable": catalog[name].nullable, "available_at_cut": True,
        "source_field": catalog[name].source_field,
    } for name in feature_names]


def verify_reference(reference: Any, event_code: str, feature_names: list[str],
                     fields: list[Mapping[str, Any]] | None = None) -> None:
    """Raise FeatureContractError unless ``reference`` matches the running contract."""
    if not isinstance(reference, Mapping):
        raise FeatureContractError("No feature_contract binds these features to the point-in-time DW contract.")
    if reference.get("event_code") != event_code:
        raise FeatureContractError("feature_contract was produced for a different prediction event.")
    if reference.get("version") != CONTRACT_VERSION or reference.get("digest") != contract_digest(event_code):
        raise FeatureContractError(
            "feature_contract digest differs from the running feature definitions; re-extract the dataset and retrain."
        )
    if list(reference.get("features") or []) != list(feature_names):
        raise FeatureContractError("feature_contract feature list differs from the declared predictors.")
    catalog = FEATURES_BY_EVENT[event_code]
    for field in fields or []:
        name = field.get("name")
        if name in feature_names and field.get("logical_type") != catalog[name].logical_type:
            raise FeatureContractError(f"Feature '{name}' type differs from the point-in-time contract.")


def program_dropout_ineligibility(row: Mapping[str, Any]) -> str | None:
    """Shared eligibility rule; returns a reason code or None when eligible.

    The population is the student's first three academic years in the
    program: three annual cuts or six semester cuts, with a single cadence and
    a trusted enrollment date, all evaluated at the requested cut.
    """
    if row.get("enrollment_date") is None:
        return "NO_ENROLLMENT_DATE"
    if row.get("cadence_count") != 1:
        return "MIXED_CADENCE"
    current_year, current_period = int(row["cut_year"]), int(row["cut_period"])
    start_year, start_period = int(row["start_year"]), int(row["start_period"])
    if current_period == 3 and start_period == 3:
        elapsed = current_year - start_year + 1
    elif current_period in (1, 2) and start_period in (1, 2):
        elapsed = (current_year - start_year) * 2 + current_period - start_period + 1
    else:
        elapsed = 0
    maximum = 3 if current_period == 3 else 6
    if elapsed < 1 or elapsed > maximum:
        return "OUTSIDE_WINDOW"
    return None
