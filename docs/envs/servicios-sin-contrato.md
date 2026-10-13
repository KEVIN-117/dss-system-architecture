# Servicios declarados sin contrato de variables

El `docker-compose.yml` raíz todavía conserva servicios de arquitectura objetivo cuyos contextos de build no existen en este checkout o no tienen configuración publicada. Esta página hace explícita esa brecha para evitar inventar variables.

| Servicio declarado | Contexto de build en Compose | Estado del contrato ENV |
|---|---|---|
| `etl-service` | `./etl-service` | No hay `.env.example` ni variables runtime documentadas. No confundir con Apache Hop o el Load Manager. |
| `graphql-bff` | `./gateway/graphql-bff` | Directorio no presente en este checkout. El BFF activo está en `dss-monorepo/apps/bff` y se documenta aparte. |
| `gateway` | `./gateway/traefik` | Directorio no presente; no hay contrato versionado. |
| `frontend` | `./frontend/nextjs-spa` | Directorio no presente; los portales activos están bajo `dss-monorepo/apps/*`. |

No existen configuraciones dev/test/prod verificables para los cuatro servicios en esta checkout. Antes de reactivar sus entradas Compose, cada componente debe aportar un `.env.example`, indicar variables públicas y secretos, describir validación/defaults y documentar los valores por ambiente. El Compose raíz advierte en el README principal que no levanta toda la arquitectura objetivo.
