# Contrato 04 v3 — `academico.alm_programas`

## Propósito y grano

Catálogo de programas/carreras. Una fila por `id_programa` en cada snapshot completo.

## Campos, claves y controles

| Campo | Tipo esperado | Nulo | Uso |
| --- | --- | --- | --- |
| `id_programa` | `char(3)` | no | clave natural |
| `programa` | `varchar(50)` | no | descripción |
| `id_facultad` | `smallint` | no | join con facultad |
| `id_nivel` | `smallint` | no | clasificación |
| `nivel` | `varchar(45)` | sí | clasificación |
| `sede` | `varchar(1)` | sí | atributo descriptivo |
| `_tipo_academico` | `char(3)` | no | filtro funcional |
| `activo` | `varchar` sin límite declarado | sí | filtro funcional |

El filtro obligatorio mantiene `_tipo_academico IN ('CAR', 'PRO', 'TES', 'TEM')` y `activo = 'A'` tras normalizar espacios y mayúsculas. TI/DSA confirmó que `A` identifica programas activos. Otros valores, incluido `B`, no se interpretan ni se incluyen. Join autorizado: `id_facultad` con `academico.alm_programas_facultades`.

## Snapshot y controles

Catálogo completo filtrado, ordenado por `id_programa ASC`. Programas fuera de filtro no se eliminan del OLTP ni se transforman aquí; se excluyen de esta extracción y el conteo se registra en el manifiesto.

## Historial de versiones

La versión 2 corrige la longitud de `programa` a `varchar(50)`, conforme al DDL confirmado de Jachasun.

La versión 3 corrige el dominio de actividad usando la confirmación de TI/DSA: solo `A` representa un programa activo. No cambia el grano ni las columnas extraídas; ajusta únicamente el filtro funcional.
