-- Contract 03 v1: snapshot through the requested academic cut.
-- JDBC parameters: gestion (smallint) for the null check, then gestion/periodo (smallint).
SELECT
    id_alumno,
    id_ra,
    id_programa,
    id_gestion,
    id_periodo,
    id_acceso,
    nota,
    estado,
    fec_inscripcion,
    _modificado
FROM public.postulantes
WHERE (?::smallint IS NULL OR (id_gestion, id_periodo) <= (?::smallint, ?::smallint))
ORDER BY id_gestion NULLS FIRST, id_periodo NULLS FIRST, id_alumno ASC;
