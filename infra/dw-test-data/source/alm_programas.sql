CREATE SCHEMA academico;

CREATE ROLE dw_fixture_reader LOGIN PASSWORD 'fixture_readonly' NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT;
REVOKE CREATE ON SCHEMA public, academico FROM PUBLIC;

CREATE TABLE academico.alm_programas (
    id_programa CHAR(3) PRIMARY KEY,
    programa VARCHAR(50) NOT NULL,
    id_facultad SMALLINT NOT NULL,
    id_nivel SMALLINT NOT NULL,
    nivel VARCHAR(45),
    sede VARCHAR(1),
    _tipo_academico CHAR(3) NOT NULL,
    activo VARCHAR
);

INSERT INTO academico.alm_programas (
    id_programa, programa, id_facultad, id_nivel, nivel, sede, _tipo_academico, activo
) VALUES
    ('P01', 'Programa Sintetico Uno', 1, 1, 'Licenciatura', 'P', 'CAR', 'A'),
    ('P02', 'Programa Sintetico Dos', 2, 1, 'Licenciatura', 'P', 'CAR', 'A');

GRANT USAGE ON SCHEMA academico TO dw_fixture_reader;
GRANT SELECT ON academico.alm_programas TO dw_fixture_reader;
