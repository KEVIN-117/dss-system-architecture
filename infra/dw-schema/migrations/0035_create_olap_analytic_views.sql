-- FRONT-014: stable read contracts for the descriptive Director cubes.
-- These views keep OLAP aggregations on the declared fact grain and expose
-- only aggregate flags/keys; student identifiers are deliberately excluded.

DO $$
BEGIN
    IF to_regclass('dw.fact_admision') IS NULL
       OR to_regclass('dw.fact_cursado') IS NULL
       OR to_regclass('dw.fact_retencion_desercion') IS NULL
       OR to_regclass('dw.dim_estudiante') IS NULL
       OR to_regclass('dw.dim_programa') IS NULL
       OR to_regclass('dw.dim_materia') IS NULL
       OR to_regclass('dw.dim_periodo_academico') IS NULL
       OR to_regclass('dw.dim_admision') IS NULL THEN
        RAISE EXCEPTION 'OLAP analytic views require the DW-MVP-001 fact constellation';
    END IF;
END;
$$;

SET ROLE dw_owner;

CREATE OR REPLACE VIEW dw.vw_fact_admision_olap AS
SELECT
    f.fact_admision_id,
    f.estudiante_sk,
    CASE WHEN f.estudiante_sk > 0 THEN f.estudiante_sk END AS applicant_person_sk,
    CASE WHEN f.es_admitido IS TRUE AND f.estudiante_sk > 0 THEN f.estudiante_sk END AS admitted_person_sk,
    CASE WHEN f.es_admitido IS NOT NULL AND f.estudiante_sk > 0 THEN f.estudiante_sk END AS known_outcome_person_sk,
    f.programa_sk,
    f.periodo_academico_sk,
    f.admision_sk,
    f.conteo_postulacion,
    CASE WHEN f.es_admitido IS TRUE THEN f.conteo_postulacion ELSE 0 END::SMALLINT AS conteo_admitido,
    CASE WHEN f.es_admitido IS NOT NULL THEN f.conteo_postulacion ELSE 0 END::SMALLINT AS conteo_resultado_conocido,
    f.puntaje_examen
FROM dw.fact_admision f;

CREATE OR REPLACE VIEW dw.vw_fact_cursado_olap AS
SELECT
    f.fact_cursado_id,
    f.estudiante_sk,
    f.programa_sk,
    f.materia_sk,
    f.periodo_academico_sk,
    f.conteo_intento,
    CASE WHEN f.nota_final IS NOT NULL THEN f.conteo_intento ELSE 0 END::SMALLINT AS conteo_calificado,
    CASE WHEN f.es_aprobado IS TRUE THEN f.conteo_intento ELSE 0 END::SMALLINT AS conteo_aprobado,
    CASE WHEN f.es_reprobado IS TRUE THEN f.conteo_intento ELSE 0 END::SMALLINT AS conteo_reprobado,
    CASE WHEN f.es_repeticion IS TRUE THEN f.conteo_intento ELSE 0 END::SMALLINT AS conteo_repeticion,
    CASE WHEN f.es_abandono IS TRUE THEN f.conteo_intento ELSE 0 END::SMALLINT AS conteo_abandono,
    f.nota_final
FROM dw.fact_cursado f;

CREATE OR REPLACE VIEW dw.vw_fact_retencion_olap AS
SELECT
    f.fact_retencion_desercion_id,
    f.estudiante_sk,
    f.programa_sk,
    f.periodo_academico_sk,
    f.closure_id,
    f.conteo_snapshot,
    f.conteo_evaluable,
    f.conteo_desercion,
    CASE WHEN f.resultado_retencion = 'RETENIDO' THEN f.conteo_evaluable ELSE 0 END::SMALLINT AS conteo_retenido,
    f.materias_cursadas,
    f.materias_aprobadas,
    f.materias_reprobadas,
    f.materias_arrastradas,
    f.ppa_acumulado,
    f.resultado_retencion
FROM dw.fact_retencion_desercion f;

REVOKE ALL ON dw.vw_fact_admision_olap,
    dw.vw_fact_cursado_olap,
    dw.vw_fact_retencion_olap FROM PUBLIC;
GRANT SELECT ON dw.vw_fact_admision_olap,
    dw.vw_fact_cursado_olap,
    dw.vw_fact_retencion_olap TO dw_reader;

COMMENT ON VIEW dw.vw_fact_admision_olap IS
    'OLAP read contract at one source application row; includes distinct-student keys for applicant/admit counts plus the additive application count.';
COMMENT ON VIEW dw.vw_fact_cursado_olap IS
    'OLAP read contract at one row per coursework attempt; converts nullable outcome flags into additive counts.';
COMMENT ON VIEW dw.vw_fact_retencion_olap IS
    'OLAP read contract at one student/program/closed-period snapshot; NO_EVALUABLE is excluded from retention/dropout denominators.';

RESET ROLE;
