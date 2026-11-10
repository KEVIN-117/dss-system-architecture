-- Local Compose only. Production credentials are provisioned by the DBA/secret manager.
\getenv runtime_password DW_CONTROL_DB_PASSWORD

SELECT format(
    'CREATE ROLE dw_control_runtime LOGIN INHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD %L',
    :'runtime_password'
)
WHERE NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_roles
    WHERE rolname = 'dw_control_runtime'
)
\gexec

ALTER ROLE dw_control_runtime
    LOGIN INHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;

SELECT format('ALTER ROLE dw_control_runtime PASSWORD %L', :'runtime_password')
\gexec

GRANT dw_control_service TO dw_control_runtime;
