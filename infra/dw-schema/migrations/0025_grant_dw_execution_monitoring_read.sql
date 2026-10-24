-- DW-CONTROL-005: grant the control service read-only ETL monitoring access.

DO $$
BEGIN
    IF to_regclass('etl_control.etl_execution') IS NULL
       OR to_regclass('etl_control.etl_execution_step') IS NULL
       OR to_regclass('etl_control.etl_execution_metric') IS NULL
       OR to_regclass('etl_control.etl_execution_error') IS NULL
       OR NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'dw_control_reader') THEN
        RAISE EXCEPTION '0025 requires execution-control tables and dw_control_reader';
    END IF;
END;
$$;

REVOKE ALL ON etl_control.etl_execution,
    etl_control.etl_execution_step,
    etl_control.etl_execution_metric,
    etl_control.etl_execution_error
FROM dw_control_reader;

GRANT SELECT ON etl_control.etl_execution,
    etl_control.etl_execution_step,
    etl_control.etl_execution_metric,
    etl_control.etl_execution_error
TO dw_control_reader;

DO $$
BEGIN
    IF NOT has_table_privilege('dw_control_reader', 'etl_control.etl_execution', 'SELECT')
       OR NOT has_table_privilege('dw_control_reader', 'etl_control.etl_execution_step', 'SELECT')
       OR NOT has_table_privilege('dw_control_reader', 'etl_control.etl_execution_metric', 'SELECT')
       OR NOT has_table_privilege('dw_control_reader', 'etl_control.etl_execution_error', 'SELECT')
       OR has_table_privilege('dw_control_reader', 'etl_control.etl_execution', 'INSERT')
       OR has_table_privilege('dw_control_reader', 'etl_control.etl_execution', 'UPDATE')
       OR has_table_privilege('dw_control_reader', 'etl_control.etl_execution', 'DELETE')
       OR has_table_privilege('dw_control_reader', 'etl_control.etl_execution_step', 'INSERT')
       OR has_table_privilege('dw_control_reader', 'etl_control.etl_execution_step', 'UPDATE')
       OR has_table_privilege('dw_control_reader', 'etl_control.etl_execution_step', 'DELETE')
       OR has_table_privilege('dw_control_reader', 'etl_control.etl_execution_metric', 'INSERT')
       OR has_table_privilege('dw_control_reader', 'etl_control.etl_execution_metric', 'UPDATE')
       OR has_table_privilege('dw_control_reader', 'etl_control.etl_execution_metric', 'DELETE')
       OR has_table_privilege('dw_control_reader', 'etl_control.etl_execution_error', 'INSERT')
       OR has_table_privilege('dw_control_reader', 'etl_control.etl_execution_error', 'UPDATE')
       OR has_table_privilege('dw_control_reader', 'etl_control.etl_execution_error', 'DELETE') THEN
        RAISE EXCEPTION 'dw_control_reader must retain SELECT-only access to ETL monitoring tables';
    END IF;
END;
$$;

COMMENT ON ROLE dw_control_reader IS
    'Read-only access for closure and ETL monitoring queries; no direct writes or transition functions.';
