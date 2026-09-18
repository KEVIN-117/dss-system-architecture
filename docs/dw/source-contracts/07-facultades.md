# Contrato 07 — `academico.alm_programas_facultades`

## Propósito y grano

Catálogo auxiliar de facultades. Una fila por `id_facultad`.

| Campo | Tipo esperado | Nulo | Uso |
| --- | --- | --- | --- |
| `id_facultad` | `integer` | no | clave natural |
| `facultad` | `varchar(100)` | no | nombre |
| `facu_abre` | `varchar(50)` | sí | abreviatura |
| `estado` | `char(1)` | sí | atributo descriptivo |

No contiene PII. Snapshot completo ordenado por `id_facultad ASC`; join autorizado con `alm_programas.id_facultad`. Filas ausentes se registran como referencias huérfanas, sin corregirse en origen.
