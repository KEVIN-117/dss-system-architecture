# @dss-monorepo/auth-connector

Adaptador de servidor para que el futuro BFF valide tokens de Keycloak y consulte el perfil local de `auth-service`. No depende de React ni contiene navegación, sesión de navegador o jerarquías RBAC.

```ts
import {
  fetchUserProfile,
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
```

`verifyKeycloakJwt` obtiene las claves del JWKS del realm y exige firma `RS256` de forma predeterminada, `iss`, `aud`, `exp` y `sub`. Solo extrae roles DSS del cliente indicado por `roleClientId`; no interpreta roles de otros clientes. `fetchUserProfile` exige una respuesta plana y válida de `auth-service`; sus roles no proceden de ese endpoint.

El paquete declara directamente `jose` y `@dss-monorepo/auth-models`, aunque Bun las instale desde el workspace raíz. Debe usarse únicamente en código de servidor. La aplicación consumidora, como el BFF, resuelve las variables de entorno y le pasa esta configuración tipada; el connector no lee el entorno por cuenta propia.

```sh
bun x nx run @dss-monorepo/auth-connector:test
bun x nx run @dss-monorepo/auth-connector:typecheck
```
