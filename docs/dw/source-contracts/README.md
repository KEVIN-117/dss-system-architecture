# DW-001 — Catálogo de contratos de extracción Jachasun

Este directorio define el contrato entre Jachasun (OLTP) y la capa `staging` del Data Warehouse. Es la fuente normativa para el futuro Load Manager; Apache Hop no debe consultar Jachasun directamente.

## Política de extracción

- **Carga inicial:** se extrae todo el historial disponible de las fuentes transaccionales y un snapshot completo de los catálogos.
- **Cargas recurrentes:** se extrae un snapshot completo al cierre académico configurado. `academico.alumnos` y `academico.notas_planilla` no usan watermark como criterio de completitud.
- **Consistencia:** una ejecución representa el estado observado durante una transacción de solo lectura; `run_id`, instante de inicio, corte solicitado, conteo, hash de esquema y hashes de artefactos se conservan en el manifiesto de staging.
- **Transformaciones:** no se permiten joins analíticos, SCD, limpieza, flags ni métricas en las consultas de este directorio. Esas responsabilidades pertenecen a Staging/Hop.

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

## Parámetros y artefactos de snapshot

El orquestador asigna un UUID `run_id` y entrega `snapshot_gestion`, `snapshot_periodo` y `snapshot_closed_at` a las consultas que requieren acotar hechos por periodo. Los catálogos y perfiles sin versión temporal se extraen completos y registran esos parámetros en el manifiesto, no como filtros artificiales.

Por cada fuente, el manifiesto debe almacenar: nombre de contrato y versión, consulta/commit, orden estable, corte, inicio/fin, conteo leído, hash SHA-256 del esquema esperado, hash de cada artefacto RAW y estado. Los registros con claves nulas, duplicadas u huérfanas no se corrigen en origen: se conservan y se notifican para tratamiento posterior en Staging.

## Acceso y aprobación

La conexión usa exclusivamente `DB_TX_HOST`, `DB_TX_PORT`, `DB_TX_NAME`, `DB_TX_USER` y `DB_TX_PASS`. La cuenta productiva debe tener únicamente `CONNECT` a la base, `USAGE` sobre `public` y `academico`, y `SELECT` sobre las nueve tablas aprobadas. No se conceden `INSERT`, `UPDATE`, `DELETE`, `TRUNCATE`, `CREATE`, `ALTER` ni acceso por defecto a otros esquemas.

El responsable técnico de aprobación es TI/DBA de Jachasun; el responsable funcional es DSA. La aprobación definitiva requiere completar [validation-dw-001.md](validation-dw-001.md) contra la instancia real.
