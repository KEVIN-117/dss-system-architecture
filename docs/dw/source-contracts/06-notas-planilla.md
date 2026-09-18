# Contrato 06 — `academico.notas_planilla`

## Propósito y grano

Intento de cursado. Una fila por `id_matricula`; conserva alumno, materia, gestión, periodo y grupo de la calificación registrada.

## Campos, claves y controles

| Campo | Tipo esperado | Nulo | Uso |
| --- | --- | --- | --- |
| `id_matricula` | `integer` | no | clave natural del hecho |
| `id_gestion`, `id_periodo` | smallint | no | corte académico |
| `id_alumno` | `integer` | no | estudiante |
| `id_materia` | `smallint` local | no | materia; tipo a validar |
| `grupo` | `smallint` | sí | paralelo/grupo |
| `nota`, `nota_2da`, `nota_ex_mesa` | numeric | sí | medidas RAW |
| `pparcial`, `sparcial`, `tparcial`, `cparcial` | numeric | sí | medidas RAW |
| `estado`, `observacion`, `tipo` | texto | no/sí/sí | estado operativo |
| `_fecha_creacion`, `_hash` | timestamp/texto | sí | auditoría, no watermark normativo |

No contiene PII directa en la selección. Joins autorizados solo como relaciones de contrato: `id_alumno` con alumnos y `id_materia` con materias; no se ejecutan en la extracción.

## Snapshot y controles

Se extrae histórico hasta `(snapshot_gestion, snapshot_periodo)`, ordenado por `id_gestion, id_periodo, id_matricula`. No se usa `_fecha_creacion` para omitir rectificaciones. Notas fuera de rango, FKs huérfanas, duplicados y nulos se preservan en RAW y se reportan.
