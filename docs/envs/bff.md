# BFF (`dss-monorepo/apps/bff`)

El BFF es el límite servidor para OAuth/OIDC, sesión web y llamadas a auth/OLAP. La plantilla está en `dss-monorepo/apps/bff/.env.example`; la configuración validada está en `src/lib/bff-config.ts`.

| Variable | Requerida | Uso y reglas |
|---|---|---|
| `BFF_PORT` | Opcional | Puerto local del BFF; vacío en plantilla para que lo determine el runner. |
| `KEYCLOAK_URL` | Sí | Origin HTTP(S) de Keycloak accesible al proceso BFF. |
| `KEYCLOAK_REALM` | Sí | Realm OIDC. |
| `KEYCLOAK_AUDIENCE` | Sí | Audiencia requerida al validar tokens. |
| `KEYCLOAK_ROLE_CLIENT_ID` | Sí | Cliente cuyos roles reconoce el BFF. |
| `KEYCLOAK_BFF_CLIENT_ID` | Sí | Cliente confidencial para Authorization Code callback. |
| `KEYCLOAK_BFF_CLIENT_SECRET` | Sí, secreto | Credencial del cliente BFF. Debe coincidir con Keycloak. |
| `KEYCLOAK_BFF_REDIRECT_URI` | Sí | Callback `/api/auth/callback` registrado exactamente en Keycloak. |
| `KEYCLOAK_BFF_POST_LOGOUT_REDIRECT_URI` | Sí | URL de retorno permitida al cerrar sesión; su origin debe estar en allowlist. |
| `AUTH_SERVICE_URL` | Sí | Origin/base HTTP del auth-service; ruta/versionado según cliente. |
| `OLAP_SERVICE_URL` | Según uso OLAP | URL de OLAP, requerido al invocar `getOlapServiceUrl`; ejemplo local `http://localhost:8088` con el Compose raíz. |
| `OLAP_ACADEMIC_SCOPE_FILTERS` | Sí para análisis de Decano/Director | JSON que traduce `facultyId`/`careerId` autenticados a los miembros del esquema Mondrian UATF; sincronizado con `infra/olap/schemas/uatf-rendimiento-academico.xml`. No contiene secretos. |
| `BFF_ALLOWED_ORIGINS` | Sí | Origins HTTP(S) separados por comas. Debe contener orígenes de redirect/post-logout; sin `*`. |
| `BFF_DEFAULT_POST_LOGIN_REDIRECT_URI` | Sí | URL por defecto después de login; su origin debe estar allowlisted. |
| `BFF_SESSION_SECRET` | Sí, secreto | Clave de sesión de al menos 32 caracteres. No reutilizar secretos de OIDC. |
| `BFF_SESSION_TTL_SECONDS` | Opcional | Entero 60–900; default 300 segundos. |
| `BFF_SESSION_COOKIE` | Opcional | Nombre seguro, caracteres alfanuméricos, `_` o `-`; default `dss_session`. |
| `NODE_ENV` | Runtime | En `production`, la cookie se marca `Secure`; definirlo correctamente en el despliegue productivo. |

Los archivos `.env` locales existen por aplicación y no se versionan. En producción usa HTTPS, dominios reales coherentes con callbacks, cookie secure y secretos de larga entropía desde un gestor aprobado.
