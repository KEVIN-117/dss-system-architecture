-- Contract: docs/dw/source-contracts/02-alumnos.md
-- Full source-observed snapshot; _fecha_registro is not a watermark.
SELECT
    id_alumno,
    id_programa,
    id_ra,
    fec_inscripcion,
    fec_egreso,
    id_plan,
    estado,
    tipo_alumno,
    _fecha_registro
FROM academico.alumnos
ORDER BY id_alumno ASC;
