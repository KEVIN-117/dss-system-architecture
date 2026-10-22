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
| `DW_CONTROL_DB_USERNAME` | `dw_control_runtime` | Dedicated runtime login; do not use `dw_owner` or the migration/operator login. |
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

Build the image from the repository root:

```sh
docker build -t dw-control-service:local -f dw-control-service/Dockerfile dw-control-service
```

It runs as a non-root user on port `8090` and checks `/actuator/health/readiness`. Actuator exposes
only `health` and `info`; health detail is never returned. Liveness and readiness probes are also
available at `/livez` and `/readyz`.

The base configuration reads PostgreSQL and Keycloak settings from environment variables. The
`dev` profile enables Swagger UI at `/swagger-ui.html` and the OpenAPI document at `/v3/api-docs`;
the default `prod` profile disables both. Logs are ECS-formatted JSON on stdout. Provide the DW
database's dedicated runtime login and secret before starting the service; the planned least-
privilege login is not created by this Docker change.
