# Apache Hop environment files

The active `dev-env.json`, `test-env.json`, `integration-env.json`, `integration-test.json`, and `prod-env.json` files are local runtime configuration and are intentionally not versioned. They can contain real endpoints, account names, or passwords. Docker integration tests use the separate, versioned `integration-test.example.json`; it contains only disposable fixture endpoints and credentials and must never be used outside the test Compose network. Every profile example includes the `AUTH_CATALOG_DB_*` contract for the `Auth Service DB` connection. Supply that profile's catalog endpoint and least-privilege Hop account when a pipeline reads or writes the Auth Service academic catalog; inject the password from a local ignored file or the environment's secret store.

Use the matching `*-env.example.json` as the format reference. For tests against the persistent PostgreSQL in `C:\Users\krodr\profile\private\dss-uatf\database\neo4j-db.yml`, copy `test-env.example.json` to `test-env.json`. It targets `host.docker.internal:5432/jachasun`; keep `dev-env.json` pointed at the disposable `historical-v2` fixture on port `55432`. Replace every `REPLACE_WITH_...` and `INJECT_FROM_...` marker before running Hop. The examples are deliberately nonfunctional until configured.

To select this profile in Hop Web, set `HOP_ENVIRONMENT_NAME=test` in the local Compose environment and recreate `hop-web`; Compose loads `environments/test-env.json`. This profile changes the OLTP source only: its DW endpoint remains the local development database `dss_dw`, so successful runs write there. Use an OLTP account with read-only grants; do not reuse the PostgreSQL owner account from `neo4j-db.yml`.

## Producción

`prod-env.example.json` define el contrato de variables, pero no contiene endpoints ni credenciales reales. No se debe cargar `prod` en el Hop Web de desarrollo ni agregarlo a `HOP_ADDITIONAL_ENVIRONMENT_NAMES`. En el despliegue productivo, TI/DBA debe proporcionar `prod-env.json` a partir de esa plantilla mediante el mecanismo local/seguro de secretos y confirmar los endpoints y permisos runtime antes del arranque. Configura `HOP_ENVIRONMENT_NAME=prod` y `HOP_ADDITIONAL_ENVIRONMENT_NAMES=`; Compose registra `prod` como ambiente predeterminado con propósito `Production`, sin registrar perfiles locales adicionales. El inicio debe fallar si falta el archivo configurado para el ambiente seleccionado.

El perfil productivo requiere OLTP de solo lectura, usuario DW de runtime dedicado y restringido, red privada, autenticación/TLS para Hop Web y validación TI/DSA antes de ejecutar cargas. No uses la cuenta propietaria/migradora ni credenciales de desarrollo. Los secretos no se versionan.

Never commit populated environment files or put production credentials in Git. Supply secrets from a local ignored `.env`, Docker secrets, or the environment's approved secret manager. The OLTP account must remain read-only; the DW account must be a restricted Hop runtime account, not the migration owner. Keep endpoints appropriate to the network where Hop runs (for example, Docker service DNS from a container, not `localhost` unless the database is in the same network namespace).

Before committing, verify the local files remain ignored:

```powershell
git check-ignore -v etl-layer/apache-hop/projects/dss-uatf-etl/environments/dev-env.json
git check-ignore -v etl-layer/apache-hop/projects/dss-uatf-etl/environments/test-env.json
git check-ignore -v etl-layer/apache-hop/projects/dss-uatf-etl/environments/integration-env.json
git check-ignore -v etl-layer/apache-hop/projects/dss-uatf-etl/environments/integration-test.json
git check-ignore -v etl-layer/apache-hop/projects/dss-uatf-etl/environments/prod-env.json
```
