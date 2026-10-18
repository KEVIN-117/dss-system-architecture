# BFF de autenticación

El BFF es el único punto de integración de los portales con Keycloak y
`auth-service`. Implementa Authorization Code con PKCE: el navegador inicia el
flujo en el BFF, Keycloak muestra su tema de inicio de sesión y el callback del
BFF intercambia el código en servidor. El navegador nunca recibe un token, un
secreto OIDC ni la URL de `auth-service`.

## Rutas

- `GET /api/auth/login`: crea una transacción cifrada con `state`, `nonce` y
  PKCE; después redirige a Keycloak. Acepta `returnTo` solo para orígenes de
  `BFF_ALLOWED_ORIGINS` y `action=register` cuando el realm permita registro.
- `GET /api/auth/callback`: valida `state`, intercambia el código, valida ID
  token y access token, consulta el perfil activo y emite `dss_session`.
- `GET /api/auth/me`: devuelve perfil, roles y permisos efectivos desde una
  sesión BFF válida.
- `GET /api/auth/logout`: elimina la sesión BFF y redirige al logout OIDC si
  tiene un ID token disponible.
- `GET|POST /api/graphql`: endpoint Apollo Server protegido por la misma sesión
  BFF o Bearer token. El esquema inicial expone `Query.ping`; la identidad
  autenticada queda disponible en el contexto de los resolvers.

La cookie de sesión es `HttpOnly`, `SameSite=Lax`, `Secure` en producción y
contiene un JWE que solo puede descifrar el BFF. No persiste el refresh token.
Las rutas vuelven a validar el access token, issuer, audiencia y perfil activo;
los endpoints de negocio deben además aplicar `requireRoles()` o
`requirePermissions()`.

El JWE stateless es la implementación inicial y funciona sin una base de
sesiones. Para despliegues con varias instancias o revocación inmediata se
puede evolucionar a un identificador opaco respaldado por Redis o una base de
datos; esa migración no cambia el contrato de los portales. En producción se
deben rotar `BFF_SESSION_SECRET` y `KEYCLOAK_BFF_CLIENT_SECRET`, usar HTTPS y
mantener una lista explícita de orígenes.

## Configuración

Configura `apps/bff/.env` a partir de `.env.example`:

```dotenv
KEYCLOAK_URL=http://localhost:8080
KEYCLOAK_REALM=uatf-dss-realm
KEYCLOAK_AUDIENCE=uatf-auth-service
KEYCLOAK_ROLE_CLIENT_ID=uatf-auth-service
KEYCLOAK_BFF_CLIENT_ID=dss-bff
KEYCLOAK_BFF_CLIENT_SECRET=<secreto-no-versionado>
KEYCLOAK_BFF_REDIRECT_URI=http://localhost:3006/api/auth/callback
KEYCLOAK_BFF_POST_LOGOUT_REDIRECT_URI=http://localhost:3000/login
AUTH_SERVICE_URL=http://localhost:8000
BFF_ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001,http://localhost:3002,http://localhost:3003,http://localhost:3004
BFF_DEFAULT_POST_LOGIN_REDIRECT_URI=http://localhost:3000/auth/callback
BFF_SESSION_SECRET=<al-menos-32-caracteres-no-versionados>
```

### Ejecución local

El flujo de login necesita que `auth-service` esté disponible: después de
validar los tokens, el callback consulta `/api/v1/auth/me` para confirmar que el
perfil exista y esté activo. `nx run-many -t dev --projects="tag:type:app,tag:type:bff"`
no inicia este servicio Spring. Desde la raíz de `dss-system-architecture`,
inicia `auth-service` y sus dependencias con:

```bash
docker compose up -d auth-service
```

Luego inicia los portales y el BFF con Nx. Si el callback vuelve a fallar, los
logs del BFF indican la etapa del fallo sin registrar códigos, cookies ni
tokens.

Los URI de callback, logout y los orígenes deben coincidir con el cliente
confidencial `dss-bff` del realm. En producción se usan URL HTTPS y secretos
distintos por entorno. El import del realm ocurre solo en una instalación
nueva de Keycloak; los entornos existentes deben actualizar su cliente y tema
mediante migración administrativa equivalente.

No existe una ruta de intercambio de tokens para el navegador. El único flujo
soportado es `/api/auth/login` y su callback OIDC; los portales nunca reciben ni
envían access tokens. Los callers de servidor de confianza pueden usar el
encabezado Bearer en las rutas protegidas del BFF cuando su contrato lo requiera.

Las consultas GraphQL requieren una sesión válida y respetan `BFF_ALLOWED_ORIGINS`
para CORS. Ejemplo de una consulta autenticada desde un portal con cookie de sesión:

```graphql
query HealthCheck {
  ping
}
```

## Verificación E2E

Las suites E2E usan una configuración aislada y valores de prueba. Cubren la
entrada `/login`, el rechazo de dashboards sin sesión, la redirección OAuth
con PKCE y la respuesta `401` de `/api/auth/me`. No realizan un login real en
Keycloak ni contienen secretos de despliegue.

```bash
bun nx run-many -t e2e
```
