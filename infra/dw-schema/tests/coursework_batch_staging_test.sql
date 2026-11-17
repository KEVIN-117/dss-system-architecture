-- Regression for 0039: set-based FACT_CURSADO staging produces exactly the
-- records of the per-row API and keeps its rejections. All writes roll back.
BEGIN;

INSERT INTO etl_control.academic_period_closure (
    gestion, periodo, created_by_subject, closure_reason
) VALUES (2096, 91, 'dsa:test', 'Prueba staging de cursado por lotes')
ON CONFLICT (gestion, periodo) DO NOTHING;

SELECT etl_control.transition_academic_period_closure(
    2096::smallint, 91::smallint, 'CERRADO'::varchar(16), 'dsa:test'::varchar(255),
    'Cierre de prueba para cursado por lotes', clock_timestamp() - interval '1 minute'
);

SELECT etl_control.create_hop_etl_execution(
    'a3900000-0000-0000-0000-000000000001'::uuid,
    'CIERRE_ACADEMICO'::varchar(24),
    (SELECT closure_id FROM etl_control.academic_period_closure
     WHERE gestion = 2096 AND periodo = 91),
    NULL, NULL, NULL, NULL, 'Prueba de cursado por lotes'
);
SELECT etl_control.start_hop_etl_execution(
    'a3900000-0000-0000-0000-000000000001'::uuid, 'Inicio prueba de cursado por lotes'
);

SET LOCAL ROLE dw_hop_runtime;

DO $$
DECLARE
    c_run CONSTANT UUID := 'a3900000-0000-0000-0000-000000000001';
    v_effective DATE;
    v_staged BIGINT;
    v_failed BOOLEAN;
BEGIN
    SELECT c.effective_at::date INTO v_effective
    FROM etl_control.academic_period_closure c WHERE c.gestion = 2096 AND c.periodo = 91;

    PERFORM etl_control.stage_hop_publication_row(
        c_run, 'DIM_PROGRAMA'::varchar(40), 1, 'UPSERT'::varchar(12), 'TSB',
        jsonb_build_object('programa_sk', etl_control.resolve_hop_dimension_key('programa', 'TSB'),
                           'member_type', 'STANDARD', 'id_programa', 'TSB', 'programa', 'Prueba'));
    PERFORM etl_control.stage_hop_publication_row(
        c_run, 'DIM_MATERIA'::varchar(40), 1, 'UPSERT'::varchar(12), '977',
        jsonb_build_object('materia_sk', etl_control.resolve_hop_dimension_key('materia', '977'),
                           'member_type', 'STANDARD', 'id_materia', 977));
    PERFORM etl_control.stage_hop_publication_row(
        c_run, 'DIM_PERIODO_ACADEMICO'::varchar(40), 1, 'UPSERT'::varchar(12), '2096-91',
        jsonb_build_object('periodo_academico_sk', etl_control.resolve_hop_dimension_key('periodo_academico', '2096-91'),
                           'member_type', 'STANDARD', 'gestion', 2096, 'periodo', 91));
    PERFORM etl_control.prepare_hop_student_scd2(c_run, jsonb_build_object(
        'id_alumno', 940000001, 'id_ra', 'RA39A', 'fec_inscripcion', v_effective - 30,
        'estado_academico', 'A', 'tipo_alumno', 'N', '_demographic_match', true));
    PERFORM etl_control.prepare_hop_student_scd2(c_run, jsonb_build_object(
        'id_alumno', 940000002, 'id_ra', 'RA39A', 'fec_inscripcion', v_effective - 30,
        'estado_academico', 'A', 'tipo_alumno', 'N', '_demographic_match', true));

    -- Reference rows through the per-row API (ordinals 1-2).
    PERFORM etl_control.stage_hop_fact_coursework(c_run, 1, jsonb_build_object(
        'id_matricula', 1, 'id_gestion', 2096, 'id_periodo', 91, 'id_alumno', 940000001,
        'id_ra', 'RA39A', 'id_programa', 'TSB', 'id_materia', 977, 'grupo', 2,
        'nota', 71.5, 'pparcial', 60, 'sparcial', 80, 'estado', 'A'));
    PERFORM etl_control.stage_hop_fact_coursework(c_run, 2, jsonb_build_object(
        'id_matricula', 2, 'id_gestion', 2096, 'id_periodo', 91, 'id_alumno', 940000002,
        'id_ra', 'RA39A', 'id_programa', 'TSB', 'id_materia', 977,
        'nota', 0, 'nota_2da', 100, 'estado', 'x'));

    -- Same rows through the batch API (ordinals 3-4).
    v_staged := etl_control.stage_hop_fact_coursework_batch(c_run, jsonb_build_array(
        jsonb_build_object('row_ordinal', 3, 'source_data', jsonb_build_object(
            'id_matricula', 3, 'id_gestion', 2096, 'id_periodo', 91, 'id_alumno', 940000001,
            'id_ra', 'RA39A', 'id_programa', 'TSB', 'id_materia', 977, 'grupo', 2,
            'nota', 71.5, 'pparcial', 60, 'sparcial', 80, 'estado', 'A')),
        jsonb_build_object('row_ordinal', 4, 'source_data', jsonb_build_object(
            'id_matricula', 4, 'id_gestion', 2096, 'id_periodo', 91, 'id_alumno', 940000002,
            'id_ra', 'RA39A', 'id_programa', 'TSB', 'id_materia', 977,
            'nota', 0, 'nota_2da', 100, 'estado', 'x'))));
    IF v_staged <> 2 THEN
        RAISE EXCEPTION 'Batch staging returned %, expected 2', v_staged;
    END IF;

    -- Rejections keep the per-row semantics; a failed batch stages nothing.
    v_failed := FALSE;
    BEGIN
        PERFORM etl_control.stage_hop_fact_coursework_batch(c_run, jsonb_build_array(
            jsonb_build_object('row_ordinal', 5, 'source_data', jsonb_build_object(
                'id_matricula', 5, 'id_gestion', 2096, 'id_periodo', 91, 'id_alumno', 940000001,
                'id_programa', 'TSB', 'id_materia', 977, 'nota', 50, 'estado', 'A')),
            jsonb_build_object('row_ordinal', 6, 'source_data', jsonb_build_object(
                'id_matricula', 6, 'id_gestion', 2096, 'id_periodo', 91, 'id_alumno', 940000001,
                'id_programa', 'TSB', 'id_materia', 977, 'nota', 100.5, 'estado', 'A'))));
    EXCEPTION WHEN check_violation THEN
        v_failed := TRUE;
    END;
    IF NOT v_failed THEN
        RAISE EXCEPTION 'Out-of-range grade must reject the batch';
    END IF;

    v_failed := FALSE;
    BEGIN
        PERFORM etl_control.stage_hop_fact_coursework_batch(c_run, jsonb_build_array(
            jsonb_build_object('row_ordinal', 7, 'source_data', jsonb_build_object(
                'id_matricula', 7, 'id_gestion', 2096, 'id_periodo', 91, 'id_alumno', 940000099,
                'id_programa', 'TSB', 'id_materia', 977, 'estado', 'A'))));
    EXCEPTION WHEN check_violation THEN
        v_failed := TRUE;
    END;
    IF NOT v_failed THEN
        RAISE EXCEPTION 'Student without a valid SCD2 version must reject the batch';
    END IF;

    v_failed := FALSE;
    BEGIN
        PERFORM etl_control.stage_hop_fact_coursework_batch(c_run, jsonb_build_array(
            jsonb_build_object('row_ordinal', 8, 'source_data', jsonb_build_object(
                'id_matricula', 8, 'id_gestion', 2095, 'id_periodo', 91, 'id_alumno', 940000001,
                'id_programa', 'TSB', 'id_materia', 977, 'estado', 'A'))));
    EXCEPTION WHEN check_violation THEN
        v_failed := TRUE;
    END;
    IF NOT v_failed THEN
        RAISE EXCEPTION 'Row outside the closure grain must reject the batch';
    END IF;
END;
$$;

RESET ROLE;

DO $$
DECLARE
    c_run CONSTANT UUID := 'a3900000-0000-0000-0000-000000000001';
    v_rows BIGINT;
    v_diff BIGINT;
BEGIN
    SELECT count(*) INTO v_rows FROM etl_work.hop_publication_row
    WHERE run_id = c_run AND target_code = 'FACT_CURSADO';
    IF v_rows <> 4 THEN
        RAISE EXCEPTION 'Expected 4 staged FACT_CURSADO rows (rejected batches stage nothing), found %', v_rows;
    END IF;

    SELECT count(*) INTO v_diff
    FROM etl_work.hop_publication_row a
    JOIN etl_work.hop_publication_row b
      ON b.run_id = a.run_id AND b.target_code = a.target_code AND b.row_ordinal = a.row_ordinal + 2
    WHERE a.run_id = c_run AND a.target_code = 'FACT_CURSADO' AND a.row_ordinal IN (1, 2)
      AND (a.record_data - 'id_matricula_origen') IS DISTINCT FROM (b.record_data - 'id_matricula_origen');
    IF v_diff <> 0 THEN
        RAISE EXCEPTION 'Batch records differ from per-row records in % rows', v_diff;
    END IF;
    IF (SELECT count(*) FROM etl_work.hop_publication_row
        WHERE run_id = c_run AND target_code = 'FACT_CURSADO'
          AND natural_key = (record_data->>'id_matricula_origen')
          AND operation = 'INSERT') <> 4 THEN
        RAISE EXCEPTION 'Batch rows must keep id_matricula as natural key and INSERT operation';
    END IF;
END;
$$;

ROLLBACK;
