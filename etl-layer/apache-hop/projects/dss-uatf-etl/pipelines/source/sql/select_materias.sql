-- Contract 05 v2: OLTP _creditos is exposed as the stable DW field creditos.
SELECT
    id_materia,
    sigla,
    materia,
    id_programa,
    id_plan,
    id_materia_padre,
    ciclo,
    nivel_academico,
    hrs_teoricas,
    hrs_practicas,
    _creditos AS creditos
FROM academico.pln_materias
ORDER BY id_materia ASC;
