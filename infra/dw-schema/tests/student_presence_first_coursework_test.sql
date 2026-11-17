-- Regression for 0041: a student with a rewritten (later) fec_inscripcion is
-- present at a closure when their first coursework is at/before it. Rolled back.
BEGIN;

INSERT INTO etl_control.academic_period_closure (gestion, periodo, created_by_subject, closure_reason)
VALUES (2093, 1, 'dsa:test', 'Presencia por cursado')
ON CONFLICT (gestion, periodo) DO NOTHING;
SELECT etl_control.transition_academic_period_closure(2093::smallint, 1::smallint, 'CERRADO'::varchar(16),
    'dsa:test'::varchar(255), 'Cierre presencia', clock_timestamp() - interval '1 minute');
SELECT etl_control.create_hop_etl_execution('a4100000-0000-0000-0000-000000000001'::uuid, 'CIERRE_ACADEMICO'::varchar(24),
    (SELECT closure_id FROM etl_control.academic_period_closure WHERE gestion = 2093 AND periodo = 1),
    NULL, NULL, NULL, NULL, 'Prueba presencia por primer cursado');
SELECT etl_control.start_hop_etl_execution('a4100000-0000-0000-0000-000000000001'::uuid, 'Inicio presencia');

SET LOCAL ROLE dw_hop_runtime;

DO $$
DECLARE
    c_run CONSTANT UUID := 'a4100000-0000-0000-0000-000000000001';
    v_future DATE := (clock_timestamp() + interval '400 days')::date;
    v_staged SMALLINT;
    v_sk BIGINT;
BEGIN
    -- Rewritten enrolment date, coursework before the closure: present.
    v_staged := etl_control.prepare_hop_student_scd2(c_run, jsonb_build_object(
        'id_alumno', 941000001, 'fec_inscripcion', v_future, 'estado_academico', 'A',
        'tipo_alumno', 'N', 'first_coursework_gestion', 2092, 'first_coursework_periodo', 2));
    IF v_staged IS DISTINCT FROM 1::smallint THEN
        RAISE EXCEPTION 'Student with earlier coursework must be staged, got %', v_staged;
    END IF;
    -- Same closure period counts as present.
    v_staged := etl_control.prepare_hop_student_scd2(c_run, jsonb_build_object(
        'id_alumno', 941000002, 'fec_inscripcion', v_future, 'estado_academico', 'A',
        'tipo_alumno', 'N', 'first_coursework_gestion', 2093, 'first_coursework_periodo', 1));
    IF v_staged IS DISTINCT FROM 1::smallint THEN
        RAISE EXCEPTION 'Student with coursework in the closure must be staged, got %', v_staged;
    END IF;
    -- Later enrolment and no earlier coursework: still excluded (0030 rule).
    v_staged := etl_control.prepare_hop_student_scd2(c_run, jsonb_build_object(
        'id_alumno', 941000003, 'fec_inscripcion', v_future, 'estado_academico', 'A',
        'tipo_alumno', 'N', 'first_coursework_gestion', 2093, 'first_coursework_periodo', 2));
    IF v_staged IS DISTINCT FROM 0::smallint THEN
        RAISE EXCEPTION 'Student first seen after the closure must be excluded, got %', v_staged;
    END IF;
    v_staged := etl_control.prepare_hop_student_scd2(c_run, jsonb_build_object(
        'id_alumno', 941000004, 'fec_inscripcion', v_future, 'estado_academico', 'A', 'tipo_alumno', 'N'));
    IF v_staged IS DISTINCT FROM 0::smallint THEN
        RAISE EXCEPTION 'Student without coursework evidence must be excluded, got %', v_staged;
    END IF;

    -- Admission: linked student with rewritten enrolment but earlier coursework
    -- resolves to its SCD2 version instead of UNKNOWN.
    PERFORM etl_control.stage_hop_publication_row(
        c_run, 'DIM_PROGRAMA'::varchar(40), 1, 'UPSERT'::varchar(12), 'TPR',
        jsonb_build_object('programa_sk', etl_control.resolve_hop_dimension_key('programa', 'TPR'),
                           'member_type', 'STANDARD', 'id_programa', 'TPR', 'programa', 'Prueba'));
    PERFORM etl_control.stage_hop_publication_row(
        c_run, 'DIM_PERIODO_ACADEMICO'::varchar(40), 1, 'UPSERT'::varchar(12), '2093-1',
        jsonb_build_object('periodo_academico_sk', etl_control.resolve_hop_dimension_key('periodo_academico', '2093-1'),
                           'member_type', 'STANDARD', 'gestion', 2093, 'periodo', 1));
    PERFORM etl_control.stage_hop_fact_admission(c_run, 1, jsonb_build_object(
        'id_alumno', 941000001, 'id_alumno_postulante', 7001, 'alumno_link_count', 1,
        'alumno_fec_inscripcion', v_future, 'alumno_first_coursework_gestion', 2092,
        'alumno_first_coursework_periodo', 2, 'id_programa', 'TPR',
        'id_gestion', 2093, 'id_periodo', 1, 'estado', 'A'));
    -- Rewritten enrolment and no coursework: UNKNOWN as before.
    PERFORM etl_control.stage_hop_fact_admission(c_run, 2, jsonb_build_object(
        'id_alumno', 941000003, 'id_alumno_postulante', 7002, 'alumno_link_count', 1,
        'alumno_fec_inscripcion', v_future, 'id_programa', 'TPR',
        'id_gestion', 2093, 'id_periodo', 1, 'estado', 'A'));
END;
$$;

RESET ROLE;

DO $$
DECLARE
    c_run CONSTANT UUID := 'a4100000-0000-0000-0000-000000000001';
    v_student_sk BIGINT;
    v_sk1 BIGINT;
    v_sk2 BIGINT;
BEGIN
    SELECT (record_data->>'estudiante_sk')::bigint INTO STRICT v_student_sk
    FROM etl_work.hop_publication_row
    WHERE run_id = c_run AND target_code = 'DIM_ESTUDIANTE' AND operation = 'INSERT'
      AND (record_data->>'id_alumno')::integer = 941000001;
    SELECT max((record_data->>'estudiante_sk')::bigint) FILTER (WHERE row_ordinal = 1),
           max((record_data->>'estudiante_sk')::bigint) FILTER (WHERE row_ordinal = 2)
      INTO v_sk1, v_sk2
    FROM etl_work.hop_publication_row WHERE run_id = c_run AND target_code = 'FACT_ADMISION';
    IF v_sk1 IS DISTINCT FROM v_student_sk THEN
        RAISE EXCEPTION 'Linked student with earlier coursework resolved to %, expected %', v_sk1, v_student_sk;
    END IF;
    IF v_sk2 <> -1 THEN
        RAISE EXCEPTION 'Linked student without presence evidence must be UNKNOWN, got %', v_sk2;
    END IF;
END;
$$;

ROLLBACK;
