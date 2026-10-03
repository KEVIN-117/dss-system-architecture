-- DW-012: a verifier only reads execution gates and immutable source evidence.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'dw_owner') THEN
        RAISE EXCEPTION 'DW-003 role dw_owner must exist before DW-012 migration 0008';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'dw_raw_verifier') THEN
        CREATE ROLE dw_raw_verifier NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION;
    END IF;
END;
$$;

ALTER ROLE dw_raw_verifier NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION;
DO $$
BEGIN
    EXECUTE format('GRANT CONNECT ON DATABASE %I TO dw_raw_verifier', current_database());
END;
$$;
GRANT USAGE ON SCHEMA etl_control TO dw_raw_verifier;
GRANT SELECT ON TABLE
    etl_control.etl_execution,
    etl_control.etl_execution_step,
    etl_control.etl_source_manifest,
    etl_control.etl_source_manifest_artifact
TO dw_raw_verifier;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE
    etl_control.etl_execution,
    etl_control.etl_execution_step,
    etl_control.etl_source_manifest,
    etl_control.etl_source_manifest_artifact
FROM dw_raw_verifier;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA etl_control FROM dw_raw_verifier;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA etl_control FROM dw_raw_verifier;

COMMENT ON ROLE dw_raw_verifier IS
    'DW-012 read-only role for checking extraction completeness and RAW artifact metadata; never writes control state.';
