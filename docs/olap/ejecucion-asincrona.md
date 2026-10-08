# Ejecución asíncrona y ciclo de resultados

Además de `POST /rest/saiku/api/query/execute`, `Query2Resource` proporciona `POST /rest/saiku/api/query/execute-async`, `GET .../async/{id}/status`, `GET .../async/{id}/result` y `DELETE .../async/{id}/cancel`. El servicio comprueba la propiedad del trabajo contra el principal autenticado y devuelve 404 tanto para IDs inexistentes como para trabajos ajenos; un administrador puede gestionar trabajos ajenos conforme a las reglas del servicio. Los IDs y estados son del trabajo de consulta; no confundirlos con el UUID y TTL de Schema Generator.

```mermaid
sequenceDiagram
    autonumber
    actor Client
    participant Sec as Spring Security
    participant R as Query2Resource
    participant Jobs as gestor de ejecución async
    participant Thin as ThinQueryService
    participant OLAP as olap4j / Mondrian u OSSIE
    participant Store as estado/resultado del job

    Client->>Sec: POST /rest/saiku/api/query/execute-async + ThinQuery
    Sec->>R: autentica
    R->>Jobs: encolar ejecución
    Jobs-->>R: jobId
    R-->>Client: respuesta de aceptación + jobId
    par Trabajo en segundo plano
        Jobs->>Thin: ejecutar query
        Thin->>OLAP: ejecutar contra backend seleccionado
        OLAP-->>Thin: resultado o error
        Thin-->>Jobs: resultado
        Jobs->>Store: registrar estado final y resultado/error
    and Consultas de seguimiento
        Client->>R: GET /async/{jobId}/status
        R->>Store: obtener estado
        Store-->>R: queued/running/completed/failed/cancelled
        R-->>Client: estado
    end
    Client->>R: GET /async/{jobId}/result
    R->>Store: validar estado y recuperar resultado
    Store-->>R: resultado listo / aún no disponible
    R-->>Client: QueryResult o respuesta de estado/error
    opt Cancelar trabajo
        Client->>R: DELETE /async/{jobId}/cancel
        R->>Jobs: cancelar si todavía es cancelable
        Jobs-->>R: cancelado / demasiado tarde
        R-->>Client: resultado de cancelación
    end
```

El cliente debe tratar el ID como opaco, sondear estado con backoff y solicitar resultado solo cuando el estado indique `DONE`; antes de eso el endpoint de resultado responde conflicto. Las operaciones restringen acceso al propietario, con excepción administrativa prevista en el servicio. El resultado y su retención dependen de la implementación/configuración del gestor; no inferir persistencia durable tras reinicio sin verificar el store concreto.
