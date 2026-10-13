# Variables de pruebas E2E

Las plantillas `.env.e2e.example` bajo `dss-monorepo/apps/*-e2e` configuran servidores locales de Playwright. Los valores versionados son descartables y de prueba, no secretos productivos.

| Grupo/variables | Uso |
|---|---|
| `ADMIN_PORTAL_PORT_E2E`, `DECANO_DASHBOARD_PORT_E2E`, `DIRECTOR_DASHBOARD_PORT_E2E`, `RECTOR_DASHBOARD_PORT_E2E`, `BFF_PORT_E2E` | Puertos locales del servidor de cada test. |
| `*_BASE_URL`, `BFF_BASE_URL`, `BASE_URL` | URL que Playwright usa para conectarse a servidores. |
| `NEXT_PUBLIC_BFF_URL` | BFF público que el portal de test abre desde browser. |
| `KEYCLOAK_URL`, `KEYCLOAK_REALM`, `KEYCLOAK_AUDIENCE`, `KEYCLOAK_ROLE_CLIENT_ID` | Configuración del proveedor de identidad simulado/configurado por harness. |
| `KEYCLOAK_BFF_CLIENT_ID`, `KEYCLOAK_BFF_CLIENT_SECRET`, `KEYCLOAK_BFF_REDIRECT_URI`, `KEYCLOAK_BFF_POST_LOGOUT_REDIRECT_URI` | Flujo OIDC del BFF E2E. El secreto de ejemplo está marcado expresamente como no usado para autenticación de red. |
| `AUTH_SERVICE_URL` | Destino del auth-service usado por BFF bajo prueba. |
| `BFF_ALLOWED_ORIGINS`, `BFF_DEFAULT_POST_LOGIN_REDIRECT_URI` | Allowlist y retorno de login; los origins deben concordar. |
| `BFF_SESSION_SECRET`, `BFF_SESSION_TTL_SECONDS`, `BFF_SESSION_COOKIE` | Cookies/sesión de test; nunca reutilizar en otro ambiente. |
| `CI` | Bandera estándar del runner; Playwright la usa para decidir si reutiliza servidores existentes. |

Para reproducir, copia el ejemplo correspondiente a `.env.e2e`, conserva puertos coherentes entre portal, URL base y redirect URI, y elimina los archivos locales al terminar si contienen datos propios.
