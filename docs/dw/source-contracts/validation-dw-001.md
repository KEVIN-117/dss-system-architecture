# DW-001 — Registro de validación de contratos

## Estado

**Estado del MVP: contratos integrados y validados en las pruebas sintéticas de la issue #133.** Los contratos parten del DDL versionado `infra/postgres-tx/ddl/ddl_jachasun.sql`, los análisis de datos compartidos por el responsable y las decisiones funcionales recibidas de DSA. La cuenta de solo lectura para Jachasun fue confirmada por el responsable del proyecto. La issue #133 está cerrada; este registro no afirma una carga productiva ni sustituye la autorización de un futuro despliegue.

El DDL local es la fuente de verdad para los tipos, longitudes, nulabilidad y claves de los contratos estáticos y validadores Hop. Los fixtures reutilizados por pruebas deben reproducir esos atributos para las columnas extraídas; una discrepancia con una instancia real se registra como hallazgo de validación, no se resuelve relajando el contrato basado en el fixture.

## Hallazgos y resolución en el MVP

| ID | Hallazgo | Resolución / tratamiento |
| --- | --- | --- |
| V-01 | Hay objetos homónimos `postulantes` en varios esquemas. | El contrato del MVP consulta explícitamente `public.postulantes`; no usa resolución implícita de esquema. |
| V-02 | `notas_planilla.id_materia` y `pln_materias.id_materia` pueden diferir de tipo en el DDL. | El contrato conserva las columnas de origen y el join se prueba en el ambiente de integración; el DDL versionado sigue siendo la referencia para el mapeo y no se introduce cast silencioso en la extracción. |
| V-03 | Los timestamps de alumnos/notas no garantizan captura completa de modificaciones. | Se mantiene snapshot completo por cierre; los timestamps son metadatos, no watermarks de completitud. |
| V-04 | Las relaciones geográficas pueden ser nulas o huérfanas. | El flujo valida y trata la ausencia según la política de calidad y los miembros técnicos; no corrige filas fuente ni las omite de forma silenciosa. |

## Controles antes de una ejecución productiva

1. Usar la cuenta OLTP de solo lectura y comprobar `current_user` y grants mediante consultas de catálogo de solo lectura.
2. Confirmar que el endpoint productivo contiene las fuentes/columnas esperadas por el DDL y los contratos versionados.
3. Acordar con TI límites de tiempo, planes y volumen antes de una extracción histórica; no ejecutar conteos o joins masivos sin autorización.
4. Registrar fecha, responsable, ambiente, versión de contrato, resultados y discrepancias; no almacenar PII en evidencia.
5. DSA autoriza el cierre/corte y TI/DBA valida conectividad, privilegios y capacidad de operación del ambiente.

## Criterio de aprobación

El MVP y sus contratos no tienen trabajo de implementación abierto en la issue #133. Estos controles se ejecutan como checklist de despliegue al apuntar a un ambiente productivo; cualquier diferencia real con el DDL debe corregirse mediante una nueva versión aprobada del contrato, no mediante una relajación silenciosa.
