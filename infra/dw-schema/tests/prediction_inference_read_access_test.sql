DO $$
BEGIN
    IF NOT has_table_privilege('dw_prediction_reader', 'dw.fact_cursado', 'SELECT')
       OR NOT has_table_privilege('dw_prediction_reader', 'dw.fact_retencion_desercion', 'SELECT')
       OR NOT has_table_privilege('dw_prediction_reader', 'etl_control.academic_period_closure', 'SELECT')
       OR NOT has_table_privilege('dw_prediction_reader', 'etl_control.etl_execution', 'SELECT') THEN
        RAISE EXCEPTION 'Prediction runtime lacks one of the required read-only inference grants';
    END IF;
    IF has_table_privilege('dw_prediction_reader', 'dw.fact_cursado', 'INSERT')
       OR has_table_privilege('dw_prediction_reader', 'dw.fact_retencion_desercion', 'UPDATE')
       OR has_table_privilege('dw_prediction_reader', 'ml_workspace.training_job', 'INSERT')
       OR has_table_privilege('dw_prediction_reader', 'dw.dim_materia', 'SELECT') THEN
        RAISE EXCEPTION 'Prediction runtime has an unexpected DW privilege';
    END IF;
END;
$$;

SELECT 'Prediction inference grants are read-only and table-scoped' AS result;
