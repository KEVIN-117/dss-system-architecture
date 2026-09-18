-- Contract: docs/dw/source-contracts/06-notas-planilla.md
-- Parameter types: :snapshot_gestion smallint, :snapshot_periodo smallint.
SELECT
    id_matricula,
    id_gestion,
    id_periodo,
    id_alumno,
    id_materia,
    grupo,
    nota,
    nota_2da,
    nota_ex_mesa,
    pparcial,
    sparcial,
    tparcial,
    cparcial,
    estado,
    observacion,
    tipo,
    _fecha_creacion,
    _hash
FROM academico.notas_planilla
WHERE (id_gestion, id_periodo) <= (:snapshot_gestion, :snapshot_periodo)
ORDER BY id_gestion ASC, id_periodo ASC, id_matricula ASC;
