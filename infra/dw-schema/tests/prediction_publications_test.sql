DO $$
DECLARE
    v_view_definition TEXT;
BEGIN
    IF to_regclass('ml_workspace.prediction_batch') IS NULL
       OR to_regclass('ml_workspace.prediction_batch_outbox') IS NULL
       OR to_regclass('ml_workspace.prediction_result') IS NULL
       OR to_regclass('ml_workspace.v_published_prediction') IS NULL THEN
        RAISE EXCEPTION 'PRED-007 publication contract objects are missing';
    END IF;
    IF NOT has_table_privilege('dw_prediction_runtime', 'ml_workspace.prediction_batch', 'INSERT')
       OR NOT has_table_privilege('dw_prediction_runtime', 'ml_workspace.prediction_batch_outbox', 'UPDATE')
       OR NOT has_table_privilege('dw_prediction_publisher', 'ml_workspace.prediction_result', 'INSERT')
       OR NOT has_table_privilege('dw_prediction_runtime', 'ml_workspace.v_published_prediction', 'SELECT') THEN
        RAISE EXCEPTION 'Prediction runtime lacks publication privileges';
    END IF;
    IF has_table_privilege('dw_prediction_runtime', 'ml_workspace.prediction_result', 'INSERT')
       OR has_table_privilege('dw_reader', 'ml_workspace.prediction_result', 'SELECT')
       OR has_table_privilege('dw_prediction_reader', 'ml_workspace.prediction_result', 'SELECT')
       OR has_table_privilege('dw_ml_writer', 'ml_workspace.prediction_result', 'INSERT') THEN
        RAISE EXCEPTION 'Publication rows are exposed to a broad analytical or generic ML writer role';
    END IF;
    v_view_definition := pg_get_viewdef('ml_workspace.v_published_prediction'::regclass, true);
    IF position('PUBLISHED' IN v_view_definition) = 0 THEN
        RAISE EXCEPTION 'Published prediction view does not filter incomplete batches';
    END IF;
END;
$$;

SELECT 'PRED-007 publication objects, visibility boundary, and runtime grants are valid' AS result;
