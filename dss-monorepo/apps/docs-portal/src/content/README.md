# Contenido del portal

Las guías del portal se mantienen en archivos `.mdx` versionados junto a `apps/docs-portal`. Next.js compila estos archivos con `@next/mdx`.

## Añadir o cambiar una guía

1. Crea o edita `src/content/<archivo>.mdx`. Empieza con `export const metadata = { title, audience, classification }` y usa `##`/`###` para las secciones: cada título recibe un ancla y aparece en «En esta página».
2. Declara la guía una sola vez en `catalog.ts` (slug, título, resumen, grupo, audiencia, clasificación y, si aplica, `requiredRoles`). La barra lateral, el inicio, el buscador y los enlaces anterior/siguiente se derivan de esa lista.
3. Asocia el componente MDX al slug en `registry.ts`.
4. Ejecuta `bun nx lint docs-portal`, `bun nx build docs-portal` y `bun nx e2e docs-portal-e2e`.

## Componentes MDX

- `Callout` (`tone="warning"` opcional): observaciones que cambian cómo se debe interpretar o usar el contenido.
- `Ui`: nombre de un botón o menú tal como aparece en pantalla.
- `Source`: enlace al documento original del repositorio (audiencia técnica). Las guías de uso no deberían depender de él: el personal administrativo no tiene acceso al repositorio.

## Clasificación

- Clasificaciones admitidas: `public`, `public-summary` y `restricted`. Deben coincidir en el `metadata` MDX y en `catalog.ts`.
- Cada guía restringida necesita además su propia ruta dinámica `src/app/docs/<slug>/page.tsx` (copia `guia-portal-administracion/page.tsx`): `/docs/[slug]` es estática y solo sirve guías públicas.
- Los documentos restringidos declaran `requiredRoles`; la ruta del servidor comprueba la sesión mediante `/api/auth/me` del BFF antes de renderizar el MDX y falla cerrada si el BFF no responde. Su texto no entra en el índice de búsqueda. Nunca importes una guía restringida en un componente cliente.
- Antes de copiar información de despliegue, administración o seguridad, define su clasificación y el acceso necesario. No publiques secretos ni valores de ambiente. Revisa [EDITORIAL.md](../../EDITORIAL.md).
- Para que el control restringido funcione en despliegue, configura las URL BFF/portal a partir de `.env.example` y agrega el origen HTTPS de docs a `BFF_ALLOWED_ORIGINS`.

## Contratos OpenAPI

La referencia API se genera desde `openapi/`, una copia de los contratos de `<repo>/docs/**` creada por `scripts/sync-openapi.mjs`. Edita siempre el YAML en `docs/` y vuelve a sincronizar; `check-openapi` detecta copias desactualizadas.
