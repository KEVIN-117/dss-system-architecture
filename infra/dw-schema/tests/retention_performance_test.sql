-- Regression for 0046: ppa_acumulado and materias_arrastradas are computed at
-- publication, point in time, with the 0044 effective-grade rule.
-- Two real publications (2097-1, 2097-2); everything is rolled back.
BEGIN;

INSERT INTO etl_control.academic_period_closure (gestion, periodo, created_by_subject, closure_reason)
VALUES (2097, 1, 'dsa:test', 'Rendimiento C1'), (2097, 2, 'dsa:test', 'Rendimiento C2')
ON CONFLICT (gestion, periodo) DO NOTHING;
SELECT etl_control.transition_academic_period_closure(2097::smallint, 1::smallint, 'CERRADO'::varchar(16),
    'dsa:test'::varchar(255), 'Cierre C1', clock_timestamp() - interval '2 minutes');
SELECT etl_control.transition_academic_period_closure(2097::smallint, 2::smallint, 'CERRADO'::varchar(16),
    'dsa:test'::varchar(255), 'Cierre C2', clock_timestamp() - interval '1 minute');

INSERT INTO dw.dim_programa (programa_sk, member_type, id_programa, programa, regimen)
VALUES (952000001, 'STANDARD', 'RP1', 'Programa rendimiento', 'S');
INSERT INTO dw.dim_materia (materia_sk, member_type, id_materia, sigla, materia)
VALUES (952000001, 'STANDARD', 952001, 'MTA952', 'Materia A'),
       (952000002, 'STANDARD', 952002, 'MTB952', 'Materia B');
INSERT INTO dw.dim_periodo_academico (periodo_academico_sk, member_type, closure_id, gestion, periodo, effective_at)
SELECT 952000000 + c.periodo, 'STANDARD', c.closure_id, c.gestion, c.periodo, c.effective_at
FROM etl_control.academic_period_closure c WHERE c.gestion = 2097;
INSERT INTO dw.dim_estudiante (
    estudiante_sk, member_type, id_ra, id_alumno, fec_inscripcion, fec_egreso,
    estado_academico, tipo_alumno, valid_from, valid_to, is_current, attribute_hash_scd2
)
SELECT 952000000 + g, 'STANDARD', NULL, 952000000 + g, DATE '2000-01-01', NULL,
       'A', 'R', TIMESTAMPTZ '2000-01-01 00:00:00+00', NULL, TRUE, repeat('d', 64)
FROM generate_series(1, 2) AS g;

-- Test-only helper (rolled back). p_rows: [{student, subject, period, grade}].
CREATE FUNCTION etl_control.t0046_publish(p_run UUID, p_rows JSONB)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
    v_i INTEGER := 0;
    v_r JSONB;
    v_ret BIGINT;
    v_token UUID;
BEGIN
    PERFORM etl_control.start_hop_etl_execution(p_run, 'Inicio rendimiento');
    FOR v_i IN 1..9 LOOP
        PERFORM etl_control.register_etl_source_manifest(p_run,
            (ARRAY['public.uatf_datos', 'academico.alumnos', 'public.postulantes',
                   'academico.alm_programas', 'academico.pln_materias', 'academico.notas_planilla',
                   'academico.alm_programas_facultades', 'public.prs_colegios',
                   'public.lugar_localidad'])[v_i]::varchar(150),
            'v1'::varchar(64),
            (ARRAY['public', 'academico', 'public', 'academico', 'academico', 'academico',
                   'academico', 'public', 'public'])[v_i]::varchar(63),
            (ARRAY['uatf_datos', 'alumnos', 'postulantes', 'alm_programas', 'pln_materias',
                   'notas_planilla', 'alm_programas_facultades', 'prs_colegios',
                   'lugar_localidad'])[v_i]::varchar(63),
            repeat('a', 64)::char(64), 'fixture-order'::text, 'COMPLETO'::varchar(16),
            repeat('b', 64)::char(64), NULL::smallint, NULL::smallint,
            NULL::timestamptz, 0::bigint, '{}'::jsonb);
    END LOOP;
    PERFORM etl_control.register_etl_execution_step(p_run, s.code::varchar(100), s.phase::varchar(20),
        'EXITOSO'::varchar(16), s.ord::smallint, 'fixture'::text, 'test'::varchar(255), '{}'::jsonb)
    FROM (VALUES ('extract', 'EXTRACCION', 1), ('transform', 'TRANSFORMACION', 2),
                 ('validate', 'VALIDACION', 3)) AS s(code, phase, ord);
    v_i := 0;
    FOR v_r IN SELECT jsonb_array_elements(p_rows) LOOP
        v_i := v_i + 1;
        PERFORM etl_control.stage_hop_publication_row(p_run, 'FACT_CURSADO', v_i, 'INSERT',
            (v_r->>'period') || ':' || (v_r->>'student') || ':' || (v_r->>'subject'),
            jsonb_build_object('estudiante_sk', 952000000 + (v_r->>'student')::int,
                'programa_sk', 952000001,
                'materia_sk', 952000000 + (v_r->>'subject')::int,
                'periodo_academico_sk', 952000000 + (v_r->>'period')::int,
                'id_matricula_origen', 9520000 + (v_r->>'period')::int * 100 + v_i,
                'estado_origen', 'A', 'conteo_intento', 1,
                'nota_final', (v_r->>'grade')::numeric,
                'run_id', p_run));
    END LOOP;
    PERFORM etl_control.seal_hop_publication_batch(p_run, 'FACT_CURSADO', v_i);
    v_ret := etl_control.prepare_hop_fact_retention(p_run);
    PERFORM etl_control.seal_hop_publication_batch(p_run, t.target_code, t.n)
    FROM (VALUES ('DIM_ESTUDIANTE', 0), ('DIM_PROGRAMA', 0), ('DIM_MATERIA', 0),
                 ('DIM_PERIODO_ACADEMICO', 0), ('DIM_ADMISION', 0), ('FACT_ADMISION', 0),
                 ('FACT_RETENCION_DESERCION', v_ret::integer)) AS t(target_code, n);
    v_token := (etl_control.acquire_hop_publication_lock(p_run, 300)).lock_token;
    PERFORM etl_control.begin_hop_publication(p_run, v_token, 'Fixture rendimiento');
    PERFORM etl_control.publish_hop_staged_run(p_run, v_token, 'Fixture rendimiento publicada');
    PERFORM etl_control.mature_hop_retention_labels(p_run);
END;
$$;
GRANT EXECUTE ON FUNCTION etl_control.t0046_publish(UUID, JSONB) TO dw_hop_runtime;

CREATE FUNCTION etl_control.t0046_values(p_periodo SMALLINT)
RETURNS TEXT LANGUAGE sql AS $$
    SELECT string_agg((f.estudiante_sk - 952000000) || ':' || coalesce(f.ppa_acumulado::text, 'null')
                      || ':' || coalesce(f.materias_arrastradas::text, 'null'), ',' ORDER BY f.estudiante_sk)
    FROM dw.fact_retencion_desercion f
    JOIN etl_control.academic_period_closure c ON c.closure_id = f.closure_id
    WHERE c.gestion = 2097 AND c.periodo = p_periodo;
$$;

-- C1: s1 fails A (40) and passes B (70); s2 has only an unknown grade (0).
SELECT etl_control.create_hop_etl_execution('a4600000-0000-0000-0000-000000000001'::uuid, 'CIERRE_ACADEMICO'::varchar(24),
    (SELECT closure_id FROM etl_control.academic_period_closure WHERE gestion = 2097 AND periodo = 1),
    NULL, NULL, NULL, NULL, 'Rendimiento C1');
SET LOCAL ROLE dw_hop_runtime;
SELECT etl_control.t0046_publish('a4600000-0000-0000-0000-000000000001'::uuid, '[
    {"student": 1, "subject": 1, "period": 1, "grade": 40},
    {"student": 1, "subject": 2, "period": 1, "grade": 70},
    {"student": 2, "subject": 1, "period": 1, "grade": 0}]'::jsonb);
RESET ROLE;
DO $$
BEGIN
    IF etl_control.t0046_values(1::smallint) IS DISTINCT FROM '1:55.00:1,2:null:null' THEN
        RAISE EXCEPTION 'C1 performance is %', etl_control.t0046_values(1::smallint);
    END IF;
END;
$$;

-- C2: s1 passes A (60). C2 is cumulative; C1 must not change (point in time).
SELECT etl_control.create_hop_etl_execution('a4600000-0000-0000-0000-000000000002'::uuid, 'CIERRE_ACADEMICO'::varchar(24),
    (SELECT closure_id FROM etl_control.academic_period_closure WHERE gestion = 2097 AND periodo = 2),
    NULL, NULL, NULL, NULL, 'Rendimiento C2');
SET LOCAL ROLE dw_hop_runtime;
SELECT etl_control.t0046_publish('a4600000-0000-0000-0000-000000000002'::uuid, '[
    {"student": 1, "subject": 1, "period": 2, "grade": 60}]'::jsonb);
RESET ROLE;
DO $$
BEGIN
    IF etl_control.t0046_values(2::smallint) IS DISTINCT FROM '1:56.67:0' THEN
        RAISE EXCEPTION 'C2 performance is %', etl_control.t0046_values(2::smallint);
    END IF;
    IF etl_control.t0046_values(1::smallint) IS DISTINCT FROM '1:55.00:1,2:null:null' THEN
        RAISE EXCEPTION 'C1 changed after C2: %', etl_control.t0046_values(1::smallint);
    END IF;
    IF etl_control.refresh_hop_retention_performance(ARRAY(
           SELECT closure_id FROM etl_control.academic_period_closure WHERE gestion = 2097)) <> 0 THEN
        RAISE EXCEPTION 'Recompute must be stable';
    END IF;
    IF has_function_privilege('dw_hop_runtime', 'etl_control.refresh_hop_retention_performance(bigint[])', 'EXECUTE') THEN
        RAISE EXCEPTION 'The runtime role must not recompute arbitrary closures';
    END IF;
END;
$$;

ROLLBACK;
