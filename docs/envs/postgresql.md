# PostgreSQL

## `auth-service-db` (IAM y Keycloak)

Compose usa `AUTH_DB_USER`, `AUTH_DB_PASSWORD` y `AUTH_DB_NAME` para inicializar PostgreSQL. Keycloak comparte el motor, pero utiliza sus propias credenciales `KC_DB_USERNAME`/`KC_DB_PASSWORD` y esquema `keycloak`; auth-service usa `AUTH_DB_USER`/`AUTH_DB_PASSWORD`. Mantener separación de roles y esquemas evita que una aplicación necesite privilegios de superusuario. El puerto host `5433` se dirige al 5432 del contenedor.

## `postgres-dw`

Inicialización con `POSTGRES_DW_USER`, `POSTGRES_DW_PASSWORD` y `POSTGRES_DW_NAME`; puerto host `5434` → 5432. La cuenta de bootstrap/migración no debe usarse como credencial diaria de Hop. El servicio Hop requiere su cuenta de runtime para extraer/cargar, y la conexión al catálogo académico requiere la cuenta de mínimo privilegio definida por `AUTH_CATALOG_DB_*` en los perfiles Hop.

## `dw-migrator`

Recibe `PGHOST=postgres-dw`, `PGPORT=5432`, `PGDATABASE=${POSTGRES_DW_NAME}`, `PGUSER=${POSTGRES_DW_USER}` y `PGPASSWORD=${POSTGRES_DW_PASSWORD}` desde Compose. Es un proceso de una sola ejecución dependiente del healthcheck DW. Para producción se recomienda separar la identidad migradora de la cuenta de ejecución de pipelines.

## Bases de prueba

`infra/dw-test-data/historical-v2/compose.yml` y Compose de integración crean bases y usuarios de fixtures aislados. Los puertos pueden diferir del ambiente local principal; usa los valores del Compose del fixture y no conectes los tests a producción.
