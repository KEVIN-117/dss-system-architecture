# DW-001 — Catálogo de contratos de extracción Jachasun

Este directorio define los campos, claves, tipos y filtros autorizados para extraer Jachasun (OLTP). Para el MVP de la issue #133, **Apache Hop consultará directamente Jachasun** con una cuenta de solo lectura y validará y transformará los datos. Las filas preparadas pasan por el buffer privado `etl_work` requerido por el publisher atómico antes de publicarse en `dw`; este buffer no es staging RAW ni sustituye la consulta directa a OLTP. La [base consolidada](../mvp-direct-hop.md) pausa la dependencia del Load Manager en Go y de su staging de extracción, conservando el servicio y su evidencia histórica para el futuro.

## Política de extracción

- **Carga inicial:** se extrae todo el historial disponible de las fuentes transaccionales y un snapshot completo de los catálogos.
- **Cargas recurrentes:** se extrae un snapshot completo al cierre académico configurado. `academico.alumnos` y `academico.notas_planilla` no usan watermark como criterio de completitud.
- **Consistencia:** las lecturas serán de solo lectura y con tiempos acotados. La implementación Hop deberá demostrar la consistencia entre fuentes: varias conexiones `REPEATABLE READ` y un `run_id` común no garantizan un snapshot compartido. Inicio, corte, conteos y hashes se registran en `etl_control`.
- **Transformaciones:** no se permiten joins analíticos, SCD, limpieza, flags ni métricas en las consultas fuente. Esas responsabilidades pertenecen a Hop, sin capa RAW persistente obligatoria.

## Fuentes incluidas

| Contrato | Fuente | Tipo | Destino lógico |
| --- | --- | --- | --- |
| [01](01-uatf-datos.md) | `public.uatf_datos` | principal | persona/estudiante |
| [02](02-alumnos.md) | `academico.alumnos` | principal | estudiante |
| [03](03-postulantes.md) | `public.postulantes` | principal | admisión |
| [04](04-programas.md) | `academico.alm_programas` | principal | programa |
| [05](05-materias.md) | `academico.pln_materias` | principal | materia |
| [06](06-notas-planilla.md) | `academico.notas_planilla` | principal | cursado |
| [07](07-facultades.md) | `academico.alm_programas_facultades` | auxiliar | programa |
| [08](08-colegios.md) | `public.prs_colegios` | auxiliar | estudiante |
| [09](09-localidades.md) | `public.lugar_localidad` | auxiliar | estudiante |

No forman parte del primer DW relacional: `academico.docentes`, `moodle.*`, fuentes de personal, ni las tablas de otros esquemas homónimas a las fuentes aprobadas.

Matrícula y graduación quedan fuera del MVP y de estos nueve contratos. `actas_graduacion.graduados` es la fuente oficial indicada para el futuro hecho de graduación, pero requiere un contrato propio y resolver su semántica y correspondencia temporal antes de ampliar las extracciones o permisos.

## Parámetros y evidencia de snapshot

El orquestador asigna un UUID `run_id` y entrega `snapshot_gestion`, `snapshot_periodo` y `snapshot_closed_at` a las consultas que requieren acotar hechos por periodo. Los catálogos y perfiles sin versión temporal se extraen completos y registran esos parámetros en el manifiesto, no como filtros artificiales.

Por cada fuente, el manifiesto debe almacenar nombre de contrato y versión, checksum de consulta, orden estable, corte, tiempos, conteo leído, SHA-256 del esquema y estado. El flujo directo no exige artefactos RAW. Hop debe certificar el conjunto de nueve manifiestos y la calidad antes de publicar. No se corrigen referencias huérfanas en origen: se registran incidencias saneadas y se aplica la política aprobada de bloqueo o miembro técnico. Una clave obligatoria nula, duplicada o conflictiva no se omite silenciosamente.

Las referencias a RAW y a la consulta canónica del extractor DW-011 describen compatibilidad histórica del servicio Go pausado. No obligan al MVP a generar archivos ni escribir `staging.raw_uatf_datos`. El uso de `etl_work` por el publisher de Hop es independiente de ese staging de extracción. La adaptación de placeholders a JDBC debe conservar columnas/filtros y registrar su versión/hash; no se reutiliza un hash si cambió el SQL.

## Acceso y aprobación

La conexión usa exclusivamente `DB_TX_HOST`, `DB_TX_PORT`, `DB_TX_NAME`, `DB_TX_USER` y `DB_TX_PASS`. La cuenta productiva debe tener únicamente `CONNECT` a la base, `USAGE` sobre `public` y `academico`, y `SELECT` sobre las nueve tablas aprobadas. No se conceden `INSERT`, `UPDATE`, `DELETE`, `TRUNCATE`, `CREATE`, `ALTER` ni acceso por defecto a otros esquemas.

El responsable técnico de aprobación es TI/DBA de Jachasun; el responsable funcional es DSA. La aprobación definitiva requiere completar [validation-dw-001.md](validation-dw-001.md) contra la instancia real.
