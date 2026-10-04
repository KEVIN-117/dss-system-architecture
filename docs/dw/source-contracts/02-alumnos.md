# Contrato 02 — `academico.alumnos`

## Propósito y grano

Estado académico de pregrado. Una fila por `id_alumno` observada en el snapshot completo del cierre.

## Campos, claves y privacidad

| Campo | Tipo esperado | Nulo | Uso |
| --- | --- | --- | --- |
| `id_alumno` | `integer` | no | clave natural de estudiante |
| `id_programa` | `char(3)` | no | join con programa |
| `id_ra` | `varchar(10)` | sí | join con persona |
| `fec_inscripcion` | `date` | no | auditoría académica |
| `fec_egreso` | `date` | sí | control de egreso futuro |
| `id_plan` | `smallint` | sí | referencia curricular |
| `estado` | `char(1)` | no | atributo SCD2 futuro |
| `tipo_alumno` | `char(1)` | no | atributo SCD2 futuro |
| `_fecha_registro` | `timestamp` | sí | metadato, no watermark normativo |

`id_ra` es dato personal indirecto. Join autorizado: `id_ra` con `public.uatf_datos` y `id_programa` con `academico.alm_programas`.

## Snapshot y controles

La fuente se lee completa, ordenada por `id_alumno ASC`. No se usa `_fecha_registro` para detectar modificaciones: el DDL no demuestra que represente todas las actualizaciones. Hop reportará nulos de `id_ra`, programas inexistentes y duplicados de `id_alumno` mediante evidencia saneada y aplicará la política aprobada de identidad/bloqueo; no requiere RAW persistente ni corrige el origen.
