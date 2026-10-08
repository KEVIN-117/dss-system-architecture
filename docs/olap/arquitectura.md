# Arquitectura C4 del OLAP Service

El runtime desplegable es **un proceso Java**: el launcher inicia Jetty y sirve el WAR del API. `saiku-core` reúne servicios y recursos usados por ese proceso; no es otro microservicio en ejecución. La ubicación de despliegue (VM, contenedor/orquestador y topología de red) no se puede deducir del repositorio, por eso el nodo se expresa como host genérico.

## C1 — Contexto

Quién consume el servicio, qué sistemas externos intervienen y los protocolos observados.

```mermaid
C4Context
  title Contexto del OLAP Service
  Person(operador, "Operador OLAP", "Configura datasources y administra esquemas/cubos")
  System(olap, "OLAP Service Saiku", "API analítica para descubrimiento y ejecución de consultas")
  System_Ext(bff, "DSS BFF", "Invoca endpoints OLAP y reenvía el Bearer token")
  System_Ext(keycloak, "Keycloak", "Emite JWT y publica claves JWKS")
  SystemDb(dw, "Data Warehouse", "PostgreSQL u otro motor JDBC configurado")
  Rel(operador, olap, "Administra conexión y esquema", "HTTPS/JSON + Bearer")
  Rel(bff, olap, "Consulta cubos y recibe resultados", "HTTPS/JSON + Bearer")
  Rel(olap, keycloak, "Obtiene/renueva claves públicas JWKS", "HTTPS")
  Rel(olap, dw, "Introspecciona metadatos y ejecuta SQL/MDX", "JDBC")
```

El operador puede usar Swagger/curl u otra consola; la interfaz del antiguo frontend Saiku no forma parte del cliente del DSS.

## C2 — Contenedores

El WAR y Jetty se muestran dentro del mismo contenedor ejecutable porque el launcher los hospeda en el mismo proceso. `saiku-home` es almacenamiento de archivos/sesiones montable, no un servidor de base de datos.

```mermaid
C4Container
  title Contenedores del OLAP Service
  Person(operador, "Operador OLAP", "")
  System_Ext(bff, "DSS BFF", "")
  System_Ext(keycloak, "Keycloak", "")
  SystemDb(dw, "DW externo", "PostgreSQL/JDBC", "Modelo dimensional consultado")
  System_Boundary(olap, "OLAP Service") {
    Container(runtime, "Saiku Launcher + saiku-api.war", "Java 21; Jetty 12 EE10; Spring 6; Jersey 3", "Un proceso HTTP; REST/JAX-RS en /rest y seguridad Spring")
    ContainerDb(home, "saiku-home", "Filesystem", "Datasources, esquemas Mondrian, repositorio y sesiones persistentes")
    Container(mem, "SchemaGenSessionStore", "Memoria JVM", "Borradores/sugerencias temporales; TTL deslizante")
  }
  Rel(operador, runtime, "Administra datasource/esquema", "HTTPS")
  Rel(bff, runtime, "Consume REST", "HTTPS/JSON + Bearer")
  Rel(runtime, keycloak, "Resuelve JWKS", "HTTPS")
  Rel(runtime, dw, "Lee metadatos y ejecuta consultas", "JDBC")
  Rel(runtime, home, "Lee/escribe configuración y esquemas", "Filesystem API")
  Rel(runtime, mem, "Mantiene progreso del diseñador", "In-process")
```

## C3 — Componentes del contenedor API

```mermaid
C4Component
  title Componentes del API Saiku
  Container_Ext(bff, "DSS BFF", "Next.js", "Cliente de backend")
  Container_Ext(keycloak, "Keycloak", "OIDC/JWKS", "Proveedor de identidad")
  ContainerDb(dw, "Data Warehouse", "JDBC", "Fuente analítica configurada")
  ContainerDb(home, "saiku-home", "Filesystem", "Repositorio persistente")
  Container_Boundary(api, "Saiku Launcher + API WAR") {
    Component(sec, "Spring Security", "Spring Security 6", "JWT decoder, URL authorization, roles")
    Component(jaxrs, "SaikuJerseyApplication", "Jersey/JAX-RS", "Registra recursos, filtros, mappers y OpenAPI")
    Component(resources, "REST Resources", "JAX-RS", "Admin, schema-generator, discovery, query, AI query")
    Component(adapter, "SecurityContext Adapter", "JAX-RS filter", "Proyecta autenticación Spring al SecurityContext JAX-RS")
    Component(app, "OLAP Services", "Java", "ThinQueryService, OlapDiscoverService, SchemaGenOrchestrator")
    Component(conn, "Datasource/Connection Manager", "Saiku", "Carga datasources y entrega conexiones")
    Component(engine, "Mondrian + olap4j / OSSIE", "Mondrian, JDBC", "Ejecuta MDX o SQL según el datasource")
    Component(repo, "DatasourceService + Repository", "Saiku filesystem repository", "Persiste descriptores, esquemas XML y sidecars")
  }
  Rel(bff, sec, "Envía Bearer token", "HTTPS")
  Rel(sec, keycloak, "Obtiene claves públicas", "JWKS/HTTPS")
  Rel(sec, jaxrs, "Autoriza petición autenticada", "Servlet filter chain")
  Rel(jaxrs, resources, "Enruta REST y aplica providers")
  Rel(resources, adapter, "Usa contexto de seguridad")
  Rel(resources, app, "Invoca caso de uso")
  Rel(app, conn, "Resuelve datasource/cubo")
  Rel(conn, engine, "Crea/recupera conexión")
  Rel(engine, dw, "Introspecciona/consulta", "JDBC")
  Rel(repo, home, "Lee y escribe", "Filesystem")
  Rel(app, repo, "Carga/guarda esquemas y datasources")
```

## C4 — Despliegue observado

El repositorio define una imagen Docker, pero no evidencia el clúster o proveedor donde se ejecuta. Este dibujo separa esa incógnita del contenido verificable del contenedor.

```mermaid
C4Deployment
  title Despliegue lógico del OLAP Service
  Deployment_Node(host, "Host de ejecución no especificado", "JDK 21 runtime / Docker si se usa la imagen") {
    Deployment_Node(proc, "Proceso Saiku", "Saiku Launcher") {
      Container(runtime, "Saiku Launcher + API WAR", "Java; Jetty EE10", "HTTP :8080 según configuración")
    }
    Deployment_Node(storage, "Volumen saiku-home", "Filesystem persistente") {
      ContainerDb(home, "Repositorio y sesiones", "Filesystem", "Datos mutables del servicio")
    }
  }
  Deployment_Node(infra, "Servicios externos", "Fuera del despliegue OLAP") {
    ContainerDb(dw, "Data Warehouse", "PostgreSQL/JDBC", "DW configurado")
    Container(keycloak, "Keycloak", "OIDC/JWKS", "Issuer/realm configurado")
  }
  Rel(runtime, home, "Persiste contenido y sesiones", "Filesystem")
  Rel(runtime, dw, "Ejecuta consultas", "JDBC")
  Rel(runtime, keycloak, "Lee JWKS", "HTTPS")
```

## Relaciones que guían los diagramas de secuencia

| Flujo | Entrada | Servicio principal | Salida |
|---|---|---|---|
| Generación de cubo | `POST /rest/saiku/admin/schema-generator/start/{dataSourceId}` | `SchemaGenOrchestrator` | Borrador editable; XML y sidecar al guardar |
| Descubrimiento | recursos REST `/rest/saiku/...` | `OlapDiscoverService` / `OlapMetaExplorer` | conexiones, catálogos, esquemas, cubos y miembros |
| MDX | `POST /rest/saiku/api/query/execute` | `ThinQueryService` | `CellSet` convertido en `QueryResult` JSON o Arrow |
| OSSIE | mismo endpoint con `queryType=OSSIE` | `OssieQueryService` | `CellDataSet` convertido a JSON; no pasa por Mondrian |
| Autenticación | `Authorization: Bearer …` | Spring Security decoder/converter | `Authentication` con autoridades Saiku |

## Evidencia

- Launcher: `saiku-launcher/src/main/java/org/saiku/launcher/SaikuLauncher.java`.
- Mapeo Servlet REST: `saiku-api/src/main/webapp/WEB-INF/web.xml` (`/rest/*`); XMLA va separado por `/xmla/*`.
- Jersey: `saiku-core/saiku-web/src/main/java/org/saiku/web/rest/SaikuJerseyApplication.java`.
- Wiring Spring: `saiku-api/src/main/webapp/WEB-INF/saiku-beans.xml` y `applicationContext-saiku.xml`.
- Datasource/Mondrian: `RepositoryDatasourceManager`, `SaikuConnectionFactory`, `OlapDiscoverService`.
- Autenticación JWT: `KeycloakJwtDecoderFactory`, `SaikuKeycloakJwtAuthenticationConverter`.

## Huecos y supuestos

- Operador y BFF aparecen como consumidores previstos del microservicio; sus procesos viven fuera de este repositorio.
- El host/despliegue real se desconoce. No se dibuja una topología de Kubernetes/Traefik sin manifiestos que la prueben.
- El DW mostrado es una dependencia externa configurable; no se afirma que el XML UATF ya esté instalado.
