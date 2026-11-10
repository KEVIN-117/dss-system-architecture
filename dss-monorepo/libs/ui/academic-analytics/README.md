# Academic analytics

Reportes académicos compartidos por los portales de Rector y Director. Cada vista consulta el cubo correspondiente mediante GraphQL del BFF; el alcance académico y las restricciones de privacidad se aplican en el servidor.

Las tablas filtran y paginan los resultados cargados. Las consultas solicitan como máximo 500 filas; la interfaz informa cuando alcanza ese límite.

Verificación: `bun nx run academic-analytics:typecheck` y `bun nx run academic-analytics:lint`. Las pruebas de integración de las vistas se ejecutan desde el proyecto `@dss-monorepo/director-dashboard`.
