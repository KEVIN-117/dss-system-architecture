# OLAP Service

OLAP corresponde a `olap-service`/Saiku. Este checkout contiene varias opciones de ejecución y características, por lo que no hay un único `.env.example` raíz para el servicio. Su perfil Enigma mantiene `olap-service/enigma/.env.example`; las integraciones opcionales se detallan en la documentación interna de OLAP.

| Variable/grupo | Uso |
|---|---|
| `KEYCLOAK_ISSUER_URI`, `KEYCLOAK_JWK_SET_URI` | Verificación JWT OIDC en el API/proxy cuando se usa esa integración. |
| `KEYCLOAK_OLAP_CLIENT_ID` | Client ID OLAP; default `olap-service` en `saiku-beans.xml`. |
| `KEYCLOAK_OLAP_AUDIENCE` | Audiencia esperada; default `olap-service`. |
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

La lista refleja variables encontradas por búsqueda estática en código y puede incluir módulos opcionales no cargados en todos los modos. Para prod: OIDC con issuer/audience correctos, secretos externos, almacenamiento persistente, TLS y telemetría conforme a política. Compose raíz solo declara `olap-service` como build context, pero no configura estas variables.
