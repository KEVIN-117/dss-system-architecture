-- Disposable, read-only Hop account for the synthetic Jachasun fixture only.
CREATE ROLE dw_fixture_reader
    LOGIN PASSWORD 'fixture_readonly'
    NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION;

GRANT CONNECT ON DATABASE jachasun_test TO dw_fixture_reader;
GRANT USAGE ON SCHEMA public, academico TO dw_fixture_reader;
GRANT SELECT ON ALL TABLES IN SCHEMA public, academico TO dw_fixture_reader;
ALTER DEFAULT PRIVILEGES FOR ROLE source_test IN SCHEMA public
    GRANT SELECT ON TABLES TO dw_fixture_reader;
ALTER DEFAULT PRIVILEGES FOR ROLE source_test IN SCHEMA academico
    GRANT SELECT ON TABLES TO dw_fixture_reader;
