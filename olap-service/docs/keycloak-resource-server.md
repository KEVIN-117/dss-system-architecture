# Keycloak Resource Server

Saiku accepts Keycloak access tokens as OAuth 2.0 Bearer tokens on the REST and XMLA surfaces.
The API validates tokens locally against Keycloak's JWK Set; it does not send user credentials to
Keycloak and does not call `auth-service` to validate each request.

## Runtime configuration

Set these environment variables before starting the launcher:

| Variable | Example | Purpose |
| --- | --- | --- |
| `KEYCLOAK_ISSUER_URI` | `https://identity.example/realms/uatf-dss-realm` | Must exactly match the token's `iss` claim. |
| `KEYCLOAK_JWK_SET_URI` | `https://identity.example/realms/uatf-dss-realm/protocol/openid-connect/certs` | Keycloak signing keys used to verify the JWT signature. |
| `KEYCLOAK_OLAP_AUDIENCE` | `olap-service` | Required value in the token's `aud` claim. |
| `KEYCLOAK_PERMISSIONS_CLIENT_ID` | `dss-permissions` | Catalog client whose `olap:admin` / `olap:user` permissions grant `ROLE_ADMIN` / `ROLE_USER`. |

PowerShell example:

```powershell
$env:KEYCLOAK_ISSUER_URI = "http://localhost:8081/realms/uatf-dss-realm"
$env:KEYCLOAK_JWK_SET_URI = "http://localhost:8081/realms/uatf-dss-realm/protocol/openid-connect/certs"
$env:KEYCLOAK_OLAP_AUDIENCE = "olap-service"
java -jar .\saiku-launcher\target\saiku-4.8.0.jar serve --port 8080 --home .\saiku-home
```

When both issuer and JWK Set URI are absent, local development can still start with the existing
Saiku authentication, but Bearer tokens are rejected. Supplying only one is a configuration error.

## Keycloak token setup

Configure the frontend to obtain an access token for this API. Add an audience mapper so `aud`
contains `olap-service`, and assign the `olap:user` and/or `olap:admin` permissions as appropriate.
Saiku's gates use `ROLE_ADMIN` (`/rest/saiku/admin/**`, statistics, datasources) and `ROLE_USER`.
Since IAM-012 they come from the catalog client: `resource_access[KEYCLOAK_PERMISSIONS_CLIENT_ID].roles`
containing `olap:admin` grants `ROLE_ADMIN` and `olap:user` grants `ROLE_USER`; other permissions are
ignored. Administration is a permission of its own (decision D4): a realm `SUPERADMIN` without
`olap:admin` is not a Saiku administrator.

The old `OLAP_ADMIN` / `OLAP_USER` roles of the `olap-service` client, and the `OLAP_LEGACY_ROLES_ENABLED` /
`KEYCLOAK_OLAP_CLIENT_ID` switches that accepted them, were retired in IAM-019: roles of that client grant
nothing.

Realm roles keep their `ROLE_<NAME>` authority (Mondrian role mapping uses them), except the
reserved `ROLE_ADMIN` and `ROLE_USER`: realm roles can be created from the admin API, so a realm role
called `ADMIN` must not make its holders Saiku administrators. Roles of other clients are ignored.
Scope authorities remain `SCOPE_*`.

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
