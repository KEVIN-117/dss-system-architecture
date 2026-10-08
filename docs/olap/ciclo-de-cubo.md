# Ciclo de creación y uso de cubos

## Modelo mental

Saiku no materializa un cubo como tablas propias. El generador inspecciona un datasource JDBC, produce una definición lógica Mondrian XML y la guarda en el repositorio del servicio. Mondrian resuelve esa definición contra el DW cuando una conexión OLAP la consume. El proceso de generación no crea ni altera tablas del DW.

## Generación guiada de esquema Mondrian

Ruta base: `/rest/saiku/admin/schema-generator`. Todas las operaciones pasan por el límite admin. La sesión del generador es estado temporal en memoria, con TTL deslizante por defecto de 30 minutos; reiniciar el proceso la elimina.

```mermaid
sequenceDiagram
    autonumber
    actor Admin as Administrador OLAP
    participant Sec as Spring Security / adminGuard
    participant API as SchemaGeneratorResource
    participant Store as SchemaGenSessionStore
    participant Orch as SchemaGenOrchestrator
    participant JDBC as DatasourceJdbcConnectionProvider
    participant DW as JDBC DW
    participant Intro as JdbcIntrospector
    participant Infer as SchemaInferrer
    participant Enrich as LlmEnricher
    participant Repo as Saiku Repository
    participant Writer as MondrianSchemaWriter

    Admin->>Sec: POST /start/{dataSourceId}
    Sec->>API: autoriza ROLE_ADMIN
    API->>Store: crea sesión PENDING
    API->>Orch: start(sessionId, dataSourceId), async
    API-->>Admin: 202 Accepted + sessionId
    Orch->>Store: estado INTROSPECTING
    Orch->>JDBC: abrir conexión JDBC
    JDBC->>DW: conectar usando datasource configurado
    DW-->>JDBC: Connection
    Orch->>Intro: introspect(Connection)
    Intro->>DW: DatabaseMetaData: tablas, columnas, imported keys
    DW-->>Intro: metadatos relacionales
    Intro-->>Orch: DbModel
    Orch->>JDBC: cerrar Connection (try-with-resources)
    Orch->>Store: estado INFERRING
    Orch->>Infer: inferir cubos/dimensiones/medidas
    Infer-->>Orch: DraftSchema
    Orch->>Repo: leer sidecar baseline si existe
    Repo-->>Orch: baseline / ausencia
    Orch->>Store: estado ENRICHING + guardar borrador
    Orch->>Enrich: generar sugerencias opcionales
    Enrich-->>Orch: sugerencias / conjunto vacío según proveedor
    Orch->>Store: estado READY, draft y sugerencias

    Admin->>API: GET /{sessionId}/status
    API->>Store: leer estado/progreso
    Store-->>Admin: estado actual
    Admin->>API: GET /{sessionId}/draft
    API->>Store: leer DraftSchema
    Store-->>Admin: borrador
    Admin->>API: GET /{sessionId}/suggestions
    API->>Store: leer sugerencias
    Store-->>Admin: sugerencias
    Admin->>API: POST /{sessionId}/ops
    API->>Store: aplicar OpApplier al borrador y registrar operación
    Store-->>Admin: borrador actualizado / error de validación
    Admin->>API: POST /{sessionId}/save
    API->>Store: obtener draft + opLog
    API->>Writer: writeWithSidecar(draft, opLog)
    Writer->>Writer: serializar XML Mondrian y sidecar generado
    Writer->>Repo: addSchema(XML, datasource path, nombre)
    Writer->>Repo: saveInternalFile(sidecar .generated.json)
    API->>Store: marcar SAVED
    API-->>Admin: 204 No Content
```

### Estados y fallos

```mermaid
stateDiagram-v2
    [*] --> PENDING: start aceptado
    PENDING --> INTROSPECTING: worker comienza
    INTROSPECTING --> INFERRING: DbModel leído y JDBC cerrado
    INFERRING --> ENRICHING: DraftSchema inferido
    ENRICHING --> READY: sugerencias calculadas
    READY --> READY: aplicar operación revisada
    READY --> SAVED: guardar XML + sidecar
    PENDING --> FAILED: fallo asíncrono
    INTROSPECTING --> FAILED: JDBC / metadata falla
    INFERRING --> FAILED: inferencia falla
    ENRICHING --> FAILED: enriquecimiento falla
    READY --> [*]: TTL/expiración
    SAVED --> [*]
    FAILED --> [*]: TTL/expiración
```

`GET status` permite observar la tarea, mientras que draft/suggestions pueden responder conflicto si el borrador todavía no está listo. Las operaciones del usuario se aplican al borrador en memoria y quedan registradas para reproducibilidad mediante el sidecar. Una excepción del pipeline coloca la sesión en `FAILED`; no debe asumirse que las sugerencias de IA son necesarias para producir el esquema base.

## Inspección y significado del modelo

El diagrama siguiente describe clases/metadatos usados por el generador, no tablas de una base OLAP interna. La entidad física del DW depende del datasource concreto y debe documentarse con sus nombres reales al conectarlo.

```mermaid
classDiagram
    class DbModel {
      +List~DbTable~ tables
    }
    class DbTable {
      +String schema
      +String name
      +List~DbColumn~ columns
      +List~DbForeignKey~ foreignKeys
      +Long rowCountEstimate
    }
    class DbColumn {
      +String name
      +int jdbcType
      +String typeName
      +int ordinal
      +boolean nullable
      +boolean primaryKey
    }
    class DbForeignKey {
      +String sourceColumn
      +String targetSchema
      +String targetTable
      +String targetColumn
    }
    class DraftSchema {
      +String name
      +String description
      +List~DraftCube~ cubes
    }
    class DraftCube {
      +String name
      +String sourceFactTable
      +List~DraftDimension~ dimensions
      +List~DraftMeasure~ measures
    }
    class DraftDimension {
      +String name
      +String sourceTable
      +List~DraftHierarchy~ hierarchies
    }
    class DraftHierarchy {
      +String name
      +List~DraftLevel~ levels
    }
    class DraftLevel {
      +String name
      +String column
      +String uniqueMembers
    }
    class DraftMeasure {
      +String name
      +String column
      +String aggregator
      +String formatString
    }
    class DraftJoin {
      +String leftTable
      +String leftColumn
      +String rightTable
      +String rightColumn
    }
    DbModel "1" o-- "*" DbTable : introspección
    DbTable "1" o-- "*" DbColumn
    DbTable "1" o-- "*" DbForeignKey
    DraftSchema "1" o-- "*" DraftCube
    DraftCube "1" o-- "*" DraftDimension
    DraftCube "1" o-- "*" DraftMeasure
    DraftDimension "1" o-- "*" DraftHierarchy
    DraftHierarchy "1" o-- "*" DraftLevel
    DraftCube "1" o-- "*" DraftJoin
```

```mermaid
erDiagram
    DW_TABLE ||--o{ DW_COLUMN : contiene
    DW_TABLE ||--o{ DW_FOREIGN_KEY : declara
    DW_FOREIGN_KEY }o--|| DW_TABLE : referencia
    DW_TABLE ||--o{ DRAFT_CUBE : puede_ser_hecho
    DRAFT_SCHEMA ||--|{ DRAFT_CUBE : agrupa
    DRAFT_CUBE ||--o{ DRAFT_MEASURE : expone
    DRAFT_CUBE ||--o{ DRAFT_DIMENSION : expone
    DRAFT_DIMENSION ||--|{ DRAFT_HIERARCHY : organiza
    DRAFT_HIERARCHY ||--|{ DRAFT_LEVEL : contiene
```

El ER es conceptual: `DW_TABLE`, `DW_COLUMN` y `DW_FOREIGN_KEY` representan resultados de `DatabaseMetaData`; no son entidades persistidas por Saiku. El mapeo real a `DRAFT_*` es inferencial y editable. El XML final especifica cómo Mondrian enlaza hecho, dimensiones, jerarquías, niveles, medidas y joins.

## Activar y consumir el esquema generado

Guardar el XML en el repositorio es un paso de autoría, no prueba suficiente de que el datasource activo lo esté usando. La definición del datasource debe apuntar al catálogo/esquema Mondrian correspondiente (la convención del proyecto usa `mondrian://...`), después refrescarse o redescubrirse, y finalmente ejecutar una consulta pequeña. Esto confirma resolución del catálogo, acceso JDBC y validez de la definición.

## API Cube Designer

`/rest/saiku/admin/cube-designer` contiene endpoints de apoyo distintos al generador: `GET /introspect/{dataSourceId}`, `GET /sample/{dataSourceId}`, `GET /schema/{dataSourceId}`, `POST /convert`, `POST /try-query` y `POST /turn`. Reutiliza datasource/JDBC y aplica guardas administrativas. `/turn` depende del proveedor AI opcional y puede responder 503 si no está configurado. La eliminación de la SPA no elimina estas rutas API; tampoco las convierte en el pipeline de generación anterior.

```mermaid
sequenceDiagram
    autonumber
    actor Admin
    participant Sec as Security / adminGuard
    participant Designer as CubeDesignerResource
    participant DS as DatasourceService
    participant JDBC as DatasourceJdbcConnectionProvider
    participant DW as DW
    participant Mondrian as conversor / motor OLAP

    Admin->>Sec: GET /introspect/{dataSourceId}
    Sec->>Designer: autoriza administrador
    Designer->>DS: resolver datasource
    Designer->>JDBC: abrir conexión JDBC
    JDBC->>DW: consultar metadatos
    DW-->>Designer: tablas y columnas
    Designer-->>Admin: estructura para diseño
    Admin->>Designer: GET /sample/{dataSourceId}?table=...
    Designer->>DW: leer muestra limitada
    DW-->>Designer: filas de ejemplo
    Admin->>Designer: POST /convert o /try-query
    Designer->>Mondrian: convertir/validar consulta o esquema
    Mondrian-->>Designer: resultado o error de validación
    Designer-->>Admin: respuesta JSON
```
