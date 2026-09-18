-- DW-002 integration test. Run after migrations/0001_create_academic_closure_calendar.sql.
-- All data is rolled back; no academic closure is persisted.

BEGIN;

INSERT INTO etl_control.academic_period_closure (
    gestion, periodo, created_by_subject, closure_reason
) VALUES (
    2026, 99, 'dsa:test-user', 'Fixture transaccional DW-002'
);

DO $$
BEGIN
    BEGIN
        INSERT INTO etl_control.academic_period_closure (
            gestion, periodo, created_by_subject, closure_reason
        ) VALUES (2026, 0, 'dsa:test-user', 'Periodo inválido');
        RAISE EXCEPTION 'El CHECK de periodo inválido no se aplicó';
    EXCEPTION WHEN check_violation THEN
        NULL;
    END;

    BEGIN
        INSERT INTO etl_control.academic_period_closure (
            gestion, periodo, created_by_subject, closure_reason
        ) VALUES (2026, 99, 'dsa:test-user', 'Periodo duplicado');
        RAISE EXCEPTION 'La unicidad de gestión/periodo no se aplicó';
    EXCEPTION WHEN unique_violation THEN
        NULL;
    END;

    BEGIN
        PERFORM etl_control.transition_academic_period_closure(
            2026::smallint,
            99::smallint,
            'PROCESADO'::varchar(16),
            'dsa:test-user'::varchar(255),
            'Salto inválido'::text
        );
        RAISE EXCEPTION 'El salto PENDIENTE a PROCESADO no fue rechazado';
    EXCEPTION WHEN check_violation THEN
        NULL;
    END;
END;
$$;

SELECT etl_control.transition_academic_period_closure(
    2026::smallint,
    99::smallint,
    'CERRADO'::varchar(16),
    'dsa:test-user'::varchar(255),
    'Cierre funcional aprobado'::text,
    '2026-11-30 18:00:00-04'::timestamptz
);

SELECT etl_control.transition_academic_period_closure(
    2026::smallint,
    99::smallint,
    'PROCESADO'::varchar(16),
    'load-manager:test'::varchar(255),
    'Carga ficticia exitosa'::text,
    NULL, '11111111-1111-1111-1111-111111111111'::uuid
);

SELECT etl_control.transition_academic_period_closure(
    2026::smallint,
    99::smallint,
    'REABIERTO'::varchar(16),
    'dsa:test-user'::varchar(255),
    'Rectificación académica requerida'::text
);

SELECT etl_control.transition_academic_period_closure(
    2026::smallint,
    99::smallint,
    'CERRADO'::varchar(16),
    'dsa:test-user'::varchar(255),
    'Cierre posterior a rectificación'::text,
    '2026-12-01 18:00:00-04'::timestamptz
);

DO $$
DECLARE
    v_status TEXT;
    v_events INTEGER;
BEGIN
    SELECT status, COUNT(e.event_id)
    INTO v_status, v_events
    FROM etl_control.academic_period_closure c
    LEFT JOIN etl_control.academic_period_closure_event e ON e.closure_id = c.closure_id
    WHERE c.gestion = 2026 AND c.periodo = 99
    GROUP BY c.status;

    IF v_status <> 'CERRADO' OR v_events <> 5 THEN
        RAISE EXCEPTION 'Estado o auditoría inesperados: status=%, events=%', v_status, v_events;
    END IF;

    BEGIN
        UPDATE etl_control.academic_period_closure
        SET status = 'PROCESADO'
        WHERE gestion = 2026 AND periodo = 99;
        RAISE EXCEPTION 'La actualización directa de estado no fue rechazada';
    EXCEPTION WHEN insufficient_privilege THEN
        NULL;
    END;
END;
$$;

ROLLBACK;
