# Data Warehouse — documentación del MVP

La decisión vigente para la issue #133 es **Jachasun → Apache Hop → dw**, con `etl_control` como control lateral. La [base consolidada](mvp-direct-hop.md) es el punto de entrada para alcance, objetos existentes, migraciones pendientes y orden de implementación.

El [contrato de ejecución Hop](hop-execution-contract.md) define parámetros y la API/gates SQL añadidos en 0010. Existe un smoke vertical ejecutable y el publisher atómico fue probado con fixture sintético; la extracción/transformación completa de nueve fuentes y la validación contra Jachasun real siguen pendientes.

El seguimiento incremental de la implementación Req. 6 está en [hop-req-6-progress.md](hop-req-6-progress.md); el avance de las consultas y pruebas de fuente no equivale al ETL completo.

## Especificaciones vigentes

- [Contratos de las nueve fuentes](source-contracts/README.md) y [validación pendiente DSA/TI](source-contracts/validation-dw-001.md).
- [Modelo lógico: admisión, cursado y retención/deserción](dimensional-model.md).
- [Dimensiones físicas de `0004` y SCD2 de estudiante en `0008`](conformed-dimensions.md) y [política SCD2](scd2-person-student-policy.md).
- [Calendario de cierres DSA](academic-closure-calendar.md).
- [Control de ejecuciones y manifiestos](execution-control.md).
- [Esquemas, roles y migraciones](analytical-platform-foundations.md).
- [Fixtures y estrategia de pruebas](test-data-strategy.md).

## Implementación conservada para el futuro

[Load Manager y snapshots paginados](loadmanager-paginated-snapshots.md) documenta el servicio Go pausado, no la arquitectura activa del MVP. Matrícula y graduación también quedan fuera del MVP; la fuente oficial de graduación registrada para su análisis futuro es `actas_graduacion.graduados`.
