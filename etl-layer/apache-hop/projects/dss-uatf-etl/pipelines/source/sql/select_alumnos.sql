-- Contract 02 v1: full academic-student snapshot; no watermark.
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
