# Contrato 08 — `public.prs_colegios`

## Propósito y grano

Catálogo auxiliar de colegios de procedencia. Una fila por `id_colegio`.

| Campo | Tipo esperado | Nulo | Uso |
| --- | --- | --- | --- |
| `id_colegio` | `integer` | no | clave natural |
| `colegio` | `varchar(65)` | no | descripción |
| `tipo`, `turno`, `area` | `char(1)` | no | clasificación |
| `cod_loc` | `smallint` | no | join con localidad |
| `_estado` | `char(1)` | no | estado operativo |

No contiene PII. Snapshot completo, ordenado por `id_colegio ASC`; joins autorizados con `uatf_datos.id_colegio` y `lugar_localidad.cod_loc`.
