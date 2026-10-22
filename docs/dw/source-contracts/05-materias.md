# Contrato 05 v2 — `academico.pln_materias`

## Propósito y grano

Catálogo curricular. Una fila por `id_materia` en el snapshot completo.

## Campos, claves y controles

| Campo | Tipo esperado | Nulo | Uso |
| --- | --- | --- | --- |
| `id_materia` | `integer` | no | clave natural |
| `sigla` | `char(7)` | no | descripción |
| `materia` | `varchar` sin límite declarado | no | descripción |
| `id_programa` | `char(3)` | sí | contexto curricular |
| `id_plan` | `integer` | sí | contexto curricular |
| `id_materia_padre` | `integer` | sí | relación curricular futura |
| `ciclo` | `integer` | sí | nivel |
| `nivel_academico` | `smallint` | sí | nivel |
| `hrs_teoricas`, `hrs_practicas` | `smallint` | sí | carga académica |
| `_creditos` → `creditos` | `smallint` | no | carga académica; alias de salida para mantener el contrato dimensional |

No contiene PII. Los joins curriculares se realizarán en la transformación Hop, después de la lectura contractual, sin requerir RAW persistente. La compatibilidad de tipo con `academico.notas_planilla.id_materia` se valida en la instancia real.

## Snapshot y controles

Catálogo completo, ordenado por `id_materia ASC`, sin watermark. Duplicados, materias sin programa y padres inexistentes se reportan sin corrección en origen. El DDL real declara la columna física `_creditos SMALLINT NOT NULL DEFAULT 0`; la extracción la proyecta como `creditos` para mantener estable el nombre consumido por `DIM_MATERIA`.

La versión 2 corrige el nombre físico y la nulabilidad de créditos conforme al DDL de Jachasun; la salida analítica conserva `creditos`.
