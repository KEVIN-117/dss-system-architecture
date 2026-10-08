# OLAP Service: arquitectura y flujos

Este documento describe el servicio que existe en el repositorio hoy: el runtime de Saiku conservado como API, con Jetty embebido, Jersey/JAX-RS, Spring XML, Mondrian/olap4j y la integración Resource Server de Keycloak. Los diagramas siguen el código y la configuración encontrados; no representan la arquitectura Spring Boot que se propuso originalmente para OLAP.

## Recorrido recomendado

1. [Arquitectura C4](arquitectura.md): contexto, contenedores, componentes y despliegue.
2. [Arranque y datasources](arranque-y-datasources.md): launcher, Spring, repositorio, refresh y descubrimiento de cubos.
3. [Ciclo de vida de un cubo](ciclo-de-cubo.md): introspección, borrador, sugerencias, edición, XML Mondrian y activación.
4. [Autenticación y autorización](autenticacion-y-autorizacion.md): JWT, roles OLAP, Spring Security y contexto JAX-RS.
5. [Descubrimiento y consulta MDX](consulta-mdx-y-descubrimiento.md): petición REST síncrona desde el BFF hasta CellSet/JSON.
6. [Consulta SQL/OSSIE](consulta-ossie.md): ruta alternativa que no ejecuta MDX ni pasa por Mondrian.
7. [Ejecución asíncrona](ejecucion-asincrona.md): ciclo de trabajo, propiedad del resultado y cancelación.

Los fuentes Mermaid editables están en [`diagrams/`](diagrams/). Cada página incluye sus diagramas y explica los pasos y bifurcaciones relevantes.

## Diagramas fuente

- C4: [contexto](diagrams/01-contexto.mermaid), [contenedores](diagrams/02-contenedores.mermaid), [componentes](diagrams/03-componentes-api.mermaid), [despliegue](diagrams/04-despliegue.mermaid).
- Secuencias: [arranque](diagrams/05-arranque.mermaid), [refresh de datasource](diagrams/06-datasource-refresh.mermaid), [Keycloak](diagrams/07-autenticacion-keycloak.mermaid), [generación de esquema](diagrams/08-ciclo-schema-generator.mermaid), [consulta MDX](diagrams/09-consulta-mdx.mermaid), [consulta OSSIE](diagrams/10-consulta-ossie.mermaid), [consulta asíncrona](diagrams/11-consulta-asincrona.mermaid), [Cube Designer](diagrams/12-cube-designer.mermaid).

## Inventario de arquitectura y evidencias

| Elemento | Responsabilidad | Evidencia principal |
|---|---|---|
| Launcher + Jetty | Inicia el WAR `saiku-api` dentro de Jetty EE10 y expone REST en `/rest/*`. | `saiku-launcher/src/main/java/org/saiku/launcher/SaikuLauncher.java`, `saiku-api/src/main/webapp/WEB-INF/web.xml` |
| Jersey | Registra OpenAPI, filtros/mappers y los beans JAX-RS de Spring con `@Path`. | `saiku-core/saiku-web/src/main/java/org/saiku/web/rest/SaikuJerseyApplication.java` |
| Spring Security | Valida JWT Bearer y autoriza por ruta/rol; adapta autoridades de Keycloak a roles Saiku. | `saiku-api/src/main/webapp/WEB-INF/applicationContext-saiku.xml`, `saiku-core/saiku-web/src/main/java/org/saiku/web/security/keycloak/` |
| Repositorio Saiku | Persiste descriptores `.sds`, esquemas `.xml`, consultas y artefactos bajo `saiku-home`; el backend es filesystem/JCR-compatible. | `saiku-core/saiku-service/src/main/java/org/saiku/repository/FilesystemRepositoryManager.java`, `saiku-core/saiku-service/src/main/java/org/saiku/service/datasource/RepositoryDatasourceManager.java` |
| Gestor de datasource/conexión | Carga y actualiza datasources por workspace y entrega conexiones a servicios OLAP/OSSIE. | `saiku-core/saiku-service/src/main/java/org/saiku/service/datasource/RepositoryDatasourceManager.java`, `saiku-core/saiku-service/src/main/java/org/saiku/datasources/connection/SaikuConnectionFactory.java` |
| Descubrimiento OLAP | Proyecta conexiones/catalogs/schemas/cubes y metadatos para recursos REST. | `saiku-core/saiku-service/src/main/java/org/saiku/service/olap/OlapDiscoverService.java`, `saiku-core/saiku-service/src/main/java/org/saiku/olap/discover/OlapMetaExplorer.java` |
| Ejecución MDX | Actualiza/ejecuta `ThinQuery`, obtiene `CellSet`, lo convierte a DTO matricial. | `saiku-core/saiku-service/src/main/java/org/saiku/service/olap/ThinQueryService.java` |
| Generador de esquema | Introspecciona JDBC, infiere un borrador Mondrian y persiste XML más sidecar. | `saiku-core/saiku-web/src/main/java/org/saiku/web/rest/resources/schemagen/SchemaGeneratorResource.java`, `saiku-core/saiku-service/src/main/java/org/saiku/service/schema/generate/` |
| DW | Base relacional externa elegida en la configuración del datasource. El servicio la consulta; este flujo no crea sus tablas ni aplica migraciones. | `saiku-core/saiku-service/src/main/java/org/saiku/service/schema/generate/introspect/JdbcIntrospector.java`, datasource configurado en Saiku |

## Qué persistencia existe

- **DW externo:** PostgreSQL u otro motor compatible, consultado por JDBC/Mondrian u OSSIE según el datasource.
- **Repositorio Saiku:** archivos y metadatos de datasources, esquemas Mondrian y contenido de usuario bajo `saiku-home`; no es una base relacional OLAP propia.
- **Sesiones de generación de esquema:** `SchemaGenSessionStore` vive en memoria y aplica TTL deslizante de 30 minutos; no sobrevive a reinicios del proceso.
- **Sesiones HTTP:** Jetty persiste sesiones en su `FileSessionDataStore` según la configuración del launcher.

El diagrama de clases/entidades del generador representa el **modelo de metadatos JDBC** (tablas, columnas y claves foráneas) que el código inspecciona. No inventa entidades físicas del DW UATF; el esquema físico académico vigente debe documentarse cuando esté disponible/configurado.

## Límites y puntos que no se deben confundir

- **Registrar un datasource no crea un cubo.** El datasource contiene conexión y catálogo; el esquema Mondrian define cubos, dimensiones, jerarquías y medidas.
- **Generar XML no equivale a crear tablas en el DW.** El generador lee metadatos y escribe el XML en el repositorio de Saiku.
- **Guardar XML no garantiza por sí solo que un datasource ya activo lo esté usando.** El catálogo del datasource debe apuntar al esquema y la conexión debe refrescarse; después hay que comprobar descubrimiento y consulta.
- **JWT válido no implica alcance académico correcto.** La integración valida identidad/roles. El filtrado por facultad/carrera depende de las reglas de datasource/Mondrian y debe verificarse aparte.
- **Keycloak no participa en cada consulta mediante login.** El BFF reenvía el Bearer token; el Resource Server lo verifica localmente con las claves públicas cacheadas/recuperadas desde JWKS.
- **Las rutas REST están bajo `/rest`.** Los recursos JAX-RS añaden su propio prefijo, por ejemplo `/rest/saiku/api/query/execute`.

## Huecos observados que condicionan producción

1. Aún debe enlazarse un esquema Mondrian real con el modelo físico DW UATF y conciliar medidas académicas.
2. El objetivo de menos de 500 ms y la capacidad bajo concurrencia requieren mediciones con consultas/datos representativos.
3. Debe cerrarse la matriz de autorización para `OLAP_ADMIN`/`OLAP_USER` y el alcance por facultad/carrera.
4. La imagen y su healthcheck deben confirmarse contra el artefacto API-only que se desplegará.
5. La ejecución por defecto del generador se cablea con `newCachedThreadPool`; no es un pool acotado. Revisar límites si se habilita a usuarios concurrentes.

Estos puntos son límites conocidos de la documentación estática; no son resultados de una prueba de despliegue.
