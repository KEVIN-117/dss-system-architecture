# Contrato 05 — `academico.pln_materias`

## Propósito y grano

Catálogo curricular. Una fila por `id_materia` en el snapshot completo.

## Campos, claves y controles

| Campo | Tipo esperado | Nulo | Uso |
| --- | --- | --- | --- |
| `id_materia` | `integer` | no | clave natural |
| `sigla`, `materia` | char/varchar | no | descripción |
| `id_programa`, `id_plan` | char/integer | sí | contexto curricular |
| `id_materia_padre` | `integer` | sí | relación curricular futura |
| `ciclo`, `nivel_academico` | integer/smallint | sí | nivel |
| `hrs_teoricas`, `hrs_practicas`, `creditos` | numéricos | sí | carga académica |

No contiene PII. Los joins curriculares se realizarán en la transformación Hop, después de la lectura contractual, sin requerir RAW persistente. La compatibilidad de tipo con `academico.notas_planilla.id_materia` se valida en la instancia real.

## Snapshot y controles

Catálogo completo, ordenado por `id_materia ASC`, sin watermark. Duplicados, materias sin programa y padres inexistentes se reportan sin corrección en origen.
