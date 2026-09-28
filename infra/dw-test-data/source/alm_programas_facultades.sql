CREATE TABLE academico.alm_programas_facultades (
    id_facultad INTEGER PRIMARY KEY,
    facultad VARCHAR(100) NOT NULL,
    facu_abre VARCHAR(50),
    estado CHAR(1)
);

INSERT INTO academico.alm_programas_facultades (id_facultad, facultad, facu_abre, estado) VALUES
    (1, 'Facultad Sintetica de Ciencias', 'FSC', 'A'),
    (2, 'Facultad Sintetica de Tecnologia', 'FST', 'A');

GRANT SELECT ON academico.alm_programas_facultades TO dw_fixture_reader;
