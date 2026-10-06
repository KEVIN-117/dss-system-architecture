# Consultas OSSIE

`ThinQueryService` detecta el tipo OSSIE y deriva a `OssieQueryService` antes de construir una consulta MDX/olap4j. Este backend es un camino distinto de Mondrian y no debe describirse como si cada query OSSIE ejecutara MDX.

```mermaid
sequenceDiagram
    autonumber
    actor Client
    participant Sec as Spring Security
    participant R as Query2Resource
    participant Thin as ThinQueryService
    participant OSSIE as OssieQueryService
    participant Provider as proveedor/conexión OSSIE
    participant Convert as conversión CellDataSet

    Client->>Sec: POST /rest/saiku/api/query/execute + ThinQuery tipo OSSIE
    Sec->>R: autentica y permite
    R->>Thin: execute(query)
    Thin->>Thin: detectar queryType=OSSIE
    Thin->>OSSIE: ejecutar consulta OSSIE
    OSSIE->>Provider: resolver y ejecutar contra backend OSSIE
    Provider-->>OSSIE: filas/columnas/resultados
    OSSIE-->>Thin: resultado OSSIE
    Thin->>Convert: convertir a CellDataSet
    Convert-->>R: QueryResult
    R-->>Client: JSON / formato negociado
```

La autenticación HTTP es común a ambos backends; la autorización sobre objetos/filas del motor OSSIE depende de su implementación y configuración. No asumir que roles de Keycloak se traducen automáticamente a reglas de seguridad de datos dentro de OSSIE: verificar el servicio concreto y el modelo de permisos antes de exponerlo a usuarios finales.
