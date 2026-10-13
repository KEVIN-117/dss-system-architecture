# Portales web

Las aplicaciones están en `dss-monorepo/apps`. Sus plantillas `.env.example` contienen únicamente `NEXT_PUBLIC_BFF_URL` y/o una variable de puerto. El BFF conserva las credenciales; el frontend no debe recibir client secret, token de servicio ni secreto de sesión.

| Aplicación | Variables | Puerto de ejemplo |
|---|---|---:|
| Admin Portal | `ADMIN_PORTAL_PORT`, `NEXT_PUBLIC_BFF_URL` | 3001 |
| Decano Dashboard | `DECANO_DASHBOARD_PORT`, `NEXT_PUBLIC_BFF_URL` | 3002 |
| Director Dashboard | `DIRECTOR_DASHBOARD_PORT`, `NEXT_PUBLIC_BFF_URL` | 3003 |
| Rector Dashboard | `RECTOR_DASHBOARD_PORT`, `NEXT_PUBLIC_BFF_URL` | 3004 |
| Docs Portal | `DOCS_PORTAL_PORT` | 3005 |

`NEXT_PUBLIC_BFF_URL` es el origin del BFF visto por el navegador, no necesariamente el DNS interno usado entre contenedores. En test E2E cada portal recibe una URL base/puerto independiente descrita en [Pruebas E2E](e2e.md). En prod define origin HTTPS bajo los dominios aprobados y reconstruye el bundle Next.js al cambiar variables públicas.

Los `.env` locales ignorados de algunos portales contienen `NEXT_PUBLIC_KEYCLOAK_URL`, `NEXT_PUBLIC_KEYCLOAK_REALM` y `NEXT_PUBLIC_KEYCLOAK_CLIENT_ID`, pero no aparecen en las plantillas actuales ni hay referencias de lectura en el código versionado del monorepo revisado. Se consideran sobrantes de una integración anterior; quitar esas entradas locales cuando sea seguro y no añadirlas al contrato nuevo. La autenticación vigente pasa por el BFF.
