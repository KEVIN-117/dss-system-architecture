-- Regression for 0045: the retention successor follows the program regime.
-- Annual programs (alm_programas.tipo = 'A') continue in next-year period 1;
-- semester programs keep 1 -> 2 -> next-year 1. Three real publications
-- (2095-1, 2095-2, 2096-1); everything is rolled back.
BEGIN;

-- Cadence rule.
DO $$
BEGIN
    IF (SELECT row(gestion, periodo)::text FROM etl_control.hop_retention_successor(2095::smallint, 1::smallint, 'A'))
           IS DISTINCT FROM '(2096,1)'
       OR (SELECT row(gestion, periodo)::text FROM etl_control.hop_retention_successor(2095::smallint, 1::smallint, 'S'))
           IS DISTINCT FROM '(2095,2)'
       OR (SELECT row(gestion, periodo)::text FROM etl_control.hop_retention_successor(2095::smallint, 2::smallint, 'S'))
           IS DISTINCT FROM '(2096,1)'
       OR (SELECT gestion FROM etl_control.hop_retention_successor(2095::smallint, 2::smallint, 'A')) IS NOT NULL
       OR (SELECT gestion FROM etl_control.hop_retention_successor(2095::smallint, 1::smallint, NULL)) IS NOT NULL
       OR (SELECT row(gestion, periodo)::text FROM etl_control.hop_retention_successor(2095::smallint, 3::smallint, NULL))
           IS DISTINCT FROM '(2096,3)' THEN
        RAISE EXCEPTION 'Unexpected regime cadence';
    END IF;
END;
$$;

INSERT INTO etl_control.academic_period_closure (gestion, periodo, created_by_subject, closure_reason)
VALUES (2095, 1, 'dsa:test', 'Régimen P1'), (2095, 2, 'dsa:test', 'Régimen P2'), (2096, 1, 'dsa:test', 'Régimen P3')
ON CONFLICT (gestion, periodo) DO NOTHING;
SELECT etl_control.transition_academic_period_closure(2095::smallint, 1::smallint, 'CERRADO'::varchar(16),
    'dsa:test'::varchar(255), 'Cierre P1', clock_timestamp() - interval '3 minutes');
SELECT etl_control.transition_academic_period_closure(2095::smallint, 2::smallint, 'CERRADO'::varchar(16),
    'dsa:test'::varchar(255), 'Cierre P2', clock_timestamp() - interval '2 minutes');
SELECT etl_control.transition_academic_period_closure(2096::smallint, 1::smallint, 'CERRADO'::varchar(16),
    'dsa:test'::varchar(255), 'Cierre P3', clock_timestamp() - interval '1 minute');

-- Published dimensions. Program 1 is annual, program 2 is semester.
INSERT INTO dw.dim_programa (programa_sk, member_type, id_programa, programa, regimen)
VALUES (951000001, 'STANDARD', 'RA1', 'Programa anual', 'A'),
       (951000002, 'STANDARD', 'RS1', 'Programa semestral', 'S');
INSERT INTO dw.dim_materia (materia_sk, member_type, id_materia, sigla, materia)
VALUES (951000001, 'STANDARD', 951001, 'MAT951', 'Materia régimen');
INSERT INTO dw.dim_periodo_academico (periodo_academico_sk, member_type, closure_id, gestion, periodo, effective_at)
SELECT 951000000 + (c.gestion - 2095) * 10 + c.periodo, 'STANDARD', c.closure_id, c.gestion, c.periodo, c.effective_at
FROM etl_control.academic_period_closure c WHERE (c.gestion, c.periodo) IN ((2095, 1), (2095, 2), (2096, 1));
INSERT INTO dw.dim_estudiante (
    estudiante_sk, member_type, id_ra, id_alumno, fec_inscripcion, fec_egreso,
    estado_academico, tipo_alumno, valid_from, valid_to, is_current, attribute_hash_scd2
)
SELECT 951000000 + g, 'STANDARD', NULL, 951000000 + g, DATE '2000-01-01', NULL,
       'A', 'R', TIMESTAMPTZ '2000-01-01 00:00:00+00', NULL, TRUE, repeat('e', 64)
FROM generate_series(1, 4) AS g;

-- Test-only helper (rolled back): stages coursework, prepares retention and
-- publishes the run. p_rows: [{student, program, period_sk, partials}].
CREATE FUNCTION etl_control.t0045_publish(p_run UUID, p_rows JSONB)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
    v_i INTEGER := 0;
    v_r JSONB;
    v_ret BIGINT;
    v_token UUID;
BEGIN
    PERFORM etl_control.start_hop_etl_execution(p_run, 'Inicio régimen');
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
            (v_r->>'period_sk') || ':' || (v_r->>'student'),
            jsonb_build_object('estudiante_sk', 951000000 + (v_r->>'student')::int,
                'programa_sk', 951000000 + (v_r->>'program')::int,
                'materia_sk', 951000001, 'periodo_academico_sk', (v_r->>'period_sk')::bigint,
                'id_matricula_origen', ((v_r->>'period_sk')::bigint - 951000000) * 100 + 9510000 + v_i, 'estado_origen', 'A', 'conteo_intento', 1,
                'nota_parcial_1', CASE WHEN (v_r->>'partials')::int >= 1 THEN 40 END,
                'nota_parcial_2', CASE WHEN (v_r->>'partials')::int >= 2 THEN 45 END,
                'nota_parcial_3', CASE WHEN (v_r->>'partials')::int >= 3 THEN 50 END,
                'run_id', p_run));
    END LOOP;
    PERFORM etl_control.seal_hop_publication_batch(p_run, 'FACT_CURSADO', v_i);
    v_ret := etl_control.prepare_hop_fact_retention(p_run);
    PERFORM etl_control.seal_hop_publication_batch(p_run, t.target_code, t.n)
    FROM (VALUES ('DIM_ESTUDIANTE', 0), ('DIM_PROGRAMA', 0), ('DIM_MATERIA', 0),
                 ('DIM_PERIODO_ACADEMICO', 0), ('DIM_ADMISION', 0), ('FACT_ADMISION', 0),
                 ('FACT_RETENCION_DESERCION', v_ret::integer)) AS t(target_code, n);
    v_token := (etl_control.acquire_hop_publication_lock(p_run, 300)).lock_token;
    PERFORM etl_control.begin_hop_publication(p_run, v_token, 'Fixture régimen');
    PERFORM etl_control.publish_hop_staged_run(p_run, v_token, 'Fixture régimen publicada');
END;
$$;
GRANT EXECUTE ON FUNCTION etl_control.t0045_publish(UUID, JSONB) TO dw_hop_runtime;

CREATE FUNCTION etl_control.t0045_labels(p_gestion SMALLINT, p_periodo SMALLINT)
RETURNS TEXT LANGUAGE sql AS $$
    SELECT string_agg((f.estudiante_sk - 951000000) || ':' || f.resultado_retencion, ',' ORDER BY f.estudiante_sk)
    FROM dw.fact_retencion_desercion f
    JOIN etl_control.academic_period_closure c ON c.closure_id = f.closure_id
    WHERE c.gestion = p_gestion AND c.periodo = p_periodo;
$$;

-- P1 = 2095-1: s1, s2, s4 annual; s3 semester.
SELECT etl_control.create_hop_etl_execution('a4500000-0000-0000-0000-000000000001'::uuid, 'CIERRE_ACADEMICO'::varchar(24),
    (SELECT closure_id FROM etl_control.academic_period_closure WHERE gestion = 2095 AND periodo = 1),
    NULL, NULL, NULL, NULL, 'Régimen P1');
SET LOCAL ROLE dw_hop_runtime;
SELECT etl_control.t0045_publish('a4500000-0000-0000-0000-000000000001'::uuid, '[
    {"student": 1, "program": 1, "period_sk": 951000001, "partials": 3},
    {"student": 2, "program": 1, "period_sk": 951000001, "partials": 0},
    {"student": 3, "program": 2, "period_sk": 951000001, "partials": 2},
    {"student": 4, "program": 1, "period_sk": 951000001, "partials": 3}]'::jsonb);
DO $$
BEGIN
    IF etl_control.mature_hop_retention_labels('a4500000-0000-0000-0000-000000000001'::uuid) <> 0 THEN
        RAISE EXCEPTION 'P1 has no processed predecessor';
    END IF;
END;
$$;
RESET ROLE;

-- P2 = 2095-2: only s3 (semester) continues. Annual rows must stay unlabeled.
SELECT etl_control.create_hop_etl_execution('a4500000-0000-0000-0000-000000000002'::uuid, 'CIERRE_ACADEMICO'::varchar(24),
    (SELECT closure_id FROM etl_control.academic_period_closure WHERE gestion = 2095 AND periodo = 2),
    NULL, NULL, NULL, NULL, 'Régimen P2');
SET LOCAL ROLE dw_hop_runtime;
SELECT etl_control.t0045_publish('a4500000-0000-0000-0000-000000000002'::uuid, '[
    {"student": 3, "program": 2, "period_sk": 951000002, "partials": 0}]'::jsonb);
DO $$
DECLARE
    v_matured BIGINT;
BEGIN
    v_matured := etl_control.mature_hop_retention_labels('a4500000-0000-0000-0000-000000000002'::uuid);
    IF v_matured <> 1 THEN
        RAISE EXCEPTION 'P2 must mature only the semester row of P1, got %', v_matured;
    END IF;
END;
$$;
RESET ROLE;
DO $$
BEGIN
    IF etl_control.t0045_labels(2095::smallint, 1::smallint)
           IS DISTINCT FROM '1:NO_EVALUABLE,2:NO_EVALUABLE,3:RETENIDO,4:NO_EVALUABLE' THEN
        RAISE EXCEPTION 'After P2, P1 labels are %', etl_control.t0045_labels(2095::smallint, 1::smallint);
    END IF;
END;
$$;

-- P3 = 2096-1: s1 (annual) continues; s3 (semester) does not.
SELECT etl_control.create_hop_etl_execution('a4500000-0000-0000-0000-000000000003'::uuid, 'CIERRE_ACADEMICO'::varchar(24),
    (SELECT closure_id FROM etl_control.academic_period_closure WHERE gestion = 2096 AND periodo = 1),
    NULL, NULL, NULL, NULL, 'Régimen P3');
SET LOCAL ROLE dw_hop_runtime;
SELECT etl_control.t0045_publish('a4500000-0000-0000-0000-000000000003'::uuid, '[
    {"student": 1, "program": 1, "period_sk": 951000011, "partials": 1}]'::jsonb);
DO $$
DECLARE
    v_matured BIGINT;
BEGIN
    v_matured := etl_control.mature_hop_retention_labels('a4500000-0000-0000-0000-000000000003'::uuid);
    -- P1: s1 RETENIDO, s2 DESERTOR (s4 stays NO_EVALUABLE: 3 partials); P2: s3 DESERTOR.
    IF v_matured <> 3 THEN
        RAISE EXCEPTION 'P3 must mature 3 rows (2 annual of P1, 1 semester of P2), got %', v_matured;
    END IF;
    IF etl_control.mature_hop_retention_labels('a4500000-0000-0000-0000-000000000003'::uuid) <> 0 THEN
        RAISE EXCEPTION 'Maturation must be idempotent';
    END IF;
END;
$$;
RESET ROLE;

DO $$
BEGIN
    IF etl_control.t0045_labels(2095::smallint, 1::smallint)
           IS DISTINCT FROM '1:RETENIDO,2:DESERTOR,3:RETENIDO,4:NO_EVALUABLE' THEN
        RAISE EXCEPTION 'Final P1 labels are %', etl_control.t0045_labels(2095::smallint, 1::smallint);
    END IF;
    IF etl_control.t0045_labels(2095::smallint, 2::smallint) IS DISTINCT FROM '3:DESERTOR' THEN
        RAISE EXCEPTION 'Final P2 labels are %', etl_control.t0045_labels(2095::smallint, 2::smallint);
    END IF;
    -- Full recompute (backfill path) is stable.
    IF etl_control.relabel_hop_retention_closures(ARRAY(
           SELECT closure_id FROM etl_control.academic_period_closure
           WHERE (gestion, periodo) IN ((2095, 1), (2095, 2), (2096, 1)))) <> 0 THEN
        RAISE EXCEPTION 'Recompute of matured closures must not change labels';
    END IF;
    -- Unknown regime gives no label.
    UPDATE dw.dim_programa SET regimen = NULL WHERE programa_sk = 951000002;
    IF etl_control.relabel_hop_retention_closures(ARRAY(
           SELECT closure_id FROM etl_control.academic_period_closure WHERE (gestion, periodo) = (2095, 1))) <> 1
       OR etl_control.t0045_labels(2095::smallint, 1::smallint)
           IS DISTINCT FROM '1:RETENIDO,2:DESERTOR,3:NO_EVALUABLE,4:NO_EVALUABLE' THEN
        RAISE EXCEPTION 'Unknown regime must yield NO_EVALUABLE, got %', etl_control.t0045_labels(2095::smallint, 1::smallint);
    END IF;
    IF has_function_privilege('dw_hop_runtime', 'etl_control.relabel_hop_retention_closures(bigint[])', 'EXECUTE') THEN
        RAISE EXCEPTION 'The runtime role must not relabel arbitrary closures';
    END IF;
END;
$$;

ROLLBACK;
