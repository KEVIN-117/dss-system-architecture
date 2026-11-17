-- Rol de solo lectura para que Apache Hop extraiga la OLTP sintética.
-- Credencial desechable de desarrollo: esta base solo contiene datos ficticios.
CREATE ROLE dw_fixture_reader
    LOGIN PASSWORD 'fixture_readonly'
    NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION;

GRANT CONNECT ON DATABASE jachasun_test TO dw_fixture_reader;
GRANT USAGE ON SCHEMA public, academico, actas_graduacion TO dw_fixture_reader;
GRANT SELECT ON ALL TABLES IN SCHEMA public, academico, actas_graduacion TO dw_fixture_reader;
ALTER DEFAULT PRIVILEGES IN SCHEMA public, academico, actas_graduacion
    GRANT SELECT ON TABLES TO dw_fixture_reader;
