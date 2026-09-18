-- Verifies that DW-003 preserves a DW-002 record and its first audit event.

DO $$
BEGIN
    IF (SELECT COUNT(*) FROM etl_control.academic_period_closure
        WHERE gestion = 2030 AND periodo = 7) <> 1
       OR (SELECT COUNT(*) FROM etl_control.academic_period_closure_event e
           JOIN etl_control.academic_period_closure c ON c.closure_id = e.closure_id
           WHERE c.gestion = 2030 AND c.periodo = 7) <> 1 THEN
        RAISE EXCEPTION 'DW-003 no preservó la información existente de DW-002';
    END IF;
END;
$$;
