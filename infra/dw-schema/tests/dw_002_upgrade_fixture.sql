-- Simulates a previously deployed DW-002 database before DW-003 adopts its objects.

INSERT INTO etl_control.academic_period_closure (
    gestion, periodo, created_by_subject, closure_reason
) VALUES (
    2030, 7, 'dsa:upgrade-test', 'Fixture previo a DW-003'
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM etl_control.academic_period_closure
        WHERE gestion = 2030 AND periodo = 7
    ) THEN
        RAISE EXCEPTION 'No se pudo crear el fixture de actualización DW-002';
    END IF;
END;
$$;
