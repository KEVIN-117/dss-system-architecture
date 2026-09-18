# Contrato 03 — `public.postulantes`

## Propósito y grano

Intento de postulación/admisión. El grano provisional es una fila por identificador operativo `id_alumno`; su unicidad respecto de programa y periodo se valida contra Jachasun antes de aprobación final.

## Campos, claves y privacidad

| Campo | Tipo esperado | Nulo | Uso |
| --- | --- | --- | --- |
| `id_alumno` | `integer` | no | identificador operativo de postulación |
| `id_ra` | `varchar(10)` | no | join con persona |
| `id_programa` | `char(3)` | no | programa postulado |
| `id_gestion`, `id_periodo` | `smallint` | sí | corte académico |
| `id_acceso` | `char(2)` | sí | modalidad de admisión |
| `nota` | `integer` | sí | puntaje de admisión |
| `estado` | `char(1)` | sí | estado operativo |
| `fec_inscripcion`, `_modificado` | fecha/timestamp | sí/no | auditoría |

Contiene datos personales indirectos. Joins autorizados: `id_ra` con `public.uatf_datos` y `id_programa` con `academico.alm_programas`. No se extraen credenciales, observaciones ni datos de contacto.

## Snapshot y controles

Para histórico y cargas semestrales, se acota por `(id_gestion, id_periodo)` hasta el cierre solicitado y se ordena por `id_gestion, id_periodo, id_alumno`. La validez de `public.postulantes`, frente a tablas homónimas de otros esquemas, es un bloqueo explícito de aprobación.
