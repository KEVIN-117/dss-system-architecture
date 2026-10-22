# Dimensiones conformadas

Orden MVP: programa y facultad; materia y programa; periodo/cierre; admisión; estudiante/persona. Las cinco pipelines de dimensión cuentan con preparación privada probada en fixtures. Usan las dimensiones físicas de `0004`; las SK se resuelven mediante rutinas permitidas de `etl_control`, y los lotes se sellan en staging privado para el publisher atómico. Hop no escribe directamente en `dw`.

La integración sintética prepara 2 programas, 3 materias, 3 periodos y 2 registros de admisión. La fase 6.4 prepara 3 estudiantes nuevos en su primer snapshot; la aserción confirma cinco lotes privados y cero publicación por el smoke.

`pl_dim_estudiante_scd2_mvp.hpl` consume `academico.alumnos`, perfila datos personales por `id_ra` y enriquece atributos con colegios/localidades. La identidad histórica y SCD2 es `id_alumno`; `id_ra` es un atributo de perfil y puede compartirse entre alumnos. La rutina `etl_control.prepare_hop_student_scd2` calcula el hash canónico, compara versiones por `id_alumno` y prepara `CLOSE`/`INSERT` bajo la fecha efectiva del cierre DSA. Hash idéntico es no-op; falta de perfil para un RA informado, fecha fuera de orden o cambios incompatibles del mismo alumno en el mismo corte bloquean la carga. Filas ausentes no se consideran bajas.

La integración prueba una transición completa mediante el publisher atómico dentro de un bloque transaccional que se revierte. La carga de hechos y la resolución de sus surrogate keys temporales corresponden a 6.5.
