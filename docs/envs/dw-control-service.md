# DW Control Service — Keycloak Resource Server

`dw-control-service` validates Keycloak access tokens locally as an OAuth 2.0 resource server. It
does not call `auth-service` or Keycloak for each request. Signature, issuer, timestamps, and the
service audience are validated from Keycloak's JWK Set.

| Environment variable | Example | Purpose |
| --- | --- | --- |
| `KEYCLOAK_ISSUER_URI` | `http://localhost:8080/realms/uatf-dss-realm` | Must match the token `iss` claim. |
| `KEYCLOAK_JWK_SET_URI` | `http://keycloak:8080/realms/uatf-dss-realm/protocol/openid-connect/certs` | Signing keys used to validate JWT signatures. |
| `KEYCLOAK_DW_CONTROL_AUDIENCE` | `dw-control-service` | Required member of the token `aud` claim. |
| `KEYCLOAK_DW_CONTROL_CLIENT_ID` | `dw-control-service` | Client claim from which this API reads permissions. |
| `DW_CONTROL_DB_URL` | `jdbc:postgresql://postgres-dw:5432/dss_dw` | PostgreSQL connection URL for the DW control schema. |
| `DW_CONTROL_DB_USERNAME` | `dw_control_runtime` | Dedicated LOGIN account; grant membership in `dw_control_service` only. Do not use `dw_owner`, `dw_control_operator`, or a migration account. |
| `DW_CONTROL_DB_PASSWORD` | Managed secret | Password for the dedicated runtime login. |
| `DW_CONTROL_PORT` | `8090` | HTTP port used by the service and image health check. |
| `DW_CONTROL_PROFILE` | `dev` or `prod` | Selects environment-specific settings; defaults to `prod`. |
| `DW_CONTROL_OPENAPI_ENABLED` | `true` in dev, `false` in prod | Controls OpenAPI JSON and Swagger UI exposure. |
| `LOG_STRUCTURED_FORMAT` | `ecs` | Structured JSON format emitted to stdout. |

The issuer and JWK Set URI may use different hostnames: the issuer must match the externally minted
token, while the JWK endpoint must be reachable from the service runtime. The example values are
for local development; production values must use the deployment's trusted Keycloak issuer and
private network endpoint.

The realm import registers `dw-control-service` as a bearer-only resource client, adds an audience
mapper to the `dss-bff` access token, and defines these client roles:

| Keycloak client role | Granted API authority |
| --- | --- |
| `DW_CLOSURE_READ` | `DW_CLOSURE_READ` |
| `DW_CLOSURE_MANAGE` | `DW_CLOSURE_MANAGE` |
| `DW_ETL_MONITOR_READ` | `DW_ETL_MONITOR_READ` |

Only roles under `resource_access.dw-control-service.roles` are used for these permissions. Realm
roles and roles belonging to other clients do not grant them. The initial realm config deliberately
does not assign these permissions to `SUPERADMIN` or another realm role. Assign client roles
explicitly according to the institutional authorization policy before granting access.

The request policy is deny-by-default. Closure reads require `DW_CLOSURE_READ`, closure write
commands require `DW_CLOSURE_MANAGE`, and ETL execution reads require `DW_ETL_MONITOR_READ`. Unknown
paths and methods remain denied.

## Runtime and operations

### Compose local

The root `docker-compose.yml` builds this service from `dw-control-service/Dockerfile`, waits for
PostgreSQL, the DW migrations, and Keycloak, then publishes the API on `http://localhost:8090`.
Set `DW_CONTROL_DB_PASSWORD` in the ignored root `.env`. The local-only
`dw-control-db-provision` one-shot service creates or reconciles the restricted
`dw_control_runtime` login after migrations and grants it membership in `dw_control_service`.
The API connects to PostgreSQL through the internal `postgres-dw:5432` address; `DW_CONTROL_PORT`
controls the host port. Start or rebuild the service and its dependencies with:

```powershell
docker compose up -d --build dw-control-service
docker compose ps dw-control-service
Invoke-RestMethod http://localhost:8090/actuator/health/readiness
```

To inspect startup errors, use `docker compose logs --tail=100 dw-control-service`. The API login
is separate from the database owner. The local provisioner is only for the root development
Compose; production and UATF environments must have a DBA provision the runtime login through the
approved secret-management process as described below.

Build the image from the repository root:

```sh
docker build -t dw-control-service:local -f dw-control-service/Dockerfile dw-control-service
```

It runs as a non-root user on port `8090` and checks `/actuator/health/readiness`. Actuator exposes
only `health` and `info`; health detail is never returned. Liveness and readiness probes are also
available at `/livez` and `/readyz`.

The base configuration reads PostgreSQL and Keycloak settings from environment variables. The
`dev` profile enables Swagger UI at `/swagger-ui.html` and the OpenAPI document at `/v3/api-docs`;
the default `prod` profile disables both. Logs are ECS-formatted JSON on stdout. Migration
`0023_create_dw_control_reader_role.sql` creates the read-only `NOLOGIN` group. Migration
`0024_add_academic_closure_commands.sql` creates `dw_control_api` and the `dw_control_service`
composition, which receives read access plus `EXECUTE` on the two audited closure command
functions. Migration `0025_grant_dw_execution_monitoring_read.sql` extends `dw_control_reader`
with SELECT-only access to execution summaries, steps, metrics, and error metadata. The API never
selects raw error causes, messages, JSON details, step component references, or metric dimensions.
The grants do not include direct table DML. TI/DBA must provision the environment's
`dw_control_runtime` LOGIN and grant membership in `dw_control_service`; the LOGIN must inherit
that role's privileges and must not belong to any other write-capable role. Set its password using
the environment's secret manager or local ignored `.env`, never in migration SQL or Git.
Closure query transactions are also marked read-only by the application; mutations run through the
security-definer functions only.

For a new local environment, TI/DBA creates the service login after the role migrations have been
applied, then grants it membership in the service composition. In an interactive `psql` session:

```sql
CREATE ROLE dw_control_runtime LOGIN INHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
GRANT dw_control_service TO dw_control_runtime;
\password dw_control_runtime
```

The `\password` command prompts for the secret instead of embedding it in a SQL file or shell
history. Do not use the cluster administrator or `dw_control_operator` credentials in the service.

## UATF / Dokploy Compose

Use [`dw-control-service/compose.uatf.yml`](../../dw-control-service/compose.uatf.yml) for a
container deployment. It pins the currently configured release image, runs the `prod` profile,
disables OpenAPI/Swagger, and joins the external `dokploy-network`. Attach the DW PostgreSQL and
Keycloak services to that same network, or set their reachable private DNS names in the environment
file. Configure Dokploy's proxy to route to the Compose service on port `8090`; the API port is not
published directly on the host.

Copy [`dw-control-service/dw-control-service.uatf.env.example`](../../dw-control-service/dw-control-service.uatf.env.example)
to `dw-control-service.uatf.env` on the deployment host, replace the examples with UATF values, and
store the password through the approved secret-management process. Do not commit the populated
file. `KEYCLOAK_ISSUER_URI` must exactly match the `iss` claim in access tokens; the JWK Set URL
must be reachable from the container. Set `DW_CONTROL_DB_URL` to the DW host and database, and use
only the provisioned `dw_control_runtime` login.

Before starting the API, apply the DW schema release migrations that create/update the control
roles and functions (including migrations `0023`–`0025`), then have the DBA provision
`dw_control_runtime` and grant it membership in `dw_control_service`. This Compose intentionally
does not run database migrations or create credentials. Deploy with:

```bash
docker compose -f compose.uatf.yml pull
docker compose -f compose.uatf.yml up -d
docker compose -f compose.uatf.yml ps
docker compose -f compose.uatf.yml logs --tail=100 dw-control-service
```

The image tag is pinned in the Compose file. Before changing it, verify that the exact release tag
is published in Docker Hub and that its corresponding schema migrations have already been applied.
