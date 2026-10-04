# Contrato 03 — `public.postulantes`

## Propósito y grano

Intento de postulación/admisión. El grano es una fila por `public.postulantes.id_alumno`. El DDL local declara `UNIQUE (id_alumno)`, por lo que esta tabla no representa postulaciones repetidas por programa/periodo para la misma persona. El flujo 6.5 implementa ese grano; TI debe confirmar la restricción en Jachasun real antes de producción.

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

Para histórico y cargas semestrales, se acota por `(id_gestion, id_periodo)` hasta el cierre solicitado y se ordena por `id_gestion, id_periodo, id_alumno`. La validez de `public.postulantes`, frente a tablas homónimas de otros esquemas, es un bloqueo explícito de aprobación. El comentario del DDL local describe `A` como aprobado y `P` como reprobado; Hop mapea solo esos valores y deja códigos distintos/null como desconocidos hasta aprobación funcional DSA/TI.
