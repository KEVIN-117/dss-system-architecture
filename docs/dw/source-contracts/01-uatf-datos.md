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

Extracción completa por cierre; orden estable `id_ra ASC`. Duplicados de `id_ra` o referencias a colegio/localidad ausentes se reportan en el manifiesto y permanecen en RAW. TI/DBA valida esquema y privilegios; DSA valida el uso funcional de atributos.
