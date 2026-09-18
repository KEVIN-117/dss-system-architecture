-- DW-003: analytical layers, least-privilege groups, and migration history.
-- Execute through scripts/apply-migrations.sh with a database owner or superuser.

DO $$
DECLARE
    v_role TEXT;
BEGIN
    FOREACH v_role IN ARRAY ARRAY[
        'dw_owner',
        'dw_staging_writer',
        'dw_transformer',
        'dw_control_operator',
        'dw_publisher',
        'dw_ml_writer',
        'dw_reader'
    ] LOOP
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = v_role) THEN
            EXECUTE format(
                'CREATE ROLE %I NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS',
                v_role
            );
        END IF;

        EXECUTE format(
            'ALTER ROLE %I NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS',
            v_role
        );
    END LOOP;
END;
$$;

DO $$
BEGIN
    IF to_regclass('etl_control.academic_period_closure') IS NULL
       OR to_regclass('etl_control.academic_period_closure_event') IS NULL
       OR to_regprocedure(
            'etl_control.transition_academic_period_closure(smallint,smallint,character varying,character varying,text,timestamp with time zone,uuid)'
       ) IS NULL THEN
        RAISE EXCEPTION 'DW-002 debe estar aplicada antes de DW-003';
    END IF;
END;
$$;

CREATE SCHEMA IF NOT EXISTS staging AUTHORIZATION dw_owner;
CREATE SCHEMA IF NOT EXISTS etl_work AUTHORIZATION dw_owner;
CREATE SCHEMA IF NOT EXISTS dw AUTHORIZATION dw_owner;
CREATE SCHEMA IF NOT EXISTS ml_workspace AUTHORIZATION dw_owner;

ALTER SCHEMA staging OWNER TO dw_owner;
ALTER SCHEMA etl_work OWNER TO dw_owner;
ALTER SCHEMA etl_control OWNER TO dw_owner;
ALTER SCHEMA dw OWNER TO dw_owner;
ALTER SCHEMA ml_workspace OWNER TO dw_owner;

ALTER TABLE etl_control.academic_period_closure OWNER TO dw_owner;
ALTER TABLE etl_control.academic_period_closure_event OWNER TO dw_owner;
ALTER SEQUENCE etl_control.academic_period_closure_closure_id_seq OWNER TO dw_owner;
ALTER SEQUENCE etl_control.academic_period_closure_event_event_id_seq OWNER TO dw_owner;
ALTER FUNCTION etl_control.record_initial_academic_period_closure_event() OWNER TO dw_owner;
ALTER FUNCTION etl_control.reject_direct_academic_period_closure_update() OWNER TO dw_owner;
ALTER FUNCTION etl_control.prevent_academic_period_closure_event_mutation() OWNER TO dw_owner;
ALTER FUNCTION etl_control.transition_academic_period_closure(
    SMALLINT, SMALLINT, VARCHAR, VARCHAR, TEXT, TIMESTAMPTZ, UUID
) OWNER TO dw_owner;
ALTER FUNCTION etl_control.record_initial_academic_period_closure_event()
    SECURITY DEFINER
    SET search_path = pg_catalog, etl_control;
ALTER FUNCTION etl_control.transition_academic_period_closure(
    SMALLINT, SMALLINT, VARCHAR, VARCHAR, TEXT, TIMESTAMPTZ, UUID
) SECURITY DEFINER
    SET search_path = pg_catalog, etl_control;

SET ROLE dw_owner;

CREATE TABLE IF NOT EXISTS etl_control.schema_migration (
    version VARCHAR(64) PRIMARY KEY CHECK (version ~ '^[0-9]{4}$'),
    filename TEXT NOT NULL UNIQUE CHECK (filename ~ '^[0-9]{4}_.+\.sql$'),
    checksum_sha256 CHAR(64) NOT NULL CHECK (checksum_sha256 ~ '^[0-9a-f]{64}$'),
    applied_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    applied_by VARCHAR(255) NOT NULL CHECK (btrim(applied_by) <> '')
);

COMMENT ON TABLE etl_control.schema_migration IS
    'Historial inmutable de migraciones del esquema DW; no representa ejecuciones ETL de DW-004.';

RESET ROLE;

INSERT INTO etl_control.schema_migration (
    version, filename, checksum_sha256, applied_by
) VALUES (
    '0001',
    '0001_create_academic_closure_calendar.sql',
    '0e38be04cd827406c5391d1528edb6321cad502469d827ed92dba9a2e742f554',
    current_user
)
ON CONFLICT (version) DO NOTHING;

DO $$
DECLARE
    v_database TEXT := current_database();
BEGIN
    EXECUTE format('REVOKE ALL PRIVILEGES ON DATABASE %I FROM PUBLIC', v_database);
    EXECUTE format(
        'GRANT CONNECT ON DATABASE %I TO dw_staging_writer, dw_transformer, dw_control_operator, dw_publisher, dw_ml_writer, dw_reader',
        v_database
    );
END;
$$;

REVOKE CREATE ON SCHEMA public FROM PUBLIC;
REVOKE ALL ON SCHEMA staging, etl_work, etl_control, dw, ml_workspace FROM PUBLIC;

GRANT USAGE ON SCHEMA staging TO dw_staging_writer, dw_transformer;
GRANT USAGE ON SCHEMA etl_work TO dw_transformer, dw_publisher;
GRANT USAGE ON SCHEMA etl_control TO dw_control_operator, dw_transformer, dw_publisher;
GRANT USAGE ON SCHEMA dw TO dw_publisher, dw_ml_writer, dw_reader;
GRANT USAGE ON SCHEMA ml_workspace TO dw_ml_writer;

REVOKE ALL ON ALL TABLES IN SCHEMA etl_control FROM PUBLIC;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA etl_control FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA etl_control FROM PUBLIC;

GRANT SELECT, INSERT ON etl_control.academic_period_closure TO dw_control_operator;
GRANT SELECT ON etl_control.academic_period_closure_event TO dw_control_operator;
GRANT USAGE, SELECT ON SEQUENCE etl_control.academic_period_closure_closure_id_seq TO dw_control_operator;
GRANT EXECUTE ON FUNCTION etl_control.transition_academic_period_closure(
    SMALLINT, SMALLINT, VARCHAR, VARCHAR, TEXT, TIMESTAMPTZ, UUID
) TO dw_control_operator;
GRANT EXECUTE ON FUNCTION etl_control.record_initial_academic_period_closure_event()
    TO dw_control_operator;

GRANT SELECT ON etl_control.academic_period_closure,
    etl_control.academic_period_closure_event TO dw_transformer, dw_publisher;

ALTER DEFAULT PRIVILEGES FOR ROLE dw_owner IN SCHEMA staging
    REVOKE ALL ON TABLES FROM PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE dw_owner IN SCHEMA staging
    REVOKE ALL ON SEQUENCES FROM PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE dw_owner IN SCHEMA etl_work
    REVOKE ALL ON TABLES FROM PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE dw_owner IN SCHEMA etl_work
    REVOKE ALL ON SEQUENCES FROM PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE dw_owner IN SCHEMA etl_control
    REVOKE ALL ON TABLES FROM PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE dw_owner IN SCHEMA etl_control
    REVOKE ALL ON SEQUENCES FROM PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE dw_owner IN SCHEMA dw
    REVOKE ALL ON TABLES FROM PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE dw_owner IN SCHEMA dw
    REVOKE ALL ON SEQUENCES FROM PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE dw_owner IN SCHEMA ml_workspace
    REVOKE ALL ON TABLES FROM PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE dw_owner IN SCHEMA ml_workspace
    REVOKE ALL ON SEQUENCES FROM PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE dw_owner
    REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;

ALTER DEFAULT PRIVILEGES FOR ROLE dw_owner IN SCHEMA staging
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO dw_staging_writer;
ALTER DEFAULT PRIVILEGES FOR ROLE dw_owner IN SCHEMA staging
    GRANT USAGE, SELECT ON SEQUENCES TO dw_staging_writer;
ALTER DEFAULT PRIVILEGES FOR ROLE dw_owner IN SCHEMA staging
    GRANT SELECT ON TABLES TO dw_transformer;

ALTER DEFAULT PRIVILEGES FOR ROLE dw_owner IN SCHEMA etl_work
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO dw_transformer;
ALTER DEFAULT PRIVILEGES FOR ROLE dw_owner IN SCHEMA etl_work
    GRANT USAGE, SELECT ON SEQUENCES TO dw_transformer;
ALTER DEFAULT PRIVILEGES FOR ROLE dw_owner IN SCHEMA etl_work
    GRANT SELECT ON TABLES TO dw_publisher;

ALTER DEFAULT PRIVILEGES FOR ROLE dw_owner IN SCHEMA dw
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO dw_publisher;
ALTER DEFAULT PRIVILEGES FOR ROLE dw_owner IN SCHEMA dw
    GRANT USAGE, SELECT ON SEQUENCES TO dw_publisher;
ALTER DEFAULT PRIVILEGES FOR ROLE dw_owner IN SCHEMA dw
    GRANT SELECT ON TABLES TO dw_ml_writer, dw_reader;

ALTER DEFAULT PRIVILEGES FOR ROLE dw_owner IN SCHEMA ml_workspace
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO dw_ml_writer;
ALTER DEFAULT PRIVILEGES FOR ROLE dw_owner IN SCHEMA ml_workspace
    GRANT USAGE, SELECT ON SEQUENCES TO dw_ml_writer;

COMMENT ON SCHEMA staging IS 'Datos planos extraídos desde OLTP antes de transformaciones analíticas.';
COMMENT ON SCHEMA etl_work IS 'Datos de trabajo transitorios para transformaciones ETL.';
COMMENT ON SCHEMA etl_control IS 'Control operativo, auditoría y metadatos del pipeline DW.';
COMMENT ON SCHEMA dw IS 'Modelo dimensional y datos publicados para consumo analítico.';
COMMENT ON SCHEMA ml_workspace IS 'Artefactos y conjuntos de trabajo para procesos de ML.';
