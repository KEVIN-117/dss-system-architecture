# @dss-monorepo/auth-connector

Adaptador de servidor para que el BFF valide tokens de Keycloak, complete el
intercambio Authorization Code + PKCE y consulte el perfil local de
`auth-service`. No depende de React ni contiene navegación de navegador,
sesión o jerarquías RBAC.

```ts
import {
  createAuthorizationUrl,
  exchangeAuthorizationCode,
  fetchUserProfile,
  replaceUserAcademicContexts,
  verifyKeycloakIdToken,
  verifyKeycloakJwt,
} from '@dss-monorepo/auth-connector';

const keycloak = {
  keycloakUrl: 'https://keycloak.example.edu',
  realm: 'uatf-dss-realm',
  audience: 'uatf-auth-service',
  roleClientId: 'uatf-auth-service',
};

const verified = await verifyKeycloakJwt(token, keycloak);

const profile = await fetchUserProfile('https://auth.example.edu', token);

// Solo después de aplicar autorización SUPERADMIN en el BFF:
const contexts = await replaceUserAcademicContexts(
  'https://auth.example.edu',
  token,
  '6acb7476-663d-4c94-b3bd-9e5ac6db7f31',
  { contexts: [{ facultyId: 2, careerId: 'INF' }] },
);
```

Las funciones OIDC reciben `KeycloakOidcClientConfig` con `clientId`,
`clientSecret` y `redirectUri`; solo el BFF puede construir esa configuración
desde sus variables de entorno. `createAuthorizationUrl` genera la solicitud
con `state`, `nonce` y PKCE S256; `exchangeAuthorizationCode` usa únicamente
`grant_type=authorization_code` desde el servidor.

`verifyKeycloakJwt` obtiene las claves del JWKS del realm y exige firma `RS256` de forma predeterminada, `iss`, `aud`, `exp` y `sub`. Solo extrae roles DSS del cliente indicado por `roleClientId`; no interpreta roles de otros clientes. `fetchUserProfile` exige una respuesta plana y válida de `auth-service`; sus roles no proceden de ese endpoint.

`replaceUserAcademicContexts` consume `PUT /api/v1/admin/users/{userId}/academic-contexts` y valida tanto la solicitud como la respuesta. Es una operación exclusiva de administración: el BFF debe exigir `SUPERADMIN` antes de llamarla y reenviar el bearer token verificado para que `auth-service` aplique también su autorización `ROLE_SUPERADMIN`.

El paquete declara directamente `jose` y `@dss-monorepo/auth-models`, aunque Bun las instale desde el workspace raíz. Debe usarse únicamente en código de servidor. La aplicación consumidora, como el BFF, resuelve las variables de entorno y le pasa esta configuración tipada; el connector no lee el entorno por cuenta propia.

```sh
bun x nx run @dss-monorepo/auth-connector:test
bun x nx run @dss-monorepo/auth-connector:typecheck
```
