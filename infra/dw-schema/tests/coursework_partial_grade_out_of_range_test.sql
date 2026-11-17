-- Regression for 0060: an out-of-range partial grade is staged as NULL and
-- recorded as a non-blocking WARN; an out-of-range final grade still rejects
-- the batch; the strict core function is not executable by the runtime.
-- All writes roll back.
BEGIN;

INSERT INTO etl_control.academic_period_closure (
    gestion, periodo, created_by_subject, closure_reason
) VALUES (2096, 92, 'dsa:test', 'Prueba de nota parcial fuera de rango')
ON CONFLICT (gestion, periodo) DO NOTHING;

SELECT etl_control.transition_academic_period_closure(
    2096::smallint, 92::smallint, 'CERRADO'::varchar(16), 'dsa:test'::varchar(255),
    'Cierre de prueba para nota parcial fuera de rango', clock_timestamp() - interval '1 minute'
);

SELECT etl_control.create_hop_etl_execution(
    'a6000000-0000-0000-0000-000000000001'::uuid,
    'CIERRE_ACADEMICO'::varchar(24),
    (SELECT closure_id FROM etl_control.academic_period_closure
     WHERE gestion = 2096 AND periodo = 92),
    NULL, NULL, NULL, NULL, 'Prueba de nota parcial fuera de rango'
);
SELECT etl_control.start_hop_etl_execution(
    'a6000000-0000-0000-0000-000000000001'::uuid, 'Inicio prueba de nota parcial fuera de rango'
);

SET LOCAL ROLE dw_hop_runtime;

DO $$
DECLARE
    c_run CONSTANT UUID := 'a6000000-0000-0000-0000-000000000001';
    v_effective DATE;
    v_staged BIGINT;
    v_failed BOOLEAN;
BEGIN
    SELECT c.effective_at::date INTO v_effective
    FROM etl_control.academic_period_closure c WHERE c.gestion = 2096 AND c.periodo = 92;

    PERFORM etl_control.stage_hop_publication_row(
        c_run, 'DIM_PROGRAMA'::varchar(40), 1, 'UPSERT'::varchar(12), 'TSP',
        jsonb_build_object('programa_sk', etl_control.resolve_hop_dimension_key('programa', 'TSP'),
                           'member_type', 'STANDARD', 'id_programa', 'TSP', 'programa', 'Prueba'));
    PERFORM etl_control.stage_hop_publication_row(
        c_run, 'DIM_MATERIA'::varchar(40), 1, 'UPSERT'::varchar(12), '978',
        jsonb_build_object('materia_sk', etl_control.resolve_hop_dimension_key('materia', '978'),
                           'member_type', 'STANDARD', 'id_materia', 978));
    PERFORM etl_control.stage_hop_publication_row(
        c_run, 'DIM_PERIODO_ACADEMICO'::varchar(40), 1, 'UPSERT'::varchar(12), '2096-92',
        jsonb_build_object('periodo_academico_sk', etl_control.resolve_hop_dimension_key('periodo_academico', '2096-92'),
                           'member_type', 'STANDARD', 'gestion', 2096, 'periodo', 92));
    PERFORM etl_control.prepare_hop_student_scd2(c_run, jsonb_build_object(
        'id_alumno', 960000001, 'id_ra', 'RA60A', 'fec_inscripcion', v_effective - 30,
        'estado_academico', 'A', 'tipo_alumno', 'N', '_demographic_match', true));

    -- Same shape as Jachasun id_matricula 1919623 (2012-1): tparcial = 600.
    v_staged := etl_control.stage_hop_fact_coursework_batch(c_run, jsonb_build_array(
        jsonb_build_object('row_ordinal', 1, 'source_data', jsonb_build_object(
            'id_matricula', 1, 'id_gestion', 2096, 'id_periodo', 92, 'id_alumno', 960000001,
            'id_programa', 'TSP', 'id_materia', 978, 'nota', 59, 'nota_2da', 0, 'nota_ex_mesa', 0,
            'pparcial', 57, 'sparcial', 58, 'tparcial', 600, 'cparcial', 0, 'estado', 'A')),
        jsonb_build_object('row_ordinal', 2, 'source_data', jsonb_build_object(
            'id_matricula', 2, 'id_gestion', 2096, 'id_periodo', 92, 'id_alumno', 960000001,
            'id_programa', 'TSP', 'id_materia', 978, 'nota', 70, 'pparcial', 100, 'sparcial', -1,
            'estado', 'A'))));
    IF v_staged <> 2 THEN
        RAISE EXCEPTION 'Out-of-range partial grades must not reject the batch (staged %)', v_staged;
    END IF;

    -- A final grade out of range still rejects the whole batch.
    v_failed := FALSE;
    BEGIN
        PERFORM etl_control.stage_hop_fact_coursework_batch(c_run, jsonb_build_array(
            jsonb_build_object('row_ordinal', 3, 'source_data', jsonb_build_object(
                'id_matricula', 3, 'id_gestion', 2096, 'id_periodo', 92, 'id_alumno', 960000001,
                'id_programa', 'TSP', 'id_materia', 978, 'nota', 590, 'tparcial', 600, 'estado', 'A'))));
    EXCEPTION WHEN check_violation THEN
        v_failed := TRUE;
    END;
    IF NOT v_failed THEN
        RAISE EXCEPTION 'Out-of-range final grade must reject the batch';
    END IF;

    v_failed := FALSE;
    BEGIN
        PERFORM etl_control.stage_hop_fact_coursework_batch_core(c_run, '[]'::jsonb);
    EXCEPTION WHEN insufficient_privilege THEN
        v_failed := TRUE;
    END;
    IF NOT v_failed THEN
        RAISE EXCEPTION 'The strict core function must not be executable by dw_hop_runtime';
    END IF;
END;
$$;

RESET ROLE;

DO $$
DECLARE
    c_run CONSTANT UUID := 'a6000000-0000-0000-0000-000000000001';
    v_record JSONB;
BEGIN
    SELECT record_data INTO STRICT v_record FROM etl_work.hop_publication_row
    WHERE run_id = c_run AND target_code = 'FACT_CURSADO' AND natural_key = '1';
    IF v_record->'nota_parcial_3' <> 'null'::jsonb
       OR (v_record->>'nota_final')::numeric <> 59
       OR (v_record->>'nota_parcial_1')::numeric <> 57
       OR (v_record->>'nota_parcial_2')::numeric <> 58
       OR (v_record->>'es_aprobado')::boolean IS DISTINCT FROM TRUE THEN
        RAISE EXCEPTION 'Unexpected staged record for the annulled partial grade: %', v_record;
    END IF;

    SELECT record_data INTO STRICT v_record FROM etl_work.hop_publication_row
    WHERE run_id = c_run AND target_code = 'FACT_CURSADO' AND natural_key = '2';
    IF (v_record->>'nota_parcial_1')::numeric <> 100 OR v_record->'nota_parcial_2' <> 'null'::jsonb THEN
        RAISE EXCEPTION 'Boundary 100 must be kept and -1 annulled: %', v_record;
    END IF;

    IF (SELECT count(*) FROM etl_work.hop_publication_row
        WHERE run_id = c_run AND target_code = 'FACT_CURSADO') <> 2 THEN
        RAISE EXCEPTION 'The rejected batch must stage nothing';
    END IF;

    IF (SELECT count(*) FROM etl_control.etl_execution_error
        WHERE run_id = c_run AND error_code = 'COURSEWORK_PARTIAL_GRADE_OUT_OF_RANGE'
          AND severity = 'WARN' AND NOT is_blocking) <> 2
       OR NOT EXISTS (SELECT 1 FROM etl_control.etl_execution_error
                      WHERE run_id = c_run AND details->>'id_matricula' = '1'
                        AND details->>'field' = 'tparcial' AND details->>'original_value' = '600')
       OR EXISTS (SELECT 1 FROM etl_control.etl_execution_error WHERE run_id = c_run AND is_blocking) THEN
        RAISE EXCEPTION 'Expected two non-blocking WARN records (tparcial 600, sparcial -1) and no blocking errors';
    END IF;
END;
$$;

ROLLBACK;
