-- Provisioning for the Apache Hop academic-catalog writer.
-- Run as a database administrator AFTER Flyway migration V3 has created the
-- public.academic_faculties and public.academic_programs tables.
--
-- This is deliberately an operational script, not a Flyway migration:
-- cluster roles and production credentials are provisioned by the DBA.
-- A newly created login remains NOLOGIN until a secret is set with psql's
-- \password. Reruns preserve an already enabled login and its password.

\set ON_ERROR_STOP on

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'auth_academic_catalog_writer') THEN
        CREATE ROLE auth_academic_catalog_writer
            NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
    ELSE
        ALTER ROLE auth_academic_catalog_writer
            NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'hop_academic_catalog') THEN
        CREATE ROLE hop_academic_catalog
            NOLOGIN INHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS
            CONNECTION LIMIT 3;
    ELSE
        ALTER ROLE hop_academic_catalog
            INHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS
            CONNECTION LIMIT 3;
    END IF;
END
$$;

GRANT auth_academic_catalog_writer TO hop_academic_catalog;

SELECT format(
    'GRANT CONNECT ON DATABASE %I TO auth_academic_catalog_writer',
    current_database()
) \gexec

GRANT USAGE ON SCHEMA public TO auth_academic_catalog_writer;
REVOKE CREATE ON SCHEMA public FROM auth_academic_catalog_writer;

-- Reset direct grants on these two tables so rerunning this script keeps the
-- writer's table privileges bounded to the intended synchronization task.
REVOKE ALL PRIVILEGES ON TABLE
    public.academic_faculties,
    public.academic_programs
FROM auth_academic_catalog_writer;

GRANT SELECT (
    faculty_id, name, abbreviation, source_status, is_active, last_synced_at
) ON public.academic_faculties TO auth_academic_catalog_writer;
GRANT INSERT (
    faculty_id, name, abbreviation, source_status, is_active, last_synced_at
) ON public.academic_faculties TO auth_academic_catalog_writer;
GRANT UPDATE (
    name, abbreviation, source_status, is_active, last_synced_at
) ON public.academic_faculties TO auth_academic_catalog_writer;

GRANT SELECT (
    career_id, faculty_id, name, source_status, is_active, last_synced_at
) ON public.academic_programs TO auth_academic_catalog_writer;
GRANT INSERT (
    career_id, faculty_id, name, source_status, is_active, last_synced_at
) ON public.academic_programs TO auth_academic_catalog_writer;
GRANT UPDATE (
    faculty_id, name, source_status, is_active, last_synced_at
) ON public.academic_programs TO auth_academic_catalog_writer;

COMMENT ON ROLE auth_academic_catalog_writer IS
    'NOLOGIN group: SELECT/INSERT/UPDATE only on auth academic catalog tables; no DELETE or DDL.';
COMMENT ON ROLE hop_academic_catalog IS
    'Apache Hop login for academic catalog sync; activate only after setting a managed password.';

-- After this script succeeds, set a password without putting it in SQL history:
--   psql> \password hop_academic_catalog
-- Then enable login:
--   psql> ALTER ROLE hop_academic_catalog LOGIN;
-- Store that secret in the approved secret manager and inject it into Hop at
-- runtime. Do not add it to this repository or a committed Hop environment.
