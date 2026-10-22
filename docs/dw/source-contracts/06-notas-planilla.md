# Contrato 06 — `academico.notas_planilla`

## Propósito y grano

Intento de cursado. Una fila por `id_matricula`; conserva alumno, materia, gestión, periodo y grupo de la calificación registrada.

## Campos, claves y controles

| Campo | Tipo esperado | Nulo | Uso |
| --- | --- | --- | --- |
| `id_matricula` | `integer` | no | clave primaria y natural del hecho |
| `id_gestion`, `id_periodo` | smallint | no | corte académico |
| `id_alumno` | `integer` | no | estudiante |
| `id_materia` | `smallint` | no | FK local a `pln_materias.id_materia` integer; validar compatibilidad y valores en Jachasun |
| `grupo` | `smallint` | sí | paralelo/grupo |
| `nota` | `numeric(5,2)` | sí | nota final de origen |
| `nota_2da`, `nota_ex_mesa`, parciales | `numeric` | sí | medidas de origen |
| `estado` | `char(1)` | no | estado operativo sin dominio de aprobación documentado |
| `observacion`, `tipo` | `varchar`, `varchar(1)` | sí | metadatos operativos |
| `_fecha_creacion` | `timestamp` | sí | auditoría, no watermark normativo |

El DDL verificado de Jachasun no contiene una columna `_hash`; el contrato v2 no la exige ni la consulta. El hash del esquema que se registra en `etl_control` se calcula sobre la firma de columnas observada, no se extrae de una columna de origen.

No contiene PII directa en la selección. Joins autorizados solo como relaciones de contrato: `id_alumno` con alumnos y `id_materia` con materias; no se ejecutan en la extracción.

## Snapshot y controles

Se extrae histórico hasta `(snapshot_gestion, snapshot_periodo)`, ordenado por `id_gestion, id_periodo, id_matricula`. El DDL local define `PRIMARY KEY (id_matricula)`, FK a alumnos y materias, y unicidad compuesta por gestión/periodo/alumno/materia/grupo/`_unique`. No se usa `_fecha_creacion` para omitir rectificaciones. Hop reportará notas fuera de rango, FKs huérfanas, duplicados y nulos con evidencia saneada, sin corregir el origen ni exigir RAW persistente. Las incidencias bloqueantes impiden la publicación; el tratamiento de otras incidencias requiere reglas aprobadas, no valores sustitutos inventados.
