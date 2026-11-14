-- 0051: narrow materialized base for the "Rendimiento académico" cube.
--
-- dw.fact_cursado is ~500 MB (1.18M wide rows). Every Mondrian segment query
-- (notably the distinct student count used for privacy and "Estudiantes")
-- re-read it from disk and took 40-130 s on the local DW, over the 60 s OLAP
-- datasource timeout. dw.mv_fact_cursado_olap keeps only the columns of
-- vw_fact_cursado_olap (same names, types and order) and the view now reads
-- from it, so the Mondrian schema does not change. The materialized view is
-- refreshed by mature_hop_retention_labels(), i.e. in the transaction that
-- publishes each closure, so OLAP never shows a partial publication.

SET ROLE dw_owner;

DROP MATERIALIZED VIEW IF EXISTS dw.mv_fact_cursado_olap CASCADE;
CREATE MATERIALIZED VIEW dw.mv_fact_cursado_olap AS
SELECT f.fact_cursado_id,
    f.estudiante_sk,
    f.programa_sk,
    f.materia_sk,
    f.periodo_academico_sk,
    f.conteo_intento,
    (CASE WHEN f.nota_final IS NOT NULL THEN f.conteo_intento::integer ELSE 0 END)::smallint AS conteo_calificado,
    (CASE WHEN f.es_aprobado IS TRUE THEN f.conteo_intento::integer ELSE 0 END)::smallint AS conteo_aprobado,
    (CASE WHEN f.es_reprobado IS TRUE THEN f.conteo_intento::integer ELSE 0 END)::smallint AS conteo_reprobado,
    (CASE WHEN f.es_repeticion IS TRUE THEN f.conteo_intento::integer ELSE 0 END)::smallint AS conteo_repeticion,
    (CASE WHEN f.es_abandono IS TRUE THEN f.conteo_intento::integer ELSE 0 END)::smallint AS conteo_abandono,
    f.nota_final,
    (CASE WHEN f.es_repeticion IS NOT NULL THEN f.conteo_intento::integer ELSE 0 END)::smallint AS conteo_repeticion_conocida,
    (CASE WHEN f.es_abandono IS NOT NULL THEN f.conteo_intento::integer ELSE 0 END)::smallint AS conteo_abandono_conocido,
    CASE WHEN GREATEST(f.nota_final, f.nota_complementaria, f.nota_examen_mesa) > 0
         THEN GREATEST(f.nota_final, f.nota_complementaria, f.nota_examen_mesa) END AS nota_efectiva,
    (CASE WHEN f.es_aprobado IS NOT NULL THEN f.conteo_intento::integer ELSE 0 END)::smallint AS conteo_con_resultado
FROM dw.fact_cursado f;

CREATE UNIQUE INDEX uq_mv_fact_cursado_olap_id ON dw.mv_fact_cursado_olap (fact_cursado_id);
CREATE INDEX idx_mv_fact_cursado_olap_period ON dw.mv_fact_cursado_olap (periodo_academico_sk, programa_sk);
ANALYZE dw.mv_fact_cursado_olap;

CREATE OR REPLACE VIEW dw.vw_fact_cursado_olap AS
SELECT m.fact_cursado_id, m.estudiante_sk, m.programa_sk, m.materia_sk, m.periodo_academico_sk,
       m.conteo_intento, m.conteo_calificado, m.conteo_aprobado, m.conteo_reprobado,
       m.conteo_repeticion, m.conteo_abandono, m.nota_final, m.conteo_repeticion_conocida,
       m.conteo_abandono_conocido, m.nota_efectiva, m.conteo_con_resultado
FROM dw.mv_fact_cursado_olap m;

REVOKE ALL ON dw.mv_fact_cursado_olap FROM PUBLIC;
GRANT SELECT ON dw.mv_fact_cursado_olap TO dw_reader;

COMMENT ON MATERIALIZED VIEW dw.mv_fact_cursado_olap IS
    '0051: narrow OLAP base of fact_cursado; refreshed by mature_hop_retention_labels at each publication.';

-- Refresh it when a closure is published (inside the publication transaction).
DO $$
DECLARE
    v_definition TEXT;
    c_old CONSTANT TEXT := $old$
    v_relabelled := etl_control.relabel_hop_retention_closures(v_predecessors);
    RETURN v_relabelled;$old$;
    c_new CONSTANT TEXT := $new$
    v_relabelled := etl_control.relabel_hop_retention_closures(v_predecessors);
    -- 0051: keep the OLAP coursework base in step with the publication.
    REFRESH MATERIALIZED VIEW dw.mv_fact_cursado_olap;
    RETURN v_relabelled;$new$;
BEGIN
    v_definition := pg_get_functiondef('etl_control.mature_hop_retention_labels(uuid)'::REGPROCEDURE);
    IF position('0051: keep the OLAP coursework base' IN v_definition) = 0 THEN
        IF length(v_definition) - length(replace(v_definition, c_old, '')) <> length(c_old) THEN
            RAISE EXCEPTION '0051 expected exactly one relabel/return block in mature_hop_retention_labels';
        END IF;
        EXECUTE replace(v_definition, c_old, c_new);
    END IF;
END;
$$;

RESET ROLE;
