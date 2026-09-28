CREATE TABLE academico.notas_planilla (
    id_matricula BIGINT PRIMARY KEY,
    id_gestion SMALLINT NOT NULL,
    id_periodo SMALLINT NOT NULL,
    id_alumno INTEGER NOT NULL,
    id_materia INTEGER NOT NULL,
    grupo VARCHAR(10),
    nota INTEGER,
    nota_2da INTEGER,
    nota_ex_mesa INTEGER,
    pparcial INTEGER,
    sparcial INTEGER,
    tparcial INTEGER,
    cparcial INTEGER,
    estado CHAR(1),
    observacion VARCHAR(255),
    tipo CHAR(1),
    _fecha_creacion TIMESTAMP,
    _hash TEXT
);

INSERT INTO academico.notas_planilla (
    id_matricula, id_gestion, id_periodo, id_alumno, id_materia, grupo, nota, nota_2da,
    nota_ex_mesa, pparcial, sparcial, tparcial, cparcial, estado, observacion, tipo,
    _fecha_creacion, _hash
) VALUES
    (9001, 2025, 1, 1001, 501, 'A', 75, NULL, NULL, 70, 78, NULL, NULL, 'A', NULL, 'R', '2025-06-20 12:00:00', 'hash-test-9001'),
    (9002, 2025, 1, 1002, 502, 'A', NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'P', 'Sin calificacion final', 'R', '2025-06-20 12:00:00', 'hash-test-9002'),
    (9003, 2025, 2, 1001, 501, 'B', 45, 52, NULL, 40, 45, NULL, NULL, 'R', 'Segundo intento', 'R', '2025-12-10 12:00:00', 'hash-test-9003'),
    (9004, 2025, 2, 1003, 503, 'A', 88, NULL, NULL, 90, 86, NULL, NULL, 'A', NULL, 'R', '2025-12-10 12:00:00', 'hash-test-9004'),
    (9005, 2025, 2, 1002, 502, 'A', 101, NULL, NULL, 101, NULL, NULL, NULL, 'R', 'Fuera de rango para calidad', 'R', '2025-12-10 12:00:00', 'hash-test-9005');

GRANT SELECT ON academico.notas_planilla TO dw_fixture_reader;
