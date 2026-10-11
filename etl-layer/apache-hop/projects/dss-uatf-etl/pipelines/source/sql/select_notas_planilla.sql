-- Contract 06 v1: all attempts through the requested academic cut.
-- JDBC parameters: gestion (smallint) for the null check, then gestion/periodo (smallint).
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
WHERE (?::smallint IS NULL OR (id_gestion, id_periodo) <= (?::smallint, ?::smallint))
ORDER BY id_gestion ASC, id_periodo ASC, id_matricula ASC;
