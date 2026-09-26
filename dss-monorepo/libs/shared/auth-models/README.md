# @dss-monorepo/auth-models

Contratos de autenticación independientes del navegador, Keycloak y el BFF.

- `AuthUserProfile` representa exactamente la respuesta de `GET /api/v1/auth/me`; no contiene roles.
- `AuthUser` combina ese perfil con roles DSS ya verificados.
- `DSSRole`, `DSS_ROLES` e `isDSSRole` mantienen el conjunto de roles del DSS.
- `KeycloakTokenClaims` y `VerifiedToken` representan un token validado por un adaptador de servidor.
- `isAuthUserProfile` valida la respuesta recibida de `auth-service` antes de usarla.

Los paquetes consumidores deben importar desde `@dss-monorepo/auth-models` y declarar la dependencia de workspace de forma explícita.

```sh
bun x nx run @dss-monorepo/auth-models:test
bun x nx run @dss-monorepo/auth-models:typecheck
```
