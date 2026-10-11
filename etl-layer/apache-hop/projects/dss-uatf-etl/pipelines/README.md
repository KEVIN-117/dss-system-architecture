# Pipelines de `dss-uatf-etl`

Los pipelines se segmentan por responsabilidad, mantienen parámetros comunes del workflow y reportan su resultado vía `etl_control`. El primer vertical implementado es solo `uatf_datos` + control; no es una carga completa ni publica nada en `dw`. Los directorios reservados son:

| Dominio | Responsabilidad |
| --- | --- |
| `control/` | Llamadas a funciones permitidas y recolección de estado; sin DML directo en control. |
| `source/` | Un pipeline por contrato DW-001, `Table Input` explícito, SELECT en Jachasun y validación de columnas/tipos/clave antes del manifiesto completo. |
| `dimensions/` | Carga de dimensiones conformadas, con SCD2 solo donde está especificado y surrogate keys resueltas de forma determinista. |
| `facts/` | Un pipeline por grano: admisión, intento de cursado y snapshot de retención. Nunca combinar granos. |
| `quality/` | Validaciones de esquema, unicidad, nulos, dominios, huérfanos, rangos y conteos antes de publicación. |

Reglas generales: usar solo los dos objetos de conexión metadata; nombres calificados; columnas explícitas (sin `SELECT *`); SQL con valores parametrizados, no concatenados; timeouts configurados; errores bloqueantes no se convierten en valores sustitutos; no emitir datos personales a logs.

La guía y referencias específicas viven en los README de cada dominio. No añadir una salida a `dw` hasta que el pipeline invoque la rutina publisher atómica aprobada.
