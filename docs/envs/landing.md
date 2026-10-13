# Landing (`dss-monorepo/apps/landing`)

Fuente: `apps/landing/.env.example`; Next.js incorpora variables `NEXT_PUBLIC_*` al bundle público.

| Variable | Requerida | Uso |
|---|---|---|
| `LANDING_PORT` | Opcional | Puerto dev del landing; ejemplo 3000. |
| `NEXT_PUBLIC_BFF_URL` | Sí para auth | Origin público del BFF que el navegador puede alcanzar; ejemplo `http://localhost:3006`. |
| `NEXT_PUBLIC_ADMIN_PORTAL_URL` | Para navegación | URL pública de Admin Portal; ejemplo puerto 3001. |
| `NEXT_PUBLIC_RECTOR_DASHBOARD_URL` | Para navegación | URL pública del panel Rector; ejemplo puerto 3004. |
| `NEXT_PUBLIC_DECANO_DASHBOARD_URL` | Para navegación | URL pública del panel Decano; ejemplo puerto 3002. |
| `NEXT_PUBLIC_DIRECTOR_DASHBOARD_URL` | Para navegación | URL pública del panel Director; ejemplo puerto 3003. |

En dev usa URLs locales del browser. En test apunta al BFF/portales del harness. En producción deben ser HTTPS públicas. Nunca poner secretos ni endpoints internos que no puedan exponerse en `NEXT_PUBLIC_*`.
