-- Contract: docs/dw/source-contracts/05-materias.md
-- Full catalog snapshot.
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
    creditos
FROM academico.pln_materias
ORDER BY id_materia ASC;
