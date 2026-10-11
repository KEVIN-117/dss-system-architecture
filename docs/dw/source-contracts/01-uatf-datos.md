# Contrato 01 — `public.uatf_datos`

## Propósito y grano

Perfil demográfico mínimo de una persona identificada por `id_ra`. Una fila por persona en el estado observado del snapshot.

## Campos, claves y privacidad

| Campo | Tipo esperado | Nulo | Uso |
| --- | --- | --- | --- |
| `id_ra` | `varchar(10)` | no | clave natural y join con alumnos/postulantes |
| `id_sexo` | `varchar(1)` | sí | atributo demográfico |
| `estado_civil` | `smallint` | no | atributo SCD2 futuro |
| `nac_pais` | `integer` | sí | atributo demográfico |
| `id_colegio` | `smallint` | sí | join auxiliar con colegios |
| `id_loc` | `smallint` | sí | referencia geográfica a validar |
| `egr_gestion` | `smallint` | sí | cohorte de egreso |
| `_modificado` | `timestamp` | no | metadato de auditoría, no watermark normativo |

Contiene datos personales indirectos. No se extraen nombres, documento, teléfono, dirección, correo ni fecha de nacimiento para este alcance. Join autorizado: `id_ra` con `academico.alumnos` y `public.postulantes`; `id_colegio` con `public.prs_colegios`.

## Snapshot y controles

Extracción completa por cierre; orden estable `id_ra ASC`. El DDL local define `id_ra` como clave primaria. Si la instancia operativa contradice esa condición, el extractor rechaza el snapshot y lo deja incompleto; no deduplica ni omite silenciosamente registros. Hop reportará las referencias a colegio/localidad ausentes y aplicará la política de calidad aprobada sin corregir el origen ni exigir persistencia RAW. TI/DBA valida esquema y privilegios; DSA valida el uso funcional de atributos.

### Compatibilidad histórica de DW-011 (servicio pausado)

Las reglas de paginación y hash siguientes describen el extractor Go conservado, no una dependencia de Hop. El MVP mantiene los campos y controles del contrato; adaptar placeholders/lectura JDBC requiere versión y checksum propios si cambia el SQL.

DW-011 recorre el snapshot con keyset pagination: el cursor anterior y el tamaño de lote se envían como parámetros (`$1`, `$2`), con `id_ra > cursor`, `ORDER BY id_ra ASC` y lookahead de una fila. `id_ra` debe ser no nulo, único y estrictamente creciente para ese recorrido; si se observa una clave duplicada o desordenada, la ejecución falla y el manifiesto no se completa. La unicidad en la instancia productiva sigue pendiente de confirmación DSA/TI.

La implementación Go pausada acepta exclusivamente la consulta canónica v1 cuyo SHA-256 LF normalizado es `61518492c7c7d9d92fbc64902fcc6ec974d0676999902f2cb7c40bdfccd56ae8`. También verifica en el catálogo nombres, OID de tipo, longitud, nulabilidad, colación efectiva e índice único válido de `id_ra`. La unicidad/orden se rigen por la colación PostgreSQL, no por una comparación binaria de Go. Un `id_ra`, `estado_civil` o `_modificado` nulo, o una clave duplicada, bloquea el snapshot. Según el DDL fuente, `id_colegio` e `id_loc` son `smallint`; los fixtures activos deben conservar esos tipos.
