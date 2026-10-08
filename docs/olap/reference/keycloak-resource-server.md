# Keycloak Resource Server

Saiku accepts Keycloak access tokens as OAuth 2.0 Bearer tokens on the REST and XMLA surfaces.
The API validates tokens locally against Keycloak's JWK Set; it does not send user credentials to
Keycloak and does not call `auth-service` to validate each request.

## Runtime configuration

Set these environment variables before starting the launcher:

| Variable | Example | Purpose |
| --- | --- | --- |
| `KEYCLOAK_ISSUER_URI` | `https://identity.example/realms/uatf` | Must exactly match the token's `iss` claim. |
| `KEYCLOAK_JWK_SET_URI` | `https://identity.example/realms/uatf/protocol/openid-connect/certs` | Keycloak signing keys used to verify the JWT signature. |
| `KEYCLOAK_OLAP_AUDIENCE` | `olap-service` | Required value in the token's `aud` claim. |
| `KEYCLOAK_OLAP_CLIENT_ID` | `olap-service` | Client whose `resource_access` roles Saiku maps to authorities. |

PowerShell example:

```powershell
$env:KEYCLOAK_ISSUER_URI = "http://localhost:8081/realms/uatf"
$env:KEYCLOAK_JWK_SET_URI = "http://localhost:8081/realms/uatf/protocol/openid-connect/certs"
$env:KEYCLOAK_OLAP_AUDIENCE = "olap-service"
$env:KEYCLOAK_OLAP_CLIENT_ID = "olap-service"
java -jar .\saiku-launcher\target\saiku-4.8.0.jar serve --port 8080 --home .\saiku-home
```

When both issuer and JWK Set URI are absent, local development can still start with the existing
Saiku authentication, but Bearer tokens are rejected. Supplying only one is a configuration error.

## Keycloak token setup

Configure the frontend to obtain an access token for this API. Add an audience mapper so `aud`
contains `olap-service`, and assign the OLAP client roles `user` and/or `admin` as appropriate.
The converter reads `resource_access[KEYCLOAK_OLAP_CLIENT_ID].roles` and realm roles. The OLAP
client roles `OLAP_ADMIN` and `OLAP_USER` map to `ROLE_OLAP_ADMIN` / `ROLE_OLAP_USER` and also to
the legacy Saiku authorities `ROLE_ADMIN` / `ROLE_USER` used by existing endpoint gates. This alias
is created only for roles inside the configured OLAP client; a realm `SUPERADMIN` or a similarly
named role from another client does not implicitly grant Saiku administrator access. Scope
authorities remain `SCOPE_*`.

Saiku uses the immutable Keycloak `sub` claim as the canonical repository/ACL identity. The
`preferred_username` claim is kept only as the session's display/pass-through principal. User homes
and resource ownership therefore use the subject value, not a client-supplied username.
Existing Saiku repository ACLs and home directories owned by local usernames (for example `admin`)
will not automatically transfer to the Keycloak subject. Before reusing that content, migrate the
owner/ACL identifiers or provision the corresponding user resources under the `sub` identity.

## Request flow

The frontend sends `Authorization: Bearer <access-token>` on each protected API request. Spring
Security validates the signature, timestamps, issuer, and audience, then creates a request-scoped
authentication with Keycloak roles. Saiku's existing URL rules, JAX-RS `@RolesAllowed`, repository
ACLs, and Mondrian role checks continue to authorize the resulting identity.

Saiku's legacy session-map consumers receive a request-local identity view derived from the validated
JWT. It contains the subject, preferred username, and granted authorities; it never contains the
user's Keycloak password. No Saiku login call or `JSESSIONID` is required for Bearer-authenticated
requests. Logging out of the frontend remains a Keycloak client operation; deleting a Saiku session
does not revoke a Keycloak token.

The old `users.properties` provider and Basic Authentication remain available during migration for
existing operational and XMLA clients. They are not needed by a Keycloak-integrated frontend and can
be removed in a later cutover after those consumers are migrated.
