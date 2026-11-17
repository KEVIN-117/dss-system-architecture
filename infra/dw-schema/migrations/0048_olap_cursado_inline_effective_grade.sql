-- 0048: vw_fact_cursado_olap must not call etl_control functions.
--
-- 0047 computed nota_efectiva with etl_control.coursework_pass_outcome().
-- Functions referenced by a view run with the privileges of the querying role,
-- and the OLAP runtime (dw_reader) has no access to etl_control, so every
-- "Rendimiento académico" query failed. The 0044 rule is inlined: the outcome
-- is known exactly when GREATEST(nota, nota_2da, nota_ex_mesa) > 0. Same values.

SET ROLE dw_owner;

CREATE OR REPLACE VIEW dw.vw_fact_cursado_olap AS
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

RESET ROLE;

DO $$
BEGIN
    IF position('etl_control.' IN pg_get_viewdef('dw.vw_fact_cursado_olap'::regclass)) > 0 THEN
        RAISE EXCEPTION '0048: vw_fact_cursado_olap still depends on etl_control';
    END IF;
END;
$$;
