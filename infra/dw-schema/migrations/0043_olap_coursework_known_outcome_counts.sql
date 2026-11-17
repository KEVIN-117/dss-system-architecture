-- OLAP-CALC-001: denominators for coursework rates.
-- vw_fact_cursado_olap turns NULL repetition/abandonment flags into 0, so a rate
-- over every attempt would report "0%" when the source simply has no value.
-- These counts expose how many attempts carry a known flag so the cube's
-- Repetition Rate and Abandonment Rate divide only by attempts with data.
-- Columns are appended at the end so CREATE OR REPLACE VIEW keeps the contract.

DO $$
BEGIN
    IF to_regclass('dw.vw_fact_cursado_olap') IS NULL
       OR to_regclass('dw.fact_cursado') IS NULL THEN
        RAISE EXCEPTION '0043 requires the 0035 OLAP coursework view';
    END IF;
END;
$$;

SET ROLE dw_owner;

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
    f.nota_final,
    CASE WHEN f.es_repeticion IS NOT NULL THEN f.conteo_intento ELSE 0 END::SMALLINT AS conteo_repeticion_conocida,
    CASE WHEN f.es_abandono IS NOT NULL THEN f.conteo_intento ELSE 0 END::SMALLINT AS conteo_abandono_conocido
FROM dw.fact_cursado f;

COMMENT ON VIEW dw.vw_fact_cursado_olap IS
    'OLAP read contract at one row per coursework attempt; converts nullable outcome flags into additive counts and publishes known-flag counts as rate denominators.';

RESET ROLE;
