-- Regression for 0044: FACT_CURSADO pass/fail and repetition flags.
-- Synthetic rows only; every write is rolled back.
BEGIN;

-- Pass rule: GREATEST(nota, nota_2da, nota_ex_mesa) >= 51 passed, > 0 failed,
-- 0 or no grade unknown.
DO $$
BEGIN
    IF etl_control.coursework_pass_outcome(51, NULL, NULL) IS NOT TRUE
       OR etl_control.coursework_pass_outcome(50.99, NULL, NULL) IS NOT FALSE
       OR etl_control.coursework_pass_outcome(45, 60, NULL) IS NOT TRUE
       OR etl_control.coursework_pass_outcome(0, NULL, 70) IS NOT TRUE
       OR etl_control.coursework_pass_outcome(0, 0, 0) IS NOT NULL
       OR etl_control.coursework_pass_outcome(NULL, NULL, NULL) IS NOT NULL THEN
        RAISE EXCEPTION 'coursework_pass_outcome does not follow the numeric pass rule';
    END IF;
END;
$$;

-- Prior closure with one published attempt of subject 9771 by student 940100001.
INSERT INTO dw.dim_programa (member_type, id_programa, programa)
VALUES ('STANDARD', 'TRP', 'Programa prueba repetición');
INSERT INTO dw.dim_materia (member_type, id_materia, materia)
VALUES ('STANDARD', 9771, 'Materia repetida'), ('STANDARD', 9772, 'Materia nueva');
INSERT INTO dw.dim_estudiante (
    member_type, id_alumno, valid_from, valid_to, is_current, attribute_hash_scd2
) VALUES ('STANDARD', 940100001, clock_timestamp() - interval '400 days', NULL, TRUE, repeat('c', 64));
INSERT INTO dw.dim_periodo_academico (member_type, gestion, periodo, effective_at)
VALUES ('STANDARD', 2097, 1, clock_timestamp() - interval '30 days');

SELECT etl_control.create_hop_etl_execution(
    'a4400000-0000-0000-0000-000000000001'::uuid, 'HISTORICA'::varchar(24),
    NULL::bigint, NULL::smallint, NULL::smallint, NULL::timestamptz, NULL::uuid,
    'Fixture de intento previo'::text
);
INSERT INTO dw.fact_cursado (
    estudiante_sk, programa_sk, materia_sk, periodo_academico_sk,
    id_matricula_origen, estado_origen, run_id
)
SELECT e.estudiante_sk, p.programa_sk, m.materia_sk, pa.periodo_academico_sk,
       944000001, 'A', 'a4400000-0000-0000-0000-000000000001'
FROM dw.dim_estudiante e, dw.dim_programa p, dw.dim_materia m, dw.dim_periodo_academico pa
WHERE e.id_alumno = 940100001 AND p.id_programa = 'TRP'
  AND m.id_materia = 9771 AND pa.gestion = 2097 AND pa.periodo = 1;

-- Current closure, staged through both APIs.
INSERT INTO etl_control.academic_period_closure (
    gestion, periodo, created_by_subject, closure_reason
) VALUES (2097, 2, 'dsa:test', 'Prueba banderas de cursado');
SELECT etl_control.transition_academic_period_closure(
    2097::smallint, 2::smallint, 'CERRADO'::varchar(16), 'dsa:test'::varchar(255),
    'Cierre de prueba para banderas', clock_timestamp() - interval '1 minute'
);
INSERT INTO dw.dim_periodo_academico (member_type, gestion, periodo, closure_id, effective_at)
SELECT 'STANDARD', gestion, periodo, closure_id, effective_at
FROM etl_control.academic_period_closure WHERE gestion = 2097 AND periodo = 2;

SELECT etl_control.create_hop_etl_execution(
    'a4400000-0000-0000-0000-000000000002'::uuid, 'CIERRE_ACADEMICO'::varchar(24),
    (SELECT closure_id FROM etl_control.academic_period_closure WHERE gestion = 2097 AND periodo = 2),
    NULL, NULL, NULL, NULL, 'Prueba banderas de cursado'
);
SELECT etl_control.start_hop_etl_execution(
    'a4400000-0000-0000-0000-000000000002'::uuid, 'Inicio prueba banderas'
);

SET LOCAL ROLE dw_hop_runtime;

DO $$
DECLARE
    c_run CONSTANT UUID := 'a4400000-0000-0000-0000-000000000002';
BEGIN
    -- Batch API: repeated subject passed, new subject failed, zero grade unknown.
    PERFORM etl_control.stage_hop_fact_coursework_batch(c_run, jsonb_build_array(
        jsonb_build_object('row_ordinal', 1, 'source_data', jsonb_build_object(
            'id_matricula', 944000011, 'id_gestion', 2097, 'id_periodo', 2, 'id_alumno', 940100001,
            'id_programa', 'TRP', 'id_materia', 9771, 'nota', 40, 'nota_2da', 55, 'estado', 'A')),
        jsonb_build_object('row_ordinal', 2, 'source_data', jsonb_build_object(
            'id_matricula', 944000012, 'id_gestion', 2097, 'id_periodo', 2, 'id_alumno', 940100001,
            'id_programa', 'TRP', 'id_materia', 9772, 'nota', 30, 'estado', 'A')),
        jsonb_build_object('row_ordinal', 3, 'source_data', jsonb_build_object(
            'id_matricula', 944000013, 'id_gestion', 2097, 'id_periodo', 2, 'id_alumno', 940100001,
            'id_programa', 'TRP', 'id_materia', 9772, 'nota', 0, 'estado', 'X'))));

    -- Per-row API with the same first row must produce the same flags.
    PERFORM etl_control.stage_hop_fact_coursework(c_run, 4, jsonb_build_object(
        'id_matricula', 944000014, 'id_gestion', 2097, 'id_periodo', 2, 'id_alumno', 940100001,
        'id_programa', 'TRP', 'id_materia', 9771, 'nota', 40, 'nota_2da', 55, 'estado', 'A'));
END;
$$;

RESET ROLE;

DO $$
DECLARE
    c_run CONSTANT UUID := 'a4400000-0000-0000-0000-000000000002';
    v_flags TEXT;
BEGIN
    SELECT string_agg(
               row_ordinal || ':' || coalesce(record_data->>'es_aprobado', 'null') || '/'
               || coalesce(record_data->>'es_reprobado', 'null') || '/'
               || coalesce(record_data->>'es_repeticion', 'null'),
               ',' ORDER BY row_ordinal)
    INTO v_flags
    FROM etl_work.hop_publication_row
    WHERE run_id = c_run AND target_code = 'FACT_CURSADO';

    -- ordinal:aprobado/reprobado/repeticion
    IF v_flags IS DISTINCT FROM '1:true/false/true,2:false/true/false,3:null/null/false,4:true/false/true' THEN
        RAISE EXCEPTION 'Unexpected FACT_CURSADO flags: %', v_flags;
    END IF;
END;
$$;

ROLLBACK;
