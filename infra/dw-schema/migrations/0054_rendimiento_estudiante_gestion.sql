-- 0054: annual academic performance per student and program (DSA Boletín 3).
--
-- The DSA bulletin "Rendimiento académico" reports by gestión (year), not by
-- period: quantitative evaluation of students (aprobado / reprobado /
-- abandono), average grade (PN), repetition of students (IRE) and year-to-year
-- retention. dw.mv_rendimiento_estudiante_olap holds one row per student
-- (id_alumno), program and gestión with coursework, built from fact_cursado:
--   * materia aprobada: effective grade (0044 rule) >= 51; reprobada: 1-50;
--     abandono: no grade or grade 0 (bulletin "AB");
--   * estudiante aprobado when approved subjects >= the rest of the year's
--     subjects; otherwise reprobado if failed >= abandoned, else abandono
--     (inferred rule: reproduces Boletín 3, 2019: 12,106 / 5,058 / 4,357 vs
--     11,948 / 5,331 / 4,228; pending DSA confirmation);
--   * PN: mean effective grade of the year's subjects counting abandons as 0;
--   * repite: at least one repeated subject in the year (IRE numerator);
--   * retention: coursework in the same program in the next gestión, evaluable
--     only when that gestión has a published closure.
-- Refreshed CONCURRENTLY by mature_hop_retention_labels() with the 0051 base.

SET ROLE dw_owner;

DROP MATERIALIZED VIEW IF EXISTS dw.mv_rendimiento_estudiante_olap CASCADE;
CREATE MATERIALIZED VIEW dw.mv_rendimiento_estudiante_olap AS
WITH attempts AS (
    SELECT e.id_alumno, f.programa_sk, pa.gestion, f.estudiante_sk, f.es_repeticion,
           GREATEST(f.nota_final, f.nota_complementaria, f.nota_examen_mesa) AS nota
    FROM dw.fact_cursado f
    JOIN dw.dim_periodo_academico pa ON pa.periodo_academico_sk = f.periodo_academico_sk
    JOIN dw.dim_estudiante e ON e.estudiante_sk = f.estudiante_sk AND e.member_type = 'STANDARD'
    WHERE pa.member_type = 'STANDARD'
), yearly AS (
    SELECT id_alumno, programa_sk, gestion,
           max(estudiante_sk) AS estudiante_sk,
           count(*)::integer AS materias,
           count(*) FILTER (WHERE nota >= 51)::integer AS aprobadas,
           count(*) FILTER (WHERE nota > 0 AND nota < 51)::integer AS reprobadas,
           count(*) FILTER (WHERE coalesce(nota, 0) = 0)::integer AS abandonadas,
           round(avg(coalesce(nota, 0)), 2) AS promedio_notas,
           bool_or(es_repeticion IS TRUE) AS repite
    FROM attempts
    GROUP BY id_alumno, programa_sk, gestion
), published_years AS (
    SELECT DISTINCT c.gestion
    FROM etl_control.academic_period_closure c
    WHERE c.status = 'PROCESADO' OR (c.status = 'REABIERTO' AND c.processed_run_id IS NOT NULL)
)
SELECT y.id_alumno, y.programa_sk, y.gestion::smallint AS gestion, y.estudiante_sk,
       y.materias, y.aprobadas, y.reprobadas, y.abandonadas, y.promedio_notas,
       1::smallint AS conteo_estudiante,
       (y.aprobadas >= y.reprobadas + y.abandonadas)::integer::smallint AS conteo_aprobado,
       (y.aprobadas < y.reprobadas + y.abandonadas AND y.reprobadas >= y.abandonadas)::integer::smallint AS conteo_reprobado,
       (y.aprobadas < y.reprobadas + y.abandonadas AND y.reprobadas < y.abandonadas)::integer::smallint AS conteo_abandono,
       y.repite::integer::smallint AS conteo_repite,
       (py.gestion IS NOT NULL)::integer::smallint AS conteo_evaluable_retencion,
       (py.gestion IS NOT NULL AND n.id_alumno IS NOT NULL)::integer::smallint AS conteo_retenido
FROM yearly y
LEFT JOIN published_years py ON py.gestion = y.gestion + 1
LEFT JOIN yearly n ON n.id_alumno = y.id_alumno AND n.programa_sk = y.programa_sk
                  AND n.gestion = y.gestion + 1;

CREATE UNIQUE INDEX uq_mv_rendimiento_estudiante_olap
    ON dw.mv_rendimiento_estudiante_olap (id_alumno, programa_sk, gestion);
CREATE INDEX idx_mv_rendimiento_estudiante_olap_gestion
    ON dw.mv_rendimiento_estudiante_olap (gestion, programa_sk);
ANALYZE dw.mv_rendimiento_estudiante_olap;

-- Mondrian contract (no student identifier).
CREATE OR REPLACE VIEW dw.vw_fact_rendimiento_estudiante_olap AS
SELECT m.estudiante_sk, m.programa_sk, m.gestion::integer AS gestion,
       m.materias, m.aprobadas, m.reprobadas, m.abandonadas, m.promedio_notas,
       m.conteo_estudiante, m.conteo_aprobado, m.conteo_reprobado, m.conteo_abandono,
       m.conteo_repite, m.conteo_evaluable_retencion, m.conteo_retenido
FROM dw.mv_rendimiento_estudiante_olap m;

CREATE OR REPLACE VIEW dw.vw_dim_gestion_olap AS
SELECT DISTINCT p.gestion::integer AS gestion, p.gestion_nombre
FROM dw.vw_dim_periodo_olap p;

REVOKE ALL ON dw.mv_rendimiento_estudiante_olap, dw.vw_fact_rendimiento_estudiante_olap,
    dw.vw_dim_gestion_olap FROM PUBLIC;
GRANT SELECT ON dw.mv_rendimiento_estudiante_olap, dw.vw_fact_rendimiento_estudiante_olap,
    dw.vw_dim_gestion_olap TO dw_reader;

COMMENT ON MATERIALIZED VIEW dw.mv_rendimiento_estudiante_olap IS
    '0054: annual performance per student/program/gestión (DSA Boletín 3 rules); refreshed by mature_hop_retention_labels.';

-- Refresh with the coursework base at each publication.
DO $$
DECLARE
    v_definition TEXT;
    c_old CONSTANT TEXT := 'REFRESH MATERIALIZED VIEW CONCURRENTLY dw.mv_fact_cursado_olap;';
    c_new CONSTANT TEXT := 'REFRESH MATERIALIZED VIEW CONCURRENTLY dw.mv_fact_cursado_olap;
    REFRESH MATERIALIZED VIEW CONCURRENTLY dw.mv_rendimiento_estudiante_olap; -- 0054';
BEGIN
    v_definition := pg_get_functiondef('etl_control.mature_hop_retention_labels(uuid)'::REGPROCEDURE);
    IF position('mv_rendimiento_estudiante_olap' IN v_definition) = 0 THEN
        IF length(v_definition) - length(replace(v_definition, c_old, '')) <> length(c_old) THEN
            RAISE EXCEPTION '0054 expected exactly one coursework refresh in mature_hop_retention_labels';
        END IF;
        EXECUTE replace(v_definition, c_old, c_new);
    END IF;
END;
$$;

RESET ROLE;
