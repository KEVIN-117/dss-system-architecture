# Apache Hop Web

Fuentes: Compose raíz, `etl-layer/apache-hop/scripts/start-hop-web.sh` y plantillas `etl-layer/apache-hop/projects/dss-uatf-etl/environments/*-env.example.json`.

## Variables del proceso Hop Web

| Variable | Obligatoria | Uso |
|---|---|---|
| `HOP_WEB_VERSION` | No | Tag de imagen, default `2.19.0`. |
| `HOP_WEB_PORT` | No | Puerto host loopback, default 8081 → 8080. |
| `HOP_PROJECT_NAME` | Sí | Proyecto Hop; Compose lo fija a `dss-uatf-etl`. |
| `HOP_PROJECT_FOLDER` | Sí | Directorio del proyecto dentro del contenedor. |
| `HOP_ENVIRONMENT_NAME` | Sí | Ambiente seleccionado; `dev`, `test`, `integration` o `prod`. |
| `HOP_ENVIRONMENT_CONFIG_FILE_NAME_PATHS` | Sí | Ruta del archivo de perfil activo. Se construye desde el nombre de ambiente. |
| `HOP_ADDITIONAL_ENVIRONMENT_NAMES` | Opcional | Perfiles adicionales registrados en UI; default `dev,test`. No incluir prod en instancia local. |
| `HOP_SHARED_JDBC_FOLDERS` | Compose | Ruta de drivers JDBC montados en solo lectura. |
| `HOP_OPTIONS` | Compose | Propiedades JVM con hosts/puertos/nombres DW y OLTP. No colocar secretos aquí. |

## Variables JDBC por perfil

Cada JSON define `DSS_DW_HOSTNAME`, `DSS_DW_PORT`, `DSS_DW_DATABASE`, `DSS_DW_USERNAME`, `DSS_DW_PASSWORD`, `DSS_DW_URL`; `OLTP_DB_HOSTNAME`, `OLTP_DB_PORT`, `OLTP_DB_DATABASE`, `OLTP_DB_USERNAME`, `OLTP_DB_PASSWORD`, `OLTP_DB_URL`; y `AUTH_CATALOG_DB_HOSTNAME`, `AUTH_CATALOG_DB_PORT`, `AUTH_CATALOG_DB_DATABASE`, `AUTH_CATALOG_DB_USERNAME`, `AUTH_CATALOG_DB_PASSWORD`, `AUTH_CATALOG_DB_URL`.

Las URLs JDBC deben corresponder a los campos individuales. OLTP es de solo lectura; DW usa cuenta runtime restringida; catálogo Auth usa cuenta Hop de mínimo privilegio. Los secretos JSON activos son locales e ignorados. Los `*-env.example.json` contienen marcadores `REPLACE_WITH_...` y no conectan por sí solos.

| Ambiente | Propósito |
|---|---|
| `dev` | Fuente de fixture local, DW local y catálogo Auth local. |
| `test` | Fuente persistente/pruebas según instrucciones del README de ambientes; DW sigue siendo la instancia local indicada por ese perfil. |
| `integration` | Contenedores desechables y contratos de integración. |
| `prod` | Contrato sin endpoints/secretos reales. Proveer configuración mediante secret store; no cargar en Hop Web de desarrollo. |

Las variables `DB_DW_HOST/PORT`, `DB_TX_HOST/PORT`, `POSTGRES_DW_NAME` y `POSTGRES_TX_NAME` de `.env` ayudan a construir `HOP_OPTIONS`; credenciales de Hop no se configuran con esas variables sino en los archivos de ambiente Hop.
