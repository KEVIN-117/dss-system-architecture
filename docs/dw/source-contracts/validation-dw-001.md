# DW-001 — Registro de validación de contratos

## Estado

**Estado actual: pendiente de validación en Jachasun.** Los contratos se derivaron del DDL local `infra/postgres-tx/ddl/ddl_jachasun.sql` y de los documentos de mapeo. Esta evidencia estática no autoriza el cierre de DW-001.

## Hallazgos estáticos

| ID | Hallazgo | Riesgo | Acción de validación real |
| --- | --- | --- | --- |
| V-01 | Existen tablas `postulantes` en varios esquemas. | Extraer postulaciones desde una tabla incorrecta. | Confirmar `public.postulantes` con DSA/TI, propietario, conteo de muestra y tipos. |
| V-02 | `notas_planilla.id_materia` figura como `smallint`; `pln_materias.id_materia`, como `integer`. | Incompatibilidad de join o truncamiento histórico. | Verificar tipos y valores máximos; no aplicar casts en RAW. |
| V-03 | `_fecha_registro` de alumnos y `_fecha_creacion` de notas no prueban captura de actualizaciones. | Pérdida de rectificaciones con carga incremental. | Mantener snapshot por cierre y confirmar comportamiento operativo. |
| V-04 | `uatf_datos.id_loc` y los catálogos geográficos requieren confirmación de cardinalidad. | Enriquecimiento geográfico incompleto. | Medir nulos y huérfanos con muestra acotada. |

## Protocolo de validación en producción

1. Ejecutar con usuario temporal de solo lectura y transacción `READ ONLY`, con `statement_timeout` acordado con TI.
2. Comprobar `CONNECT`, `USAGE` y `SELECT` exclusivamente sobre las nueve fuentes.
3. Para cada contrato, validar existencia, columnas, tipos, PK/índice, muestra limitada, plan `EXPLAIN` y conteo aproximado autorizado.
4. Registrar fecha, responsable, entorno, versión del contrato, resultados y discrepancias; no almacenar PII en la evidencia.
5. DSA valida semántica y filtro de programas; TI/DBA valida acceso, rendimiento y fuente operativa.

## Criterio de aprobación

Cada fuente debe contar con evidencia de los pasos anteriores y aprobación DSA/TI. Las discrepancias se convierten en una corrección de contrato o una issue nueva; no se silencian mediante transformaciones en la extracción.
