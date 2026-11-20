# BFF (`dss-monorepo/apps/bff`)

El BFF es el límite servidor para OAuth/OIDC, sesión web y llamadas a auth/OLAP. La plantilla está en `dss-monorepo/apps/bff/.env.example`; la configuración validada está en `src/lib/bff-config.ts`.

| Variable | Requerida | Uso y reglas |
|---|---|---|
| `BFF_PORT` | Opcional | Puerto local del BFF; vacío en plantilla para que lo determine el runner. |
| `KEYCLOAK_URL` | Sí | Origin HTTP(S) de Keycloak accesible al proceso BFF. |
| `KEYCLOAK_REALM` | Sí | Realm OIDC. |
| `KEYCLOAK_AUDIENCE` | Sí | Audiencia requerida al validar tokens. |
| `KEYCLOAK_ROLE_CLIENT_ID` | Sí | Cliente cuyos roles antiguos de portal reconoce el BFF, además de los roles del realm. |
| `KEYCLOAK_PERMISSIONS_CLIENT_ID` | Opcional | Cliente catálogo cuyos roles son los permisos; default `dss-permissions` (IAM-014). |
| `KEYCLOAK_PORTAL_ROLES` | Opcional | JSON que asigna roles nuevos del realm a un portal, por ejemplo `{"VICERRECTOR":"RECTOR"}`. Solo admite `SUPERADMIN`, `RECTOR`, `DECANO` y `DIRECTOR` como destino; un valor inválido deja el BFF sin autenticación (500). |
| `OLAP_LEGACY_ROLES_ENABLED`, `DW_CONTROL_LEGACY_ROLES_ENABLED` | Opcional | Convivencia: mientras no sean `false`, el BFF también acepta `OLAP_ADMIN` y los `DW_*` antiguos, igual que olap-service y dw-control-service. |
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
| `BFF_SESSION_IDLE_TIMEOUT_SECONDS` | Opcional | Inactividad máxima, entero 300–28800; default 1800 (30 min). Alinear con `ssoSessionIdleTimeout` del realm. Solo el heartbeat de actividad de los portales (`POST /api/auth/refresh`) extiende esta ventana. |
| `BFF_SESSION_MAX_LIFETIME_SECONDS` | Opcional | Duración absoluta desde el login, entero 900–86400 y ≥ idle; default 36000 (10 h). Alinear con `ssoSessionMaxLifespan`. |
| `BFF_SESSION_COOKIE` | Opcional | Nombre seguro, caracteres alfanuméricos, `_` o `-`; default `dss_session`. |
| `NODE_ENV` | Runtime | En `production`, la cookie se marca `Secure`; definirlo correctamente en el despliegue productivo. |
| `BFF_COOKIE_SECURE` | Opcional | `true` o `false`; sobrescribe el atributo `Secure` de las cookies de sesión y de la transacción OAuth. Sin definir, sigue a `NODE_ENV`. Usar `false` **solo** mientras el despliegue se sirva por HTTP plano (p. ej. una IP sin TLS), porque el navegador descarta cookies `Secure` y el callback falla con `transaction_cookie_missing_or_invalid`. Cualquier otro valor impide arrancar. |

Los archivos `.env` locales existen por aplicación y no se versionan. En producción usa HTTPS, dominios reales coherentes con callbacks, cookie secure y secretos de larga entropía desde un gestor aprobado.
