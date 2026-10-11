# Contrato 04 — `academico.alm_programas`

## Propósito y grano

Catálogo de programas/carreras. Una fila por `id_programa` en cada snapshot completo.

## Campos, claves y controles

| Campo | Tipo esperado | Nulo | Uso |
| --- | --- | --- | --- |
| `id_programa` | `char(3)` | no | clave natural |
| `programa` | `varchar` sin límite declarado | no | descripción |
| `id_facultad` | `smallint` | no | join con facultad |
| `id_nivel` | `smallint` | no | clasificación |
| `nivel` | `varchar(45)` | sí | clasificación |
| `sede` | `varchar(1)` | sí | atributo descriptivo |
| `_tipo_academico` | `char(3)` | no | filtro funcional |
| `activo` | `varchar` sin límite declarado | sí | filtro funcional |

El filtro obligatorio mantiene `_tipo_academico IN ('CAR', 'PRO', 'TES', 'TEM')` y valores activos `1`, `S` o `Y` tras normalizar espacios y mayúsculas. Join autorizado: `id_facultad` con `academico.alm_programas_facultades`.

## Snapshot y controles

Catálogo completo filtrado, ordenado por `id_programa ASC`. Programas fuera de filtro no se eliminan del OLTP ni se transforman aquí; se excluyen de esta extracción y el conteo se registra en el manifiesto.
