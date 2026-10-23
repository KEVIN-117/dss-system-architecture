-- DW-CONTROL-003: grant the control service read-only access to the closure calendar.
-- Runtime LOGIN accounts are provisioned by TI/DBA and inherit this NOLOGIN group role.

DO $$
BEGIN
    IF to_regclass('etl_control.academic_period_closure') IS NULL
       OR to_regclass('etl_control.academic_period_closure_event') IS NULL THEN
        RAISE EXCEPTION '0023 requires the academic closure calendar from migration 0001';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'dw_control_reader') THEN
        EXECUTE 'CREATE ROLE dw_control_reader';
    END IF;
END;
$$;

ALTER ROLE dw_control_reader
    NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;

DO $$
DECLARE
    v_database TEXT := current_database();
BEGIN
    EXECUTE format('GRANT CONNECT ON DATABASE %I TO dw_control_reader', v_database);
END;
$$;

REVOKE ALL ON SCHEMA etl_control FROM dw_control_reader;
GRANT USAGE ON SCHEMA etl_control TO dw_control_reader;

REVOKE ALL ON etl_control.academic_period_closure,
    etl_control.academic_period_closure_event FROM dw_control_reader;
GRANT SELECT ON etl_control.academic_period_closure,
    etl_control.academic_period_closure_event TO dw_control_reader;

DO $$
DECLARE
    v_transition_function REGPROCEDURE :=
        'etl_control.transition_academic_period_closure(smallint,smallint,character varying,character varying,text,timestamp with time zone,uuid)'
        ::REGPROCEDURE;
BEGIN
    IF NOT has_table_privilege('dw_control_reader', 'etl_control.academic_period_closure', 'SELECT')
       OR NOT has_table_privilege('dw_control_reader', 'etl_control.academic_period_closure_event', 'SELECT')
       OR has_table_privilege('dw_control_reader', 'etl_control.academic_period_closure', 'INSERT')
       OR has_table_privilege('dw_control_reader', 'etl_control.academic_period_closure', 'UPDATE')
       OR has_table_privilege('dw_control_reader', 'etl_control.academic_period_closure', 'DELETE')
       OR has_table_privilege('dw_control_reader', 'etl_control.academic_period_closure_event', 'INSERT')
       OR has_table_privilege('dw_control_reader', 'etl_control.academic_period_closure_event', 'UPDATE')
       OR has_table_privilege('dw_control_reader', 'etl_control.academic_period_closure_event', 'DELETE')
       OR has_function_privilege('dw_control_reader', v_transition_function, 'EXECUTE') THEN
        RAISE EXCEPTION 'dw_control_reader must have SELECT only on the closure calendar and audit log';
    END IF;
END;
$$;

COMMENT ON ROLE dw_control_reader IS
    'Read-only access for dw-control-service closure and audit queries; no direct writes or transition functions.';
