# Data Warehouse — documentación del MVP

La issue #133 está implementada, fusionada en `main` y cerrada. La arquitectura entregada del MVP es **Jachasun → Apache Hop → dw**, con `etl_control` como control lateral. La [base consolidada](mvp-direct-hop.md) es el punto de entrada para alcance, arquitectura y estado final.

El [contrato de ejecución Hop](hop-execution-contract.md) define parámetros y la API/gates SQL. El flujo vertical completo —nueve fuentes, cinco dimensiones, tres hechos y publicación atómica— fue ejecutado con éxito en el entorno de integración Docker y sus regresiones están en CI. Esto valida el MVP con fixtures; no equivale a una carga productiva ni a autorización para operar contra producción.

El [informe de cierre del Req. 6](hop-req-6-progress.md) registra la implementación y evidencia de integración. Las tareas futuras de activación productiva se administran como operación/despliegue, no como trabajo pendiente para completar la issue #133.

## Especificaciones vigentes

- [Contratos de las nueve fuentes](source-contracts/README.md) y [registro de evidencia y límites de validación](source-contracts/validation-dw-001.md).
- [Modelo lógico: admisión, cursado y retención/deserción](dimensional-model.md).
- [Dimensiones físicas de `0004` y SCD2 de estudiante en `0008`](conformed-dimensions.md) y [política SCD2](scd2-person-student-policy.md).
- [Calendario de cierres DSA](academic-closure-calendar.md).
- [Control de ejecuciones y manifiestos](execution-control.md).
- [Esquemas, roles y migraciones](analytical-platform-foundations.md).
- [Fixtures y estrategia de pruebas](test-data-strategy.md).

## Implementación conservada para el futuro

[Load Manager y snapshots paginados](loadmanager-paginated-snapshots.md) documenta el servicio Go pausado, no la arquitectura activa del MVP. Matrícula y graduación también quedan fuera del MVP; la fuente oficial de graduación registrada para su análisis futuro es `actas_graduacion.graduados`.
