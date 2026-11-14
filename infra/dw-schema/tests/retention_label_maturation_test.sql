-- Regression for 0040: retention labels mature when the cadence successor is
-- published, and alumnos.fec_egreso is no longer egress evidence.
-- Synthetic rows only; the entire test is rolled back.
BEGIN;

DO $$
BEGIN
    IF position('0040: alumnos.fec_egreso is not university egress evidence' IN
                pg_get_functiondef('etl_control.prepare_hop_fact_retention(uuid)'::regprocedure)) = 0
       OR position('s.fec_egreso <= v_closure.effective_at' IN
                pg_get_functiondef('etl_control.prepare_hop_fact_retention(uuid)'::regprocedure)) > 0 THEN
        RAISE EXCEPTION 'prepare_hop_fact_retention still uses fec_egreso as egress evidence';
    END IF;
END;
$$;

-- Closures: predecessor P = 2094-1, successor C = 2094-2.
INSERT INTO etl_control.academic_period_closure (gestion, periodo, created_by_subject, closure_reason)
VALUES (2094, 1, 'dsa:test', 'Maduración P'), (2094, 2, 'dsa:test', 'Maduración C')
ON CONFLICT (gestion, periodo) DO NOTHING;
SELECT etl_control.transition_academic_period_closure(2094::smallint, 1::smallint, 'CERRADO'::varchar(16),
    'dsa:test'::varchar(255), 'Cierre P', clock_timestamp() - interval '2 minutes');
SELECT etl_control.transition_academic_period_closure(2094::smallint, 2::smallint, 'CERRADO'::varchar(16),
    'dsa:test'::varchar(255), 'Cierre C', clock_timestamp() - interval '1 minute');

-- Published dimensions (fixture, inserted by the test owner).
INSERT INTO dw.dim_programa (programa_sk, member_type, id_programa, programa)
VALUES (950000001, 'STANDARD', 'MT1', 'Programa maduración');
INSERT INTO dw.dim_materia (materia_sk, member_type, id_materia, sigla, materia)
VALUES (950000001, 'STANDARD', 950001, 'MAT950', 'Materia maduración');
INSERT INTO dw.dim_periodo_academico (periodo_academico_sk, member_type, closure_id, gestion, periodo, effective_at)
SELECT 950000000 + c.periodo, 'STANDARD', c.closure_id, c.gestion, c.periodo, c.effective_at
FROM etl_control.academic_period_closure c WHERE c.gestion = 2094;
INSERT INTO dw.dim_estudiante (
    estudiante_sk, member_type, id_ra, id_alumno, fec_inscripcion, fec_egreso,
    estado_academico, tipo_alumno, valid_from, valid_to, is_current, attribute_hash_scd2
)
SELECT 950000000 + g, 'STANDARD', NULL, 950000000 + g, DATE '2000-01-01',
       DATE '1999-12-01',  -- school-style fec_egreso before the closure: must not block labels
       'A', 'R', TIMESTAMPTZ '2000-01-01 00:00:00+00', NULL, TRUE, repeat('f', 64)
FROM generate_series(1, 3) AS g;

SELECT etl_control.create_hop_etl_execution('a4000000-0000-0000-0000-000000000001'::uuid, 'CIERRE_ACADEMICO'::varchar(24),
    (SELECT closure_id FROM etl_control.academic_period_closure WHERE gestion = 2094 AND periodo = 1),
    NULL, NULL, NULL, NULL, 'Publicación P de maduración');

SET LOCAL ROLE dw_hop_runtime;

-- Publishes run p_run with the given coursework/retention rows; other batches empty.
-- (Inline twice: the runtime role cannot use session temp functions.)
DO $$
DECLARE
    c_run CONSTANT UUID := 'a4000000-0000-0000-0000-000000000001';
    v_token UUID;
    v_i INTEGER;
    v_parcials INTEGER[] := ARRAY[2, 0, 3];
BEGIN
    PERFORM etl_control.start_hop_etl_execution(c_run, 'Inicio P');
    FOR v_i IN 1..9 LOOP
        PERFORM etl_control.register_etl_source_manifest(c_run,
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
    PERFORM etl_control.register_etl_execution_step(c_run, s.code::varchar(100), s.phase::varchar(20),
        'EXITOSO'::varchar(16), s.ord::smallint, 'fixture'::text, 'test'::varchar(255), '{}'::jsonb)
    FROM (VALUES ('extract', 'EXTRACCION', 1), ('transform', 'TRANSFORMACION', 2),
                 ('validate', 'VALIDACION', 3)) AS s(code, phase, ord);
    FOR v_i IN 1..3 LOOP
        PERFORM etl_control.stage_hop_publication_row(c_run, 'FACT_CURSADO', v_i, 'INSERT', (9400 + v_i)::text,
            jsonb_build_object('estudiante_sk', 950000000 + v_i, 'programa_sk', 950000001,
                'materia_sk', 950000001, 'periodo_academico_sk', 950000001,
                'id_matricula_origen', 9400 + v_i, 'estado_origen', 'A', 'conteo_intento', 1,
                'nota_parcial_1', CASE WHEN v_parcials[v_i] >= 1 THEN 40 END,
                'nota_parcial_2', CASE WHEN v_parcials[v_i] >= 2 THEN 45 END,
                'nota_parcial_3', CASE WHEN v_parcials[v_i] >= 3 THEN 50 END,
                'run_id', c_run));
        PERFORM etl_control.stage_hop_publication_row(c_run, 'FACT_RETENCION_DESERCION', v_i, 'INSERT',
            'RET:' || v_i,
            jsonb_build_object('estudiante_sk', 950000000 + v_i, 'programa_sk', 950000001,
                'periodo_academico_sk', 950000001,
                'closure_id', (SELECT closure_id FROM etl_control.academic_period_closure WHERE gestion = 2094 AND periodo = 1),
                'materias_cursadas', 1, 'materias_aprobadas', 0, 'materias_reprobadas', 0,
                'resultado_retencion', 'NO_EVALUABLE', 'es_desercion', NULL, 'conteo_snapshot', 1,
                'conteo_evaluable', 0, 'conteo_desercion', 0, 'run_id', c_run));
    END LOOP;
    PERFORM etl_control.seal_hop_publication_batch(c_run, t.target_code, t.n)
    FROM (VALUES ('DIM_ESTUDIANTE', 0), ('DIM_PROGRAMA', 0), ('DIM_MATERIA', 0),
                 ('DIM_PERIODO_ACADEMICO', 0), ('DIM_ADMISION', 0), ('FACT_ADMISION', 0),
                 ('FACT_CURSADO', 3), ('FACT_RETENCION_DESERCION', 3)) AS t(target_code, n);
    v_token := (etl_control.acquire_hop_publication_lock(c_run, 300)).lock_token;
    PERFORM etl_control.begin_hop_publication(c_run, v_token, 'Fixture P');
    PERFORM etl_control.publish_hop_staged_run(c_run, v_token, 'Fixture P publicada');
    -- No predecessor for P: maturation is a no-op.
    IF etl_control.mature_hop_retention_labels(c_run) <> 0 THEN
        RAISE EXCEPTION 'Maturation without a processed predecessor must be a no-op';
    END IF;
END;
$$;

RESET ROLE;
SELECT etl_control.create_hop_etl_execution('a4000000-0000-0000-0000-000000000002'::uuid, 'CIERRE_ACADEMICO'::varchar(24),
    (SELECT closure_id FROM etl_control.academic_period_closure WHERE gestion = 2094 AND periodo = 2),
    NULL, NULL, NULL, NULL, 'Publicación C de maduración');
SET LOCAL ROLE dw_hop_runtime;

DO $$
DECLARE
    c_run CONSTANT UUID := 'a4000000-0000-0000-0000-000000000002';
    v_token UUID;
    v_i INTEGER;
    v_matured BIGINT;
BEGIN
    PERFORM etl_control.start_hop_etl_execution(c_run, 'Inicio C');
    FOR v_i IN 1..9 LOOP
        PERFORM etl_control.register_etl_source_manifest(c_run,
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
    PERFORM etl_control.register_etl_execution_step(c_run, s.code::varchar(100), s.phase::varchar(20),
        'EXITOSO'::varchar(16), s.ord::smallint, 'fixture'::text, 'test'::varchar(255), '{}'::jsonb)
    FROM (VALUES ('extract', 'EXTRACCION', 1), ('transform', 'TRANSFORMACION', 2),
                 ('validate', 'VALIDACION', 3)) AS s(code, phase, ord);
    -- Only student 1 continues into C.
    PERFORM etl_control.stage_hop_publication_row(c_run, 'FACT_CURSADO', 1, 'INSERT', '9501',
        jsonb_build_object('estudiante_sk', 950000001, 'programa_sk', 950000001,
            'materia_sk', 950000001, 'periodo_academico_sk', 950000002,
            'id_matricula_origen', 9501, 'estado_origen', 'A', 'conteo_intento', 1,
            'nota_parcial_1', 60, 'run_id', c_run));
    PERFORM etl_control.seal_hop_publication_batch(c_run, t.target_code, t.n)
    FROM (VALUES ('DIM_ESTUDIANTE', 0), ('DIM_PROGRAMA', 0), ('DIM_MATERIA', 0),
                 ('DIM_PERIODO_ACADEMICO', 0), ('DIM_ADMISION', 0), ('FACT_ADMISION', 0),
                 ('FACT_CURSADO', 1), ('FACT_RETENCION_DESERCION', 0)) AS t(target_code, n);
    v_token := (etl_control.acquire_hop_publication_lock(c_run, 300)).lock_token;
    PERFORM etl_control.begin_hop_publication(c_run, v_token, 'Fixture C');
    PERFORM etl_control.publish_hop_staged_run(c_run, v_token, 'Fixture C publicada');

    v_matured := etl_control.mature_hop_retention_labels(c_run);
    IF v_matured <> 2 THEN
        RAISE EXCEPTION 'Expected 2 matured predecessor labels, got %', v_matured;
    END IF;
    IF etl_control.mature_hop_retention_labels(c_run) <> 0 THEN
        RAISE EXCEPTION 'Maturation must be idempotent';
    END IF;
END;
$$;

RESET ROLE;

DO $$
DECLARE
    v_result TEXT;
BEGIN
    SELECT string_agg(f.estudiante_sk - 950000000 || ':' || f.resultado_retencion || ':' ||
                      coalesce(f.es_desercion::text, 'null') || ':' || f.conteo_evaluable || f.conteo_desercion,
                      ',' ORDER BY f.estudiante_sk)
    INTO v_result
    FROM dw.fact_retencion_desercion f
    JOIN etl_control.academic_period_closure c ON c.closure_id = f.closure_id
    WHERE c.gestion = 2094 AND c.periodo = 1;
    IF v_result IS DISTINCT FROM '1:RETENIDO:false:10,2:DESERTOR:true:11,3:NO_EVALUABLE:null:00' THEN
        RAISE EXCEPTION 'Unexpected matured labels: %', v_result;
    END IF;
END;
$$;

ROLLBACK;
