# Contrato 03 — `public.postulantes`

## Propósito y grano

Intento de postulación/admisión. El grano implementado es una fila por `public.postulantes.id_alumno`. El DDL versionado declara `UNIQUE (id_alumno)`, por lo que este contrato no representa postulaciones repetidas por programa/periodo para la misma persona. El flujo integrado aplica ese grano y detiene la carga si los datos contradicen la unicidad.

## Campos, claves y privacidad

| Campo | Tipo esperado | Nulo | Uso |
| --- | --- | --- | --- |
| `id_alumno` | `integer` | no | identificador operativo único de postulación (`UNIQUE` en el DDL local) |
| `id_ra` | `varchar(10)` | no | join con persona |
| `id_programa` | `char(3)` | no | programa postulado |
| `id_gestion`, `id_periodo` | `smallint` | sí | corte académico |
| `id_acceso` | `char(2)` | sí | modalidad de admisión |
| `nota` | `integer` | sí | puntaje de admisión |
| `estado` | `char(1)` | sí | estado operativo |
| `fec_inscripcion`, `_modificado` | fecha/timestamp | sí/no | auditoría |

Contiene datos personales indirectos. Joins autorizados: `id_ra` con `public.uatf_datos` y `id_programa` con `academico.alm_programas`. No se extraen credenciales, observaciones ni datos de contacto.

## Snapshot y controles

Para histórico y cargas por cierre, se acota por `(id_gestion, id_periodo)` y se ordena por `id_gestion, id_periodo, id_alumno`. La consulta califica explícitamente `public.postulantes`; no resuelve tablas homónimas de otros esquemas. La definición funcional recibida interpreta `A` como aprobado y `P` como reprobado; códigos distintos o nulos no se convierten en esos estados y permanecen desconocidos.
