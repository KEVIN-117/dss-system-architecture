CREATE TABLE academico.pln_materias (
    id_materia INTEGER PRIMARY KEY,
    sigla CHAR(7) NOT NULL,
    materia VARCHAR NOT NULL,
    id_programa CHAR(3),
    id_plan INTEGER,
    id_materia_padre INTEGER,
    ciclo INTEGER,
    nivel_academico SMALLINT,
    hrs_teoricas SMALLINT,
    hrs_practicas SMALLINT,
    _creditos SMALLINT NOT NULL DEFAULT 0
);

INSERT INTO academico.pln_materias (
    id_materia, sigla, materia, id_programa, id_plan, id_materia_padre, ciclo,
    nivel_academico, hrs_teoricas, hrs_practicas, _creditos
) VALUES
    (501, 'MAT0001', 'Materia Sintetica Uno', 'P01', 101, NULL, 1, 1, 4, 0, 5),
    (502, 'MAT0002', 'Materia Sintetica Dos', 'P01', 101, 501, 2, 1, 3, 2, 5),
    (503, 'MAT0003', 'Materia Sintetica Huerfana', 'P02', 202, 999, 1, 1, 2, 1, 3);

GRANT SELECT ON academico.pln_materias TO dw_fixture_reader;
