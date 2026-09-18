# Contrato 09 — `public.lugar_localidad`

## Propósito y grano

Catálogo auxiliar geográfico. Una fila por `cod_loc`.

| Campo | Tipo esperado | Nulo | Uso |
| --- | --- | --- | --- |
| `cod_loc` | `integer` | no | clave natural |
| `localidad` | `varchar` | sí | descripción |
| `cod_pais`, `cod_dep`, `cod_prov` | numéricos | sí | jerarquía geográfica |

No contiene PII. Snapshot completo, ordenado por `cod_loc ASC`. La cardinalidad con `uatf_datos.id_loc` y `prs_colegios.cod_loc` se valida contra la instancia real antes de aprobar el contrato.
