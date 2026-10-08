# Arranque, repositorio y datasources

Esta página sigue el recorrido desde el proceso Java hasta una conexión OLAP disponible. El launcher inicia el contenedor HTTP; Spring arma los servicios; el repositorio de Saiku conserva definiciones de datasource y esquemas; Mondrian/olap4j abre conexiones hacia el DW cuando un flujo necesita consultarlo.

## 1. Arranque del servicio

```mermaid
sequenceDiagram
    autonumber
    actor Operador
    participant JVM as Java / SaikuLauncher
    participant Jetty as Jetty 12 EE10
    participant War as saiku-api.war
    participant Spring as Spring ApplicationContext
    participant Jersey as Jersey / SaikuJerseyApplication
    participant Repo as RepositoryDatasourceManager

    Operador->>JVM: java -jar saiku-4.8.0.jar serve --port --home
    JVM->>JVM: parsea argumentos y prepara home/configuración
    JVM->>Jetty: crea servidor, conectores y handlers EE10
    Jetty->>War: despliega saiku-api.war
    War->>Spring: carga applicationContext-saiku.xml y saiku-beans.xml
    Spring->>Spring: construye servicios, managers, seguridad y datasource beans
    Spring->>Repo: init-method=load
    Repo->>Repo: enumera datasources/esquemas del repositorio del home
    War->>Jersey: inicializa servlet mapeado en /rest/*
    Jersey->>Jersey: registra filtros, OpenAPI, mappers y recursos @Path de Spring
    Jetty-->>Operador: listener HTTP listo
```

El arranque HTTP no equivale a que todas las conexiones al DW ya estén abiertas. El repositorio se carga durante la inicialización; conexiones nativas pueden crearse o refrescarse por demanda según el `ConnectionManager` y el recurso invocado.

## 2. Registrar o actualizar un datasource

```mermaid
sequenceDiagram
    autonumber
    actor Admin as Administrador OLAP
    participant Sec as Spring Security
    participant R as AdminResource
    participant DS as DatasourceService
    participant RM as RepositoryDatasourceManager
    participant Repo as Saiku Repository
    participant CM as ConnectionManager
    participant Factory as SaikuConnectionFactory
    participant DW as Data Warehouse

    Admin->>Sec: POST /rest/saiku/admin/datasources (Bearer JWT)
    Sec->>Sec: valida JWT y exige ROLE_ADMIN
    Sec->>R: permite la petición
    R->>DS: addDatasource(definición)
    DS->>RM: persistir definición .sds
    RM->>Repo: guarda archivo de datasource con validación de ruta
    DS->>CM: refreshConnection(id)
    CM->>Factory: construir conexión desde la definición
    Factory->>DW: abrir conexión nativa según driver/protocolo
    DW-->>Factory: conexión / error del driver
    Factory-->>CM: SaikuOlapConnection u otro backend compatible
    CM-->>DS: conexión registrada o excepción
    DS-->>R: resultado
    R-->>Admin: respuesta HTTP
```

La API expone operaciones administrativas de listado, alta, modificación, borrado, carga/actualización de esquema y refresh. El endpoint de refresh implementado es `GET /rest/saiku/admin/datasources/{id}/refresh`. El límite de seguridad de `/rest/saiku/admin/**` se aplica antes de llegar al recurso.

## 3. Descubrimiento de conexiones y metadatos

```mermaid
sequenceDiagram
    autonumber
    actor Client as Cliente
    participant Sec as Spring Security
    participant R as OlapDiscoverResource
    participant Discover as OlapDiscoverService
    participant CM as ConnectionManager
    participant Conn as SaikuOlapConnection / olap4j
    participant DW as Mondrian / DW

    Client->>Sec: GET /rest/saiku/{username}/discover/... (Bearer JWT)
    Sec->>R: autentica y autoriza
    R->>Discover: solicitar conexiones/esquemas/cubos
    Discover->>CM: obtener conexión por datasource
    CM->>Conn: buscar conexión existente o crearla
    Conn->>DW: obtener catálogo y metadatos OLAP
    DW-->>Conn: catálogos, cubos, dimensiones y miembros
    Conn-->>Discover: metadatos olap4j
    Discover-->>R: DTOs de descubrimiento
    R-->>Client: JSON
```

Descubrimiento devuelve metadatos del catálogo OLAP que el datasource presenta. No crea automáticamente un cubo ni modifica el DW.
