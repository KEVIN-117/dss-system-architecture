-- DW-004 integration test. All business fixtures are rolled back.

BEGIN;

INSERT INTO etl_control.academic_period_closure (
    gestion, periodo, created_by_subject, closure_reason
) VALUES (
    2032, 3, 'dsa:dw-004-test', 'Cierre para validar control de ejecuciones'
), (
    2032, 4, 'dsa:dw-004-test', 'Cierre para validar vínculo estricto'
);

SELECT etl_control.transition_academic_period_closure(
    2032::smallint, 3::smallint, 'CERRADO'::varchar(16),
    'dsa:dw-004-test'::varchar(255), 'Cierre aprobado',
    '2020-11-30 18:00:00-04'::timestamptz
);
SELECT etl_control.transition_academic_period_closure(
    2032::smallint, 4::smallint, 'CERRADO'::varchar(16),
    'dsa:dw-004-test'::varchar(255), 'Cierre aprobado',
    '2020-11-30 18:00:00-04'::timestamptz
);

SET LOCAL ROLE dw_staging_writer;
SELECT etl_control.create_etl_execution(
    '33333333-3333-3333-3333-333333333333'::uuid,
    'CIERRE_ACADEMICO'::varchar(24),
    'load-manager:dw-004-test'::varchar(255),
    (SELECT closure_id FROM etl_control.academic_period_closure WHERE gestion = 2032 AND periodo = 3)
);
SELECT etl_control.start_etl_execution(
    '33333333-3333-3333-3333-333333333333'::uuid,
    'load-manager:dw-004-test'::varchar(255), 'Inicio de extracción'
);
SELECT etl_control.register_etl_source_manifest(
    '33333333-3333-3333-3333-333333333333'::uuid,
    'academico.notas_planilla'::varchar(150), 'v1'::varchar(64),
    'academico'::varchar(63), 'notas_planilla'::varchar(63),
    repeat('a', 64)::char(64), 'id_gestion,id_periodo,id_matricula'::text,
    'COMPLETO'::varchar(16), repeat('b', 64)::char(64),
    2032::smallint, 3::smallint, '2020-11-30 18:00:00-04'::timestamptz,
    10::bigint
);
SELECT etl_control.register_etl_source_manifest_artifact(
    (SELECT manifest_id FROM etl_control.etl_source_manifest
     WHERE run_id = '33333333-3333-3333-3333-333333333333'::uuid),
    'RAW_EXTRACT'::varchar(32), 's3://dw-test/run-333/notas.csv'::text,
    repeat('c', 64)::char(64), 1024::bigint, 10::bigint
);
SELECT etl_control.register_etl_execution_step(
    '33333333-3333-3333-3333-333333333333'::uuid,
    'extract-notas'::varchar(100), 'EXTRACCION'::varchar(20), 'EXITOSO'::varchar(16),
    1::smallint, 'infra/postgres-tx/extract/notas_planilla.sql', 'v1', '{}'::jsonb
);
SELECT etl_control.register_etl_execution_step(
    '33333333-3333-3333-3333-333333333333'::uuid,
    'validate-notas'::varchar(100), 'VALIDACION'::varchar(20), 'EXITOSO'::varchar(16),
    2::smallint, 'quality-contract', 'v1', '{}'::jsonb
);
SELECT etl_control.record_etl_execution_metric(
    '33333333-3333-3333-3333-333333333333'::uuid,
    'records_extracted'::varchar(100), 10::numeric, 'ROWS'::varchar(32), NULL, '{}'::jsonb
);
RESET ROLE;

SET LOCAL ROLE dw_publisher;
SELECT etl_control.begin_etl_publication(
    '33333333-3333-3333-3333-333333333333'::uuid,
    'publisher:dw-004-test'::varchar(255), 'Controles previos aprobados'
);

DO $$
BEGIN
    BEGIN
        PERFORM etl_control.complete_etl_execution(
            '33333333-3333-3333-3333-333333333333'::uuid,
            'publisher:dw-004-test'::varchar(255), 'Intento sin evidencia de publicación'
        );
        RAISE EXCEPTION 'EXITOSA sin paso de publicación no fue rechazada';
    EXCEPTION WHEN check_violation THEN
        NULL;
    END;
END;
$$;

SELECT etl_control.register_etl_execution_step(
    '33333333-3333-3333-3333-333333333333'::uuid,
    'publish-dw'::varchar(100), 'PUBLICACION'::varchar(20), 'EXITOSO'::varchar(16),
    3::smallint, 'hop/publish', 'v1', '{}'::jsonb
);
SELECT etl_control.complete_etl_execution(
    '33333333-3333-3333-3333-333333333333'::uuid,
    'publisher:dw-004-test'::varchar(255), 'Publicación confirmada'
);
RESET ROLE;

SET LOCAL ROLE dw_control_operator;
SELECT etl_control.transition_academic_period_closure(
    2032::smallint, 3::smallint, 'PROCESADO'::varchar(16),
    'dsa:dw-004-test'::varchar(255), 'Carga exitosa validada', NULL,
    '33333333-3333-3333-3333-333333333333'::uuid
);

DO $$
BEGIN
    BEGIN
        PERFORM etl_control.transition_academic_period_closure(
            2032::smallint, 4::smallint, 'PROCESADO'::varchar(16),
            'dsa:dw-004-test'::varchar(255), 'Run asociado a otro cierre', NULL,
            '33333333-3333-3333-3333-333333333333'::uuid
        );
        RAISE EXCEPTION 'Un run de otro cierre no fue rechazado';
    EXCEPTION WHEN check_violation THEN
        NULL;
    END;
END;
$$;
RESET ROLE;

SET LOCAL ROLE dw_staging_writer;
SELECT etl_control.create_etl_execution(
    '44444444-4444-4444-4444-444444444444'::uuid,
    'HISTORICA'::varchar(24), 'load-manager:dw-004-test'::varchar(255)
);
SELECT etl_control.start_etl_execution(
    '44444444-4444-4444-4444-444444444444'::uuid,
    'load-manager:dw-004-test'::varchar(255), 'Inicio histórico'
);
SELECT etl_control.register_etl_execution_step(
    '44444444-4444-4444-4444-444444444444'::uuid,
    'extract-historico'::varchar(100), 'EXTRACCION'::varchar(20), 'EXITOSO'::varchar(16),
    1::smallint, 'extract', 'v1', '{}'::jsonb
);
SELECT etl_control.record_etl_execution_error(
    '44444444-4444-4444-4444-444444444444'::uuid,
    'CRITICAL'::varchar(12), 'SOURCE_TIMEOUT'::varchar(100),
    'Tiempo de espera de Jachasun', 'La fuente no respondió dentro del límite', TRUE,
    (SELECT step_id FROM etl_control.etl_execution_step
     WHERE run_id = '44444444-4444-4444-4444-444444444444'::uuid AND step_code = 'extract-historico'),
    '{"timeout_seconds":30}'::jsonb
);
SELECT etl_control.register_etl_source_manifest(
    '44444444-4444-4444-4444-444444444444'::uuid,
    'public.uatf_datos'::varchar(150), 'v1'::varchar(64),
    'public'::varchar(63), 'uatf_datos'::varchar(63),
    repeat('d', 64)::char(64), 'id_ra'::text,
    'COMPLETO'::varchar(16), repeat('e', 64)::char(64),
    NULL, NULL, NULL, 1::bigint
);
SELECT etl_control.register_etl_execution_step(
    '44444444-4444-4444-4444-444444444444'::uuid,
    'validate-historico'::varchar(100), 'VALIDACION'::varchar(20), 'EXITOSO'::varchar(16),
    2::smallint, 'quality-contract', 'v1', '{}'::jsonb
);
RESET ROLE;

SET LOCAL ROLE dw_publisher;
DO $$
BEGIN
    BEGIN
        PERFORM etl_control.begin_etl_publication(
            '44444444-4444-4444-4444-444444444444'::uuid,
            'publisher:dw-004-test'::varchar(255), 'Intento con error crítico abierto'
        );
        RAISE EXCEPTION 'PUBLICANDO con un error bloqueante no fue rechazado';
    EXCEPTION WHEN check_violation THEN
        NULL;
    END;
END;
$$;
RESET ROLE;

SET LOCAL ROLE dw_staging_writer;
SELECT etl_control.create_etl_execution(
    '66666666-6666-6666-6666-666666666666'::uuid,
    'REPROCESO'::varchar(24), 'load-manager:dw-004-test'::varchar(255),
    NULL, NULL, NULL, NULL, '33333333-3333-3333-3333-333333333333'::uuid
);
RESET ROLE;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM etl_control.etl_execution_error e
        JOIN etl_control.etl_execution_step s ON s.step_id = e.step_id
        WHERE e.run_id = '44444444-4444-4444-4444-444444444444'::uuid
          AND e.error_code = 'SOURCE_TIMEOUT'
          AND e.cause = 'Tiempo de espera de Jachasun'
          AND s.step_code = 'extract-historico'
    ) THEN
        RAISE EXCEPTION 'El error no conserva causa y paso';
    END IF;

    IF (SELECT status FROM etl_control.etl_execution
        WHERE run_id = '33333333-3333-3333-3333-333333333333'::uuid) <> 'EXITOSA'
       OR (SELECT COUNT(*) FROM etl_control.etl_execution_event
           WHERE run_id = '33333333-3333-3333-3333-333333333333'::uuid) <> 4 THEN
        RAISE EXCEPTION 'La ejecución no puede reconstruirse desde la bitácora';
    END IF;

    IF (SELECT retry_of_run_id FROM etl_control.etl_execution
        WHERE run_id = '66666666-6666-6666-6666-666666666666'::uuid)
       <> '33333333-3333-3333-3333-333333333333'::uuid THEN
        RAISE EXCEPTION 'El reproceso no conservó el enlace al intento previo';
    END IF;
END;
$$;

SET LOCAL ROLE dw_transformer;
DO $$
BEGIN
    BEGIN
        UPDATE etl_control.etl_execution
        SET status = 'FALLIDA'
        WHERE run_id = '33333333-3333-3333-3333-333333333333'::uuid;
        RAISE EXCEPTION 'La actualización directa de ejecución no fue rechazada';
    EXCEPTION WHEN insufficient_privilege THEN
        NULL;
    END;
END;
$$;
RESET ROLE;

DO $$
BEGIN
    BEGIN
        UPDATE etl_control.etl_execution_event
        SET reason = 'modificado'
        WHERE run_id = '33333333-3333-3333-3333-333333333333'::uuid;
        RAISE EXCEPTION 'La bitácora de ejecución no fue inmutable';
    EXCEPTION WHEN object_not_in_prerequisite_state THEN
        NULL;
    END;
END;
$$;

ROLLBACK;
