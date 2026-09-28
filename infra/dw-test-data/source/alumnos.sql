CREATE TABLE academico.alumnos (
    id_alumno INTEGER PRIMARY KEY,
    id_programa CHAR(3) NOT NULL,
    id_ra VARCHAR(10),
    fec_inscripcion DATE NOT NULL,
    fec_egreso DATE,
    id_plan SMALLINT,
    estado CHAR(1) NOT NULL,
    tipo_alumno CHAR(1) NOT NULL,
    _fecha_registro TIMESTAMP
);

INSERT INTO academico.alumnos (
    id_alumno, id_programa, id_ra, fec_inscripcion, fec_egreso, id_plan, estado, tipo_alumno, _fecha_registro
) VALUES
    (1001, 'P01', 'RA-T001', '2025-02-03', NULL, 101, 'A', 'R', '2025-02-03 08:00:00'),
    (1002, 'P01', NULL, '2025-02-03', NULL, 101, 'A', 'R', '2025-02-03 08:00:00'),
    (1003, 'P02', 'RA-T003', '2025-02-03', NULL, 202, 'A', 'N', '2025-02-03 08:00:00');

GRANT SELECT ON academico.alumnos TO dw_fixture_reader;
