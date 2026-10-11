CREATE TABLE academico.notas_planilla (
    id_matricula INTEGER PRIMARY KEY,
    id_gestion SMALLINT NOT NULL,
    id_periodo SMALLINT NOT NULL,
    id_alumno INTEGER NOT NULL,
    id_materia SMALLINT NOT NULL,
    grupo SMALLINT,
    nota NUMERIC(5,2) DEFAULT 0,
    estado CHAR(1) NOT NULL,
    observacion VARCHAR,
    nota_2da NUMERIC DEFAULT 0,
    nota_ex_mesa NUMERIC DEFAULT 0,
    pparcial NUMERIC DEFAULT 0,
    sparcial NUMERIC DEFAULT 0,
    tparcial NUMERIC DEFAULT 0,
    cparcial NUMERIC DEFAULT 0,
    tipo VARCHAR(1) DEFAULT 'N',
    _fecha_creacion TIMESTAMP,
    _hash VARCHAR,
    _unique INTEGER NOT NULL DEFAULT 1,
    UNIQUE (id_gestion, id_periodo, id_alumno, id_materia, grupo, _unique)
);

INSERT INTO academico.notas_planilla (
    id_matricula, id_gestion, id_periodo, id_alumno, id_materia, grupo, nota, estado,
    observacion, nota_2da, nota_ex_mesa, pparcial, sparcial, tparcial, cparcial, tipo,
    _fecha_creacion, _hash, _unique
) VALUES
    (9001, 2025, 1, 1001, 501, 1, 75, 'A', NULL, NULL, NULL, 70, 78, NULL, NULL, 'R', '2025-06-20 12:00:00', 'hash-test-9001', 1),
    (9002, 2025, 1, 1002, 502, 1, NULL, 'P', 'Sin calificacion final', NULL, NULL, NULL, NULL, NULL, NULL, 'R', '2025-06-20 12:00:00', 'hash-test-9002', 1),
    (9003, 2025, 2, 1001, 501, 2, 45, 'R', 'Segundo intento', 52, NULL, 40, 45, NULL, NULL, 'R', '2025-12-10 12:00:00', 'hash-test-9003', 1),
    (9004, 2025, 2, 1003, 503, 1, 88, 'A', NULL, NULL, NULL, 90, 86, NULL, NULL, 'R', '2025-12-10 12:00:00', 'hash-test-9004', 1),
    (9005, 2025, 2, 1002, 502, 1, 100, 'R', 'Caso de rango máximo válido', NULL, NULL, 100, NULL, NULL, NULL, 'R', '2025-12-10 12:00:00', 'hash-test-9005', 1),
    (9006, 2025, 3, 1001, 501, 1, 101, 'A', 'Caso inválido: nota fuera de rango', NULL, NULL, NULL, NULL, NULL, NULL, 'R', '2026-02-10 12:00:00', 'hash-test-9006-invalid', 1);

GRANT SELECT ON academico.notas_planilla TO dw_fixture_reader;
