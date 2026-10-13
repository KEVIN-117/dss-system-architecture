# Catálogo de variables de entorno

Esta carpeta documenta el contrato de configuración del repositorio DSS-DW-ML. El índice separa variables globales, configuración por servicio y valores por ambiente. Los archivos `.env.example` y `*-env.example.json` son las plantillas ejecutables; esta documentación explica qué significa cada campo y cómo cambia según dónde se ejecuta el proceso.

## Alcance y fuentes

| Documento | Configuración cubierta |
|---|---|
| [Globales y ambientes](globales-y-ambientes.md) | `.env` raíz, reglas compartidas, dev/test/prod, secretos y red Docker |
| [PostgreSQL](postgresql.md) | Base IAM, DW, migrador y pruebas históricas |
| [Keycloak](keycloak.md) | Servidor, realm, conexión IAM y publicación de eventos |
| [keycloak-webhook](keycloak-webhook.md) | Provider que serializa eventos y publica en RabbitMQ |
| [RabbitMQ](rabbitmq.md) | Broker y transporte de eventos de identidad |
| [auth-service](auth-service.md) | Spring Boot, PostgreSQL, OIDC, CORS, RabbitMQ y Swagger |
| [Apache Hop Web](apache-hop.md) | Hop Web y ambientes dev/test/integration/prod |
| [BFF](bff.md) | OAuth/OIDC, sesión, allowlist de portales y servicios backend |
| [Landing](landing.md) | URLs públicas y navegación a portales |
| [Portales](portales.md) | Admin, rector, decano, director y portal de documentación |
| [OLAP Workspace](olap-workspace.md) | Cliente web de análisis OLAP |
| [OLAP Service](olap-service.md) | API Saiku/OLAP, seguridad, almacenamiento e integraciones opcionales |
| [Enigma](enigma.md) | UI SvelteKit para OLAP |
| [Prediction Service](prediction-service.md) | Estado de configuración expuesta en este checkout |
| [ETL Load Manager](etl-loadmanager.md) | Extractor Go, fixtures y pruebas locales |
| [Servicios objetivo sin contrato](servicios-sin-contrato.md) | ETL Service, GraphQL BFF, gateway y frontend de Compose raíz |
| [Pruebas E2E](e2e.md) | Variables de Playwright y contratos de entorno de prueba |
| [CI](ci.md) | Variables provistas por GitHub Actions y configuración de workflows |

## Convenciones

- Una variable es **requerida** cuando la aplicación o el contenedor falla al iniciar o al ejecutar la función si falta. **Opcional** indica que hay un valor por defecto o que habilita una función aparte.
- Los ejemplos describen valores locales o marcadores ficticios. Los secretos deben obtenerse de `.env` ignorado, Docker secrets o un gestor aprobado; nunca deben copiarse a documentación ni a Git.
- `localhost` significa la máquina del usuario cuando se ejecuta directamente. Entre contenedores se usa el nombre DNS del servicio en la red Docker, por ejemplo `rabbitmq`, `auth-service-db` o `keycloak`.
- Variables `NEXT_PUBLIC_*` se incorporan al bundle del navegador. Solo deben contener URLs y otros datos públicos, nunca tokens, contraseñas ni secretos.
- La documentación refleja el checkout al momento de su revisión. Variables de servicios opcionales y arquitectura objetivo se señalan como tales y no implican que el `docker-compose.yml` raíz pueda levantar esos componentes.

## Inventario por componente

| Componente | Fuente principal | Plantilla/ambientes |
|---|---|---|
| Infraestructura raíz | `docker-compose.yml`, `.env.example` | `.env.example` |
| auth-service | `auth-service/src/main/resources/application*.yaml` | `auth-service/.env.example`, profiles Spring |
| BFF y portales | `dss-monorepo/apps/*` | `.env.example` por aplicación |
| Apache Hop | `docker-compose.yml`, scripts y proyecto `dss-uatf-etl` | `environments/*-env.example.json` |
| Load Manager | `etl-layer/loadmanager` | `.env.example` |
| OLAP | `olap-service` | `.env.example` de Enigma y documentación por característica |

## Observación sobre Compose

El Compose raíz declara algunos contextos (`gateway/graphql-bff`, `gateway/traefik`, `frontend/nextjs-spa`) que no aparecen en este checkout. El BFF y los portales actuales viven en `dss-monorepo`; por ello, las variables de este catálogo describen su configuración real, aunque el Compose raíz todavía no los orquesta.
