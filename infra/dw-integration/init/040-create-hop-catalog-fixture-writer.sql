-- Disposable least-privilege principal for the academic-catalog sync test.
CREATE ROLE auth_catalog_fixture_writer
    NOLOGIN INHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
CREATE ROLE hop_academic_catalog
    LOGIN INHERIT PASSWORD 'hop_catalog_fixture'
    NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS
    CONNECTION LIMIT 3;
GRANT auth_catalog_fixture_writer TO hop_academic_catalog;

GRANT CONNECT ON DATABASE auth_catalog_test TO auth_catalog_fixture_writer;
GRANT USAGE ON SCHEMA public TO auth_catalog_fixture_writer;
REVOKE CREATE ON SCHEMA public FROM auth_catalog_fixture_writer;
GRANT SELECT (
    faculty_id, name, abbreviation, source_status, is_active, last_synced_at
) ON public.academic_faculties TO auth_catalog_fixture_writer;
GRANT INSERT (
    faculty_id, name, abbreviation, source_status, is_active, last_synced_at
) ON public.academic_faculties TO auth_catalog_fixture_writer;
GRANT UPDATE (
    name, abbreviation, source_status, is_active, last_synced_at
) ON public.academic_faculties TO auth_catalog_fixture_writer;
GRANT SELECT (
    career_id, faculty_id, name, source_status, is_active, last_synced_at
) ON public.academic_programs TO auth_catalog_fixture_writer;
GRANT INSERT (
    career_id, faculty_id, name, source_status, is_active, last_synced_at
) ON public.academic_programs TO auth_catalog_fixture_writer;
GRANT UPDATE (
    faculty_id, name, source_status, is_active, last_synced_at
) ON public.academic_programs TO auth_catalog_fixture_writer;
