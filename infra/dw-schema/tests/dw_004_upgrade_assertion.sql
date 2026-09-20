-- DW-004 upgrade assertion. Run after the migration runner applies 0003.

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM etl_control.academic_period_closure
        WHERE gestion = 2027
          AND periodo = 7
          AND status = 'PROCESADO'
          AND processed_run_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid
    ) THEN
        RAISE EXCEPTION 'DW-004 no preservó el cierre PROCESADO legado';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'fk_academic_period_closure_processed_run'
          AND NOT convalidated
    ) THEN
        RAISE EXCEPTION 'La FK de processed_run_id debe preservar registros históricos con NOT VALID';
    END IF;
END;
$$;
