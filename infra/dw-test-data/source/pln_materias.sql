CREATE TABLE academico.pln_materias (
    id_materia INTEGER PRIMARY KEY,
    sigla VARCHAR(64) NOT NULL,
    materia VARCHAR(255) NOT NULL,
    id_programa CHAR(3),
    id_plan INTEGER,
    id_materia_padre INTEGER,
    ciclo INTEGER,
    nivel_academico SMALLINT,
    hrs_teoricas NUMERIC(10, 2),
    hrs_practicas NUMERIC(10, 2),
    creditos NUMERIC(10, 2)
);

INSERT INTO academico.pln_materias (
    id_materia, sigla, materia, id_programa, id_plan, id_materia_padre, ciclo,
    nivel_academico, hrs_teoricas, hrs_practicas, creditos
) VALUES
    (501, 'MAT-TEST-01', 'Materia Sintetica Uno', 'P01', 101, NULL, 1, 1, 4.00, 0.00, 5.00),
    (502, 'MAT-TEST-02', 'Materia Sintetica Dos', 'P01', 101, 501, 2, 1, 3.00, 2.00, 5.00),
    (503, 'MAT-TEST-03', 'Materia Sintetica Huerfana', 'P02', 202, 999, 1, 1, 2.00, 1.00, 3.00);

GRANT SELECT ON academico.pln_materias TO dw_fixture_reader;
