# OLAP Service

OLAP corresponde a `olap-service`/Saiku. El launcher se empaqueta como JAR y se ejecuta en una imagen Docker no-root; Compose conserva `saiku-home` en el volumen `olap_home_empty` y publica el servicio solo en loopback. El servicio inicia sin cubos, datasources ni dashboards de demo. El volumen anterior `olap_home` se conserva sin cambios.

| Variable/grupo | Uso |
|---|---|
| `KEYCLOAK_ISSUER_URI`, `KEYCLOAK_JWK_SET_URI` | Verificación JWT OIDC; Compose toma issuer/JWKS de `AUTH_KEYCLOAK_ISSUER_URI` y `AUTH_KEYCLOAK_JWK_SET_URI`, usando el DNS interno `keycloak` para descargar claves. |
| `OLAP_KEYCLOAK_CLIENT_ID` | Client ID cuyas roles OLAP se interpretan; default `olap-service`. Compose lo pasa como `KEYCLOAK_OLAP_CLIENT_ID`. |
| `OLAP_KEYCLOAK_AUDIENCE` | Audiencia esperada en el token; default `olap-service`. Compose lo pasa como `KEYCLOAK_OLAP_AUDIENCE`. |
| `OLAP_PORT` | Puerto local publicado por Compose; default `8088` porque Keycloak usa `8080`. |
| `SAIKU_ADMIN_PASSWORD` | Contraseña fuerte para el usuario local `admin`; Compose la pasa al launcher, que genera/guarda el hash en `saiku-home/users.properties`. Configúrala en `.env` (ignorado por Git). No actives `SAIKU_ALLOW_DEFAULT_ADMIN` en una instancia expuesta. |
| `OLAP_DB_USER`, `OLAP_DB_PASSWORD`, `POSTGRES_DW_NAME` | Usuario/clave de solo lectura y nombre de base que Saiku usa para el DW. El rol `dw_olap_runtime` debe pertenecer a `dw_reader`; la contraseña local se guarda en `.env` y el inicializador la escribe con permisos privados en el volumen `olap_home_empty`. La URL se construye desde `POSTGRES_DW_NAME`, no se asume `dw_integration`. |
| `saiku.home` | Directorio base de configuración, repositorio y datos; default `./saiku-home`. Es propiedad Java, puede suministrarse como system property. |
| `SAIKU_USER`, `SAIKU_PASS` | Credenciales de conexión de integraciones/demo donde estén habilitadas; tratarlas como secretos. |
| `SAIKU_API_KEY` | Token Bearer opcional de servidor MCP según `docs/MCP-SERVER-SPEC.md`; secreto de cuenta de servicio con acceso de solo lectura. |
| `SAIKU_GRAPHQL_MAX_DEPTH`, `SAIKU_GRAPHQL_MAX_COMPLEXITY` | Límites de profundidad/complejidad GraphQL para restringir consultas; consultar defaults del servicio antes de sobrescribir. |
| `AZURE_OPENAI_API_KEY` | Clave opcional Azure OpenAI cuando ese proveedor está habilitado; secreto. |
| `SAIKU_TELEMETRY`, `DO_NOT_TRACK`, `SAIKU_TELEMETRY_EVENT_ENDPOINT` | Control de telemetría; revisar [telemetry](../../olap-service/telemetry/README.md). |
| `SAIKU_DEMO`, `SAIKU_DEMO_GATE_SECRET`, `SAIKU_DEMO_GATE_TTL_DAYS`, `WORKOS_API_KEY`, `WORKOS_CLIENT_ID` | Gate de demo opcional; claves privadas no se versionan. |
| `SAIKU_AI_ASK_PROVIDER`, `SAIKU_AI_ASK_TIMEOUT_SECONDS`, `SAIKU_AI_MAX_STEPS`, `SAIKU_AI_CHAIN_*`, `SAIKU_AI_DASHBOARD_MAX_TILES` | Ajustes de preguntas/AI. Mantener límites acotados y revisar guías de AI; no habilitar proveedores externos accidentalmente. |
| `ANTHROPIC_API_KEY`, `OPENAI_API_KEY` | API keys opcionales de proveedores LLM; secretos. Los tests de contrato pueden omitirlos si no se ejecutan. |
| `SAIKU_AI_OSSIE_SAMPLES_TTL_MINUTES` | TTL de muestras/cache de esquema AI, opcional. |
| `saiku.ai.ask.*`, `saiku.schemagen.llm.*` | Propiedades Java para proveedor/modelo/endpoint de features AI; defaults de proveedor `noop` o vacío según el bean. |
| `SAIKU_INSTALL_KEY` | Clave de instalación/descifrado, si aplica al despliegue; secreto de infraestructura. |

Para crear la imagen local en Windows, ejecuta `olap-service/docker/build-local.ps1`; primero corre `spotless:check` en todos los módulos con código Java (excluye el BOM, que no hereda el plugin) y luego `mvn verify` para el launcher y sus dependencias, prepara el JAR que consume el Dockerfile y construye `dss-olap-service:local`. Después inicia `docker compose up -d olap-service`. El endpoint local es `http://localhost:8088`; desde otro contenedor de la red `dss-net`, usa `http://olap-service:8080`. El Compose pasa al servicio el issuer público que figura en el token y la URL JWKS interna de Docker (`keycloak:8080`).

Para aplicar el arranque vacío, define `SAIKU_ADMIN_PASSWORD` en `.env`, ejecuta `olap-service/docker/build-local.ps1` para regenerar el JAR y la imagen, y luego `docker compose up -d --force-recreate olap-service`. El launcher conserva el hash en el volumen `olap_home_empty`, así que el acceso no depende de mantener la contraseña en archivos versionados. En este Compose, `SAIKU_DEMO=false` está fijado: no se cargan datasets ni dashboards de ejemplo.

El servicio `olap-home-init` instala en cada `docker compose up` el esquema `infra/olap/schemas/uatf-rendimiento-academico.xml`, el descriptor `infra/olap/datasources/uatf-dw.sds` y las credenciales JDBC privadas dentro de `olap_home_empty`. El XML y el `.sds` quedan juntos en `repository/data/unknown/datasources`, la ruta del repositorio que resuelve `mondrian://datasources/...`. Depende de `postgres-dw` saludable, pero no carga datos: el DW debe haber sido poblado por sus migraciones y procesos ETL. `olap-service` espera a que la inicialización termine antes de arrancar. El modo demo sigue deshabilitado. En el Compose local, `SAIKU_AI_POLICY=aggregated` permite devolver celdas agregadas para el BFF y `SAIKU_AI_KANONYMITY=5` enmascara celdas con menos de cinco filas; el BFF agrega `Attempt Count` internamente y lo elimina de la respuesta pública. Este ajuste local no debe copiarse a otros entornos sin revisar su política de exposición.

La lista refleja variables encontradas por búsqueda estática en código y puede incluir módulos opcionales no cargados en todos los modos. Para producción: issuer/audience OIDC correctos, secretos externos, almacenamiento persistente, TLS y telemetría conforme a política. El puerto host de Compose se limita a loopback; la publicación externa debe hacerse detrás del gateway aprobado.
