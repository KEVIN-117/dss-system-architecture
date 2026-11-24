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
COURSE_FAILURE_EVENT = "COURSE_FAILURE"
# PRED-103. Student-level targets reuse the program-dropout population and
# point-in-time query unchanged (so serving dropout bundles keep their digest);
# enrollment-level targets reuse the course-failure query.
STUDENT_BACKLOG_EVENT = "STUDENT_BACKLOG_NEXT_CUT"
STUDENT_GPA_EVENT = "STUDENT_GPA_NEXT_CUT"
COURSE_FINAL_GRADE_EVENT = "COURSE_FINAL_GRADE"
# Bump when the Python eligibility rule below changes.
ELIGIBILITY_RULE_VERSION = "first-three-academic-years-v3"

# Model cadence by program regime (DW 0045, academico.alm_programas.tipo).
# Annual programs record their single yearly cut in period 1; period 3 is an
# inter-semester term and never a cadence cut.
CADENCE_BY_REGIME = {"A": "ANUAL", "S": "SEMESTRAL"}
CADENCE_PERIODS = {"ANUAL": (1,), "SEMESTRAL": (1, 2)}


def cadence_for(regime: str | None, period: int) -> str:
    """Model cadence of a program cut, or "OTRO" when no model cadence applies."""
    cadence = CADENCE_BY_REGIME.get((regime or "").strip().upper())
    return cadence if cadence and int(period) in CADENCE_PERIODS[cadence] else "OTRO"


@dataclass(frozen=True)
class FeatureSpec:
    name: str
    sql: str
    logical_type: str
    nullable: bool
    source_field: str


PROGRAM_DROPOUT_FEATURES: dict[str, FeatureSpec] = {
    # Features describe the processed cut being scored. The dropout target
    # (no return to the program within the horizon) only looks at later cuts,
    # so the cut's own results are available when the alert is produced.
    spec.name: spec for spec in (
        FeatureSpec("materias_cursadas", "f.materias_cursadas", "integer", True, "dw.fact_retencion_desercion.materias_cursadas"),
        FeatureSpec("materias_aprobadas", "f.materias_aprobadas", "integer", True, "dw.fact_retencion_desercion.materias_aprobadas"),
        FeatureSpec("materias_reprobadas", "f.materias_reprobadas", "integer", True, "dw.fact_retencion_desercion.materias_reprobadas"),
        FeatureSpec("materias_arrastradas", "f.materias_arrastradas", "integer", True, "dw.fact_retencion_desercion.materias_arrastradas (DW 0046: failed and not yet passed in the program up to the cut)"),
        FeatureSpec("ppa_acumulado", "f.ppa_acumulado", "number", True, "dw.fact_retencion_desercion.ppa_acumulado (DW 0046: mean effective grade of evaluated attempts up to the cut)"),
        FeatureSpec("cortes_previos", "cadence.prior_cuts::integer", "integer", False, "dw.fact_cursado distinct processed cadence cuts of the student in the program before the cut"),
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

# Course failure (student, course, cut): will the student not pass a course
# they enrolled in? Every input comes from cuts strictly before the scored cut,
# except the enrolment load of the cut itself, which is known at enrolment.
COURSE_FAILURE_FEATURES: dict[str, FeatureSpec] = {
    spec.name: spec for spec in (
        FeatureSpec("carga_periodo", "cur.load::integer", "integer", False, "dw.fact_cursado courses of the student in the program at the cut (enrolment load)"),
        FeatureSpec("cortes_previos", "coalesce(st.prior_cuts, 0)::integer", "integer", False, "dw.fact_cursado distinct processed semester cuts of the student in the program before the cut"),
        FeatureSpec("ppa_previo", "prev.ppa_acumulado", "number", True, "dw.fact_retencion_desercion.ppa_acumulado at the previous semester cut"),
        FeatureSpec("arrastradas_previas", "prev.materias_arrastradas", "integer", True, "dw.fact_retencion_desercion.materias_arrastradas at the previous semester cut"),
        FeatureSpec("reprobadas_previas", "coalesce(st.prior_failed, 0)::integer", "integer", False, "dw.fact_cursado es_reprobado count before the cut"),
        FeatureSpec("abandonos_previos", "coalesce(st.prior_abandoned, 0)::integer", "integer", False, "dw.fact_cursado es_abandono count before the cut"),
        FeatureSpec("intentos_previos_materia", "coalesce(ss.prior_attempts, 0)::integer", "integer", False, "dw.fact_cursado attempts of the same course before the cut"),
        FeatureSpec("no_aprobadas_previas_materia", "coalesce(ss.prior_not_passed, 0)::integer", "integer", False, "dw.fact_cursado failed or abandoned attempts of the same course before the cut"),
        FeatureSpec("tasa_no_aprobacion_materia", "CASE WHEN rate.graded >= 20 THEN rate.not_passed::numeric / rate.graded END", "number", True, "dw.fact_cursado share of failed or abandoned graded attempts of the course (all students) before the cut; NULL under 20 attempts"),
        FeatureSpec("nivel_materia", "cur.nivel_academico::integer", "integer", True, "dw.dim_materia.nivel_academico"),
    )
}

FEATURES_BY_EVENT: dict[str, dict[str, FeatureSpec]] = {
    PROGRAM_DROPOUT_EVENT: PROGRAM_DROPOUT_FEATURES,
    COURSE_ABANDONMENT_EVENT: COURSE_ABANDONMENT_FEATURES,
    COURSE_FAILURE_EVENT: COURSE_FAILURE_FEATURES,
    STUDENT_BACKLOG_EVENT: PROGRAM_DROPOUT_FEATURES,
    STUDENT_GPA_EVENT: PROGRAM_DROPOUT_FEATURES,
    COURSE_FINAL_GRADE_EVENT: COURSE_FAILURE_FEATURES,
}

#: Events scored with the student-program-cut query and eligibility rule.
STUDENT_CUT_EVENTS = frozenset({PROGRAM_DROPOUT_EVENT, STUDENT_BACKLOG_EVENT, STUDENT_GPA_EVENT})
#: Events scored with the student-course-cut (course failure) query and rule.
ENROLLMENT_CUT_EVENTS = frozenset({COURSE_FAILURE_EVENT, COURSE_FINAL_GRADE_EVENT})


# One row per student enrolled in the program at a processed closure. Every
# input is bounded by that closure's effective_at (point in time). Parameters:
#   %(program)s  program id (dw.dim_programa.id_programa)
#   %(closure)s  closure id
#   %(subject)s  optional student id; NULL returns the whole program population
#   %(limit)s    maximum rows
_PROGRAM_DROPOUT_QUERY = """
WITH requested AS MATERIALIZED (
    SELECT closure_id, effective_at FROM etl_control.academic_period_closure
    WHERE closure_id = %(closure)s::bigint
), program_cadence AS MATERIALIZED (
    -- Cadence is the program regime (DW 0045, academico.alm_programas.tipo):
    -- 'S' two semester cuts (periods 1/2); 'A' one annual cut recorded in
    -- period 1. Period 3 is an inter-semester term, never a cadence cut.
    SELECT (SELECT pp.regimen FROM dw.dim_programa pp
            WHERE pp.member_type = 'STANDARD' AND pp.id_programa = %(program)s
            ORDER BY pp.programa_sk LIMIT 1) AS regimen
), coverage AS MATERIALIZED (
    -- First processed closure of the cadence: a student first seen there may
    -- have started earlier (left-censored history).
    SELECT cov.gestion, cov.periodo
    FROM etl_control.academic_period_closure cov
    CROSS JOIN program_cadence pc CROSS JOIN requested r
    WHERE cov.status = 'PROCESADO' AND cov.effective_at <= r.effective_at
      AND CASE pc.regimen WHEN 'S' THEN cov.periodo IN (1, 2) WHEN 'A' THEN cov.periodo = 1 ELSE FALSE END
    ORDER BY cov.gestion, cov.periodo, cov.closure_id
    LIMIT 1
)
SELECT e.id_alumno::text AS subject_ref, {columns},
       c.closure_id::text AS cut_id, c.gestion AS cut_year, c.periodo AS cut_period,
       start_period.gestion AS start_year, start_period.periodo AS start_period,
       coverage.gestion AS history_start_year, coverage.periodo AS history_start_period,
       e.fec_inscripcion AS enrollment_date, cadence.n AS cadence_count, pcad.regimen AS program_regime,
       f.run_id::text AS source_run_id, f.resultado_retencion, f.es_desercion,
       f.materias_cursadas AS cut_course_count,
       f.conteo_snapshot, f.conteo_evaluable, f.conteo_desercion
FROM dw.fact_retencion_desercion f
JOIN etl_control.academic_period_closure c ON c.closure_id = f.closure_id
  AND c.status = 'PROCESADO' AND c.processed_at IS NOT NULL
  AND c.effective_at <= clock_timestamp()
JOIN dw.dim_estudiante e ON e.estudiante_sk = f.estudiante_sk
  AND e.member_type = 'STANDARD'
  AND e.valid_from <= c.effective_at
  AND (e.valid_to IS NULL OR e.valid_to > c.effective_at)
  -- No fec_inscripcion bound: it is rewritten in the source; the SCD2 version
  -- valid at the cut already proves presence (DW 0041).
JOIN dw.dim_programa p ON p.programa_sk = f.programa_sk
  AND p.member_type = 'STANDARD' AND p.id_programa = %(program)s
CROSS JOIN program_cadence pcad
LEFT JOIN coverage ON TRUE
LEFT JOIN LATERAL (
    SELECT first_cut.gestion, first_cut.periodo
    FROM dw.fact_cursado fc
    JOIN dw.dim_estudiante first_student ON first_student.estudiante_sk = fc.estudiante_sk
      AND first_student.member_type = 'STANDARD' AND first_student.id_alumno = e.id_alumno
    JOIN dw.dim_programa first_program ON first_program.programa_sk = fc.programa_sk
      AND first_program.member_type = 'STANDARD' AND first_program.id_programa = p.id_programa
    JOIN dw.dim_periodo_academico first_period ON first_period.periodo_academico_sk = fc.periodo_academico_sk
    JOIN etl_control.academic_period_closure first_cut ON first_cut.closure_id = first_period.closure_id
      AND first_cut.status = 'PROCESADO' AND first_cut.effective_at <= c.effective_at
    WHERE CASE pcad.regimen WHEN 'S' THEN first_cut.periodo IN (1, 2) WHEN 'A' THEN first_cut.periodo = 1 ELSE FALSE END
    ORDER BY first_cut.gestion, first_cut.periodo, first_cut.closure_id
    LIMIT 1
) start_period ON TRUE
JOIN LATERAL (
    -- An annual program with period-2 coursework has a mixed cadence.
    SELECT count(DISTINCT CASE WHEN pcad.regimen = 'A' AND pa.periodo = 1 THEN 'ANUAL'
                               WHEN pa.periodo IN (1, 2) THEN 'SEMESTRAL' END) AS n,
           count(DISTINCT hcut.closure_id) FILTER (
               WHERE hcut.effective_at < c.effective_at
                 AND CASE pcad.regimen WHEN 'S' THEN pa.periodo IN (1, 2)
                                       WHEN 'A' THEN pa.periodo = 1 ELSE FALSE END) AS prior_cuts
    FROM dw.fact_cursado hc
    -- member_type filters let the partial id_alumno index serve this lookup;
    -- non-standard members carry NULL natural keys, so rows are unchanged.
    JOIN dw.dim_estudiante he ON he.estudiante_sk = hc.estudiante_sk AND he.member_type = 'STANDARD'
      AND he.id_alumno = e.id_alumno
    JOIN dw.dim_programa hp ON hp.programa_sk = hc.programa_sk AND hp.member_type = 'STANDARD'
      AND hp.id_programa = p.id_programa
    JOIN dw.dim_periodo_academico pa ON pa.periodo_academico_sk = hc.periodo_academico_sk
    JOIN etl_control.academic_period_closure hcut ON hcut.closure_id = pa.closure_id
      AND hcut.status = 'PROCESADO'
    WHERE pa.periodo IN (1, 2) AND hcut.effective_at <= c.effective_at
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
), program_cadence AS (
    -- Program regime (DW 0045): 'S' periods 1/2, 'A' one annual cut in period 1.
    SELECT (SELECT pp.regimen FROM dw.dim_programa pp
            WHERE pp.member_type='STANDARD' AND pp.id_programa=%(program)s
            ORDER BY pp.programa_sk LIMIT 1) AS regimen
), coverage AS (
    SELECT cov.gestion, cov.periodo
    FROM etl_control.academic_period_closure cov CROSS JOIN program_cadence pcad CROSS JOIN cut c
    WHERE cov.status='PROCESADO' AND cov.effective_at<=c.effective_at
      AND CASE pcad.regimen WHEN 'S' THEN cov.periodo IN (1,2) WHEN 'A' THEN cov.periodo=1 ELSE FALSE END
    ORDER BY cov.gestion, cov.periodo, cov.closure_id
    LIMIT 1
), first_course AS (
    SELECT c0.gestion, c0.periodo
    FROM dw.fact_cursado fc
    JOIN dw.dim_estudiante e ON e.estudiante_sk=fc.estudiante_sk AND e.member_type='STANDARD'
    JOIN dw.dim_programa p ON p.programa_sk=fc.programa_sk AND p.member_type='STANDARD'
    JOIN dw.dim_periodo_academico pa ON pa.periodo_academico_sk=fc.periodo_academico_sk
    JOIN etl_control.academic_period_closure c0 ON c0.closure_id=pa.closure_id
    CROSS JOIN cut requested CROSS JOIN program_cadence pcad
    WHERE e.id_alumno=%(subject)s::bigint AND p.id_programa=%(program)s AND c0.status='PROCESADO'
      AND c0.effective_at <= requested.effective_at
      AND CASE pcad.regimen WHEN 'S' THEN c0.periodo IN (1,2) WHEN 'A' THEN c0.periodo=1 ELSE FALSE END
    ORDER BY c0.gestion, c0.periodo, c0.closure_id
    LIMIT 1
), cadence AS (
    SELECT count(DISTINCT CASE WHEN pcad.regimen='A' AND pa.periodo=1 THEN 'ANUAL'
                               WHEN pa.periodo IN (1,2) THEN 'SEMESTRAL' END) AS n,
           min(CASE WHEN pcad.regimen='A' AND pa.periodo=1 THEN 'ANUAL'
                    WHEN pa.periodo IN (1,2) THEN 'SEMESTRAL' END) AS value
    FROM dw.fact_cursado fc
    JOIN dw.dim_estudiante e ON e.estudiante_sk=fc.estudiante_sk AND e.member_type='STANDARD'
    JOIN dw.dim_programa p ON p.programa_sk=fc.programa_sk AND p.member_type='STANDARD'
    JOIN dw.dim_periodo_academico pa ON pa.periodo_academico_sk=fc.periodo_academico_sk
    JOIN etl_control.academic_period_closure c0 ON c0.closure_id=pa.closure_id
    CROSS JOIN cut c CROSS JOIN program_cadence pcad
    WHERE e.id_alumno=%(subject)s::bigint AND p.id_programa=%(program)s AND pa.periodo IN (1,2)
      AND c0.status='PROCESADO' AND c0.effective_at<=c.effective_at
)
SELECT {columns}, cd.n AS cadence_count, cd.value AS cadence_value, fc_target.run_id
FROM cut c
JOIN dw.dim_estudiante e ON e.member_type='STANDARD' AND e.id_alumno=%(subject)s::bigint
JOIN dw.dim_programa p ON p.member_type='STANDARD' AND p.id_programa=%(program)s AND p.activo='A'
JOIN dw.fact_cursado fc_target ON fc_target.estudiante_sk=e.estudiante_sk AND fc_target.programa_sk=p.programa_sk
JOIN dw.dim_materia m ON m.materia_sk=fc_target.materia_sk AND m.member_type='STANDARD' AND m.id_materia=%(course)s::bigint
JOIN dw.dim_periodo_academico pa ON pa.periodo_academico_sk=fc_target.periodo_academico_sk AND pa.closure_id=c.closure_id
JOIN history hist ON TRUE CROSS JOIN first_course st CROSS JOIN cadence cd CROSS JOIN coverage cov
WHERE EXISTS (SELECT 1 FROM etl_control.etl_execution run WHERE run.run_id=fc_target.run_id AND run.status='EXITOSA')
  -- Left-censored history: a first course in the first loaded closure may not be the real start.
  AND (st.gestion, st.periodo) <> (cov.gestion, cov.periodo)
  AND ((cd.value='ANUAL' AND c.periodo=1 AND st.periodo=1 AND (c.gestion-st.gestion+1) BETWEEN 1 AND 3)
    OR (cd.value='SEMESTRAL' AND c.periodo IN (1,2)
      AND ((c.gestion-st.gestion)*2+c.periodo-st.periodo+1) BETWEEN 1 AND 6))
  AND cd.n=1
"""

# Course failure batch query: every course row of a semester program at one
# processed closure. Parameters: %(program)s, %(closure)s, %(limit)s and the
# optional serving filters %(subject)s / %(course)s (NULL = whole population).
# Label columns (es_aprobado/es_reprobado/es_abandono/final_grade) are audit
# outputs only; they are never selected as features.
_COURSE_FAILURE_QUERY = """
WITH c AS MATERIALIZED (
    SELECT closure_id, gestion, periodo, effective_at FROM etl_control.academic_period_closure
    WHERE closure_id = %(closure)s::bigint AND status = 'PROCESADO' AND processed_at IS NOT NULL
      AND effective_at <= clock_timestamp()
), pcad AS MATERIALIZED (
    SELECT (SELECT pp.regimen FROM dw.dim_programa pp
            WHERE pp.member_type = 'STANDARD' AND pp.id_programa = %(program)s
            ORDER BY pp.programa_sk LIMIT 1) AS regimen
), hist AS MATERIALIZED (
    -- Every course attempt of the program up to and including the cut.
    SELECT e.id_alumno, m.id_materia, m.nivel_academico, cut.closure_id, cut.gestion, cut.periodo,
           cut.effective_at < c.effective_at AS prior, fc.es_aprobado, fc.es_reprobado, fc.es_abandono, fc.run_id,
           fc.nota_final
    FROM dw.fact_cursado fc
    JOIN dw.dim_programa p ON p.programa_sk = fc.programa_sk AND p.member_type = 'STANDARD' AND p.id_programa = %(program)s
    JOIN dw.dim_estudiante e ON e.estudiante_sk = fc.estudiante_sk AND e.member_type = 'STANDARD'
    JOIN dw.dim_materia m ON m.materia_sk = fc.materia_sk AND m.member_type = 'STANDARD'
    JOIN dw.dim_periodo_academico pa ON pa.periodo_academico_sk = fc.periodo_academico_sk
    JOIN etl_control.academic_period_closure cut ON cut.closure_id = pa.closure_id AND cut.status = 'PROCESADO'
    CROSS JOIN c
    WHERE cut.effective_at <= c.effective_at AND pa.periodo IN (1, 2)
      AND EXISTS (SELECT 1 FROM etl_control.etl_execution run WHERE run.run_id = fc.run_id AND run.status = 'EXITOSA')
), coverage AS MATERIALIZED (
    SELECT min(cov.gestion * 2 + cov.periodo - 1) AS t0
    FROM etl_control.academic_period_closure cov CROSS JOIN c
    WHERE cov.status = 'PROCESADO' AND cov.effective_at <= c.effective_at AND cov.periodo IN (1, 2)
), st AS MATERIALIZED (
    SELECT id_alumno, min(gestion * 2 + periodo - 1) AS start_t,
           count(DISTINCT closure_id) FILTER (WHERE prior) AS prior_cuts,
           count(*) FILTER (WHERE prior AND es_reprobado IS TRUE) AS prior_failed,
           count(*) FILTER (WHERE prior AND es_abandono IS TRUE) AS prior_abandoned
    FROM hist GROUP BY id_alumno
), ss AS MATERIALIZED (
    SELECT id_alumno, id_materia, count(*) AS prior_attempts,
           count(*) FILTER (WHERE es_aprobado IS NOT TRUE AND (es_reprobado IS TRUE OR es_abandono IS TRUE)) AS prior_not_passed
    FROM hist WHERE prior GROUP BY id_alumno, id_materia
), rate AS MATERIALIZED (
    SELECT id_materia,
           count(*) FILTER (WHERE es_aprobado IS TRUE OR es_reprobado IS TRUE OR es_abandono IS TRUE) AS graded,
           count(*) FILTER (WHERE es_aprobado IS NOT TRUE AND (es_reprobado IS TRUE OR es_abandono IS TRUE)) AS not_passed
    FROM hist WHERE prior GROUP BY id_materia
), cur AS MATERIALIZED (
    SELECT h.*, count(*) OVER (PARTITION BY h.id_alumno) AS load
    FROM hist h CROSS JOIN c WHERE h.closure_id = c.closure_id
), prev AS MATERIALIZED (
    -- Previous semester cut of the program: 1 -> 2 of the year before, 2 -> 1.
    SELECT pe.id_alumno, pf.ppa_acumulado, pf.materias_arrastradas
    FROM dw.fact_retencion_desercion pf
    JOIN etl_control.academic_period_closure pcut ON pcut.closure_id = pf.closure_id AND pcut.status = 'PROCESADO'
    JOIN dw.dim_estudiante pe ON pe.estudiante_sk = pf.estudiante_sk AND pe.member_type = 'STANDARD'
    JOIN dw.dim_programa pp ON pp.programa_sk = pf.programa_sk AND pp.member_type = 'STANDARD' AND pp.id_programa = %(program)s
    CROSS JOIN c
    WHERE pcut.effective_at < c.effective_at
      AND ((c.periodo = 2 AND pcut.gestion = c.gestion AND pcut.periodo = 1)
        OR (c.periodo = 1 AND pcut.gestion = c.gestion - 1 AND pcut.periodo = 2))
      AND EXISTS (SELECT 1 FROM etl_control.etl_execution prun WHERE prun.run_id = pf.run_id AND prun.status = 'EXITOSA')
)
SELECT cur.id_alumno::text AS subject_ref, cur.id_materia::text AS course_ref, {columns},
       c.closure_id::text AS cut_id, c.gestion AS cut_year, c.periodo AS cut_period,
       st.start_t, coverage.t0 AS history_start_t, pcad.regimen AS program_regime,
       cur.run_id::text AS source_run_id, cur.es_aprobado, cur.es_reprobado, cur.es_abandono,
       cur.nota_final AS final_grade
FROM cur
CROSS JOIN c CROSS JOIN pcad CROSS JOIN coverage
JOIN st ON st.id_alumno = cur.id_alumno
LEFT JOIN ss ON ss.id_alumno = cur.id_alumno AND ss.id_materia = cur.id_materia
LEFT JOIN rate ON rate.id_materia = cur.id_materia
LEFT JOIN prev ON prev.id_alumno = cur.id_alumno
WHERE (%(subject)s::bigint IS NULL OR cur.id_alumno = %(subject)s::bigint)
  AND (%(course)s::text IS NULL OR cur.id_materia::text = %(course)s::text)
ORDER BY cur.id_alumno, cur.id_materia
LIMIT %(limit)s
"""

QUERIES_BY_EVENT = {
    PROGRAM_DROPOUT_EVENT: _PROGRAM_DROPOUT_QUERY,
    COURSE_ABANDONMENT_EVENT: _COURSE_ABANDONMENT_QUERY,
    COURSE_FAILURE_EVENT: _COURSE_FAILURE_QUERY,
    STUDENT_BACKLOG_EVENT: _PROGRAM_DROPOUT_QUERY,
    STUDENT_GPA_EVENT: _PROGRAM_DROPOUT_QUERY,
    COURSE_FINAL_GRADE_EVENT: _COURSE_FAILURE_QUERY,
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


def course_failure_query(feature_names: list[str]) -> str:
    return _COURSE_FAILURE_QUERY.format(columns=_columns(COURSE_FAILURE_EVENT, feature_names))


def contract_query(event_code: str, feature_names: list[str]) -> str:
    """Point-in-time SQL of any event with a DW feature contract."""
    if event_code not in QUERIES_BY_EVENT:
        raise FeatureContractError(f"No point-in-time feature contract exists for {event_code}.")
    return QUERIES_BY_EVENT[event_code].format(columns=_columns(event_code, feature_names))


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
    program: three annual cuts or six semester cuts (by program regime), with a single cadence and
    a trusted enrollment date, all evaluated at the requested cut.
    """
    if row.get("enrollment_date") is None:
        return "NO_ENROLLMENT_DATE"
    regime = row.get("program_regime")
    if regime not in ("A", "S"):
        # DW 0045: the cadence comes from the program regime; without it the
        # window cannot be established.
        return "UNKNOWN_REGIME"
    if row.get("cadence_count") != 1 or row.get("start_year") is None or row.get("start_period") is None:
        return "MIXED_CADENCE"
    current_year, current_period = int(row["cut_year"]), int(row["cut_period"])
    start_year, start_period = int(row["start_year"]), int(row["start_period"])
    history_start = (row.get("history_start_year"), row.get("history_start_period"))
    if None not in history_start and (start_year, start_period) == tuple(int(v) for v in history_start):
        # First seen in the first loaded closure: the real start may be earlier.
        return "LEFT_CENSORED_START"
    if regime == "A":
        # Annual programs: one cut per year, recorded in period 1.
        if current_period == 1 and start_period == 1:
            elapsed = current_year - start_year + 1
        else:
            elapsed = 0
        maximum = 3
    else:
        if current_period in (1, 2) and start_period in (1, 2):
            elapsed = (current_year - start_year) * 2 + current_period - start_period + 1
        else:
            elapsed = 0
        maximum = 6
    if elapsed < 1 or elapsed > maximum:
        return "OUTSIDE_WINDOW"
    return None
