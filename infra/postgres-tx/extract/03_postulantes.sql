-- Contract: docs/dw/source-contracts/03-postulantes.md
-- Parameter types: :snapshot_gestion smallint, :snapshot_periodo smallint.
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
WHERE (id_gestion, id_periodo) <= (:snapshot_gestion, :snapshot_periodo)
ORDER BY id_gestion ASC, id_periodo ASC, id_alumno ASC;
