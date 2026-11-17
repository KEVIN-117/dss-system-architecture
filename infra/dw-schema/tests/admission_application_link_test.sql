-- Regressions for 0037 (indexed SCD2 overlap guard) and 0038 (FACT_ADMISION
-- resolves the academic student through alumnos.id_postulante). All writes
-- are rolled back.
BEGIN;

-- 0037: the overlap guard predicate must be served by an index, otherwise a
-- real snapshot publication is quadratic in the number of students.
DO $$
DECLARE
    v_plan TEXT;
BEGIN
    IF to_regclass('dw.idx_dim_estudiante_id_alumno_validity') IS NULL THEN
        RAISE EXCEPTION 'Missing dw.idx_dim_estudiante_id_alumno_validity';
    END IF;
    SET LOCAL enable_seqscan = off;
    EXECUTE $q$
        EXPLAIN (FORMAT TEXT)
        SELECT 1 FROM dw.dim_estudiante AS existing
        WHERE existing.member_type = 'STANDARD'
          AND existing.id_alumno = 42
          AND existing.estudiante_sk <> 0
          AND existing.valid_from < 'infinity'::timestamptz
          AND TIMESTAMPTZ '2020-01-01' < coalesce(existing.valid_to, 'infinity'::timestamptz)
    $q$ INTO v_plan;
    IF v_plan NOT LIKE '%idx_dim_estudiante_id_alumno_validity%' THEN
        RAISE EXCEPTION 'SCD2 overlap guard does not use the id_alumno validity index: %', v_plan;
    END IF;
    RESET enable_seqscan;
END;
$$;

INSERT INTO etl_control.academic_period_closure (
    gestion, periodo, created_by_subject, closure_reason
) VALUES (2097, 91, 'dsa:test', 'Prueba vínculo de admisión')
ON CONFLICT (gestion, periodo) DO NOTHING;

SELECT etl_control.transition_academic_period_closure(
    2097::smallint, 91::smallint, 'CERRADO'::varchar(16), 'dsa:test'::varchar(255),
    'Cierre de prueba para vínculo de admisión', clock_timestamp() - interval '1 minute'
);

SELECT etl_control.create_hop_etl_execution(
    'a3800000-0000-0000-0000-000000000001'::uuid,
    'CIERRE_ACADEMICO'::varchar(24),
    (SELECT closure_id FROM etl_control.academic_period_closure
     WHERE gestion = 2097 AND periodo = 91),
    NULL, NULL, NULL, NULL, 'Prueba de vínculo alumnos.id_postulante'
);
SELECT etl_control.start_hop_etl_execution(
    'a3800000-0000-0000-0000-000000000001'::uuid, 'Inicio prueba de admisión'
);

SET LOCAL ROLE dw_hop_runtime;

-- Staging runs with the Hop runtime privileges only.
DO $$
DECLARE
    c_run CONSTANT UUID := 'a3800000-0000-0000-0000-000000000001';
    v_effective DATE;
    v_failed BOOLEAN;
BEGIN
    SELECT c.effective_at::date INTO v_effective
    FROM etl_control.academic_period_closure c
    WHERE c.gestion = 2097 AND c.periodo = 91;

    -- Dimensions referenced by the fact, prepared in this run.
    PERFORM etl_control.stage_hop_publication_row(
        c_run, 'DIM_PROGRAMA'::varchar(40), 1, 'UPSERT'::varchar(12), 'TST',
        jsonb_build_object('programa_sk', etl_control.resolve_hop_dimension_key('programa', 'TST'),
                           'member_type', 'STANDARD', 'id_programa', 'TST', 'programa', 'Prueba'));
    PERFORM etl_control.stage_hop_publication_row(
        c_run, 'DIM_PERIODO_ACADEMICO'::varchar(40), 1, 'UPSERT'::varchar(12), '2097-91',
        jsonb_build_object('periodo_academico_sk', etl_control.resolve_hop_dimension_key('periodo_academico', '2097-91'),
                           'member_type', 'STANDARD', 'gestion', 2097, 'periodo', 91));

    -- Academic student 930000001 enrolled before the closure, and a different
    -- student sharing its RA that must not influence admission.
    PERFORM etl_control.prepare_hop_student_scd2(c_run, jsonb_build_object(
        'id_alumno', 930000001, 'id_ra', 'SHARED38', 'fec_inscripcion', v_effective - 30,
        'estado_academico', 'A', 'tipo_alumno', 'N', '_demographic_match', true));
    PERFORM etl_control.prepare_hop_student_scd2(c_run, jsonb_build_object(
        'id_alumno', 930000002, 'id_ra', 'SHARED38', 'fec_inscripcion', v_effective - 10,
        'estado_academico', 'A', 'tipo_alumno', 'N', '_demographic_match', true));

    -- 1. Linked application (two links; Hop chose the earliest).
    PERFORM etl_control.stage_hop_fact_admission(c_run, 1, jsonb_build_object(
        'id_alumno', 930000001, 'id_alumno_postulante', 5001, 'alumno_link_count', 2,
        'alumno_fec_inscripcion', v_effective - 30, 'id_ra', 'SHARED38',
        'id_programa', 'TST', 'id_gestion', 2097, 'id_periodo', 91, 'estado', 'A'));
    -- 2. Application without an academic student.
    PERFORM etl_control.stage_hop_fact_admission(c_run, 2, jsonb_build_object(
        'id_alumno', NULL, 'id_alumno_postulante', 5002, 'alumno_link_count', 0,
        'id_ra', 'SHARED38', 'id_programa', 'TST', 'id_gestion', 2097, 'id_periodo', 91, 'estado', 'P'));
    -- 3. Student enrolled after the closure (not in this SCD2 snapshot).
    PERFORM etl_control.stage_hop_fact_admission(c_run, 3, jsonb_build_object(
        'id_alumno', 930000003, 'id_alumno_postulante', 5003, 'alumno_link_count', 1,
        'alumno_fec_inscripcion', v_effective + 60, 'id_programa', 'TST',
        'id_gestion', 2097, 'id_periodo', 91, 'estado', 'A'));

    -- 4. The 0028 payload (RA match count, no link) fails closed.
    v_failed := FALSE;
    BEGIN
        PERFORM etl_control.stage_hop_fact_admission(c_run, 4, jsonb_build_object(
            'id_alumno', 930000001, 'id_alumno_postulante', 5004, 'alumno_ra_match_count', 1,
            'id_programa', 'TST', 'id_gestion', 2097, 'id_periodo', 91));
    EXCEPTION WHEN check_violation THEN
        v_failed := TRUE;
    END;
    IF NOT v_failed THEN
        RAISE EXCEPTION 'Legacy RA payload must be rejected';
    END IF;

    -- 5. Inconsistent link cardinality fails closed.
    v_failed := FALSE;
    BEGIN
        PERFORM etl_control.stage_hop_fact_admission(c_run, 5, jsonb_build_object(
            'id_alumno', NULL, 'id_alumno_postulante', 5005, 'alumno_link_count', 1,
            'id_programa', 'TST', 'id_gestion', 2097, 'id_periodo', 91));
    EXCEPTION WHEN check_violation THEN
        v_failed := TRUE;
    END;
    IF NOT v_failed THEN
        RAISE EXCEPTION 'Link count without id_alumno must be rejected';
    END IF;
END;
$$;

RESET ROLE;

-- Assertions over the private staging area.
DO $$
DECLARE
    c_run CONSTANT UUID := 'a3800000-0000-0000-0000-000000000001';
    v_student_sk BIGINT;
    v_sk1 BIGINT;
    v_sk2 BIGINT;
    v_sk3 BIGINT;
    v_count BIGINT;
BEGIN
    SELECT (r.record_data->>'estudiante_sk')::bigint INTO STRICT v_student_sk
    FROM etl_work.hop_publication_row r
    WHERE r.run_id = c_run AND r.target_code = 'DIM_ESTUDIANTE'
      AND r.operation = 'INSERT' AND (r.record_data->>'id_alumno')::integer = 930000001;

    SELECT max((record_data->>'estudiante_sk')::bigint) FILTER (WHERE row_ordinal = 1),
           max((record_data->>'estudiante_sk')::bigint) FILTER (WHERE row_ordinal = 2),
           max((record_data->>'estudiante_sk')::bigint) FILTER (WHERE row_ordinal = 3),
           count(*)
      INTO v_sk1, v_sk2, v_sk3, v_count
    FROM etl_work.hop_publication_row
    WHERE run_id = c_run AND target_code = 'FACT_ADMISION';

    IF v_count <> 3 THEN
        RAISE EXCEPTION 'Expected 3 staged admissions, found %', v_count;
    END IF;
    IF v_sk1 IS DISTINCT FROM v_student_sk THEN
        RAISE EXCEPTION 'Linked application resolved to %, expected %', v_sk1, v_student_sk;
    END IF;
    IF v_sk2 <> -1 THEN
        RAISE EXCEPTION 'Unlinked application must use UNKNOWN, got %', v_sk2;
    END IF;
    IF v_sk3 <> -1 THEN
        RAISE EXCEPTION 'Student enrolled after the closure must use UNKNOWN, got %', v_sk3;
    END IF;
END;
$$;

ROLLBACK;
