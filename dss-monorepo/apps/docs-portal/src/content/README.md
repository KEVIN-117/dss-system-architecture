# Contenido del portal

Las guías del portal se mantienen en archivos `.mdx` versionados junto a `apps/docs-portal`. Next.js compila estos archivos con `@next/mdx`; se pueden importar desde la interfaz como componentes React y pueden incluir JSX.

## Convenciones

- Cada archivo exporta un objeto `metadata` con `title`, `audience` y `classification`; los documentos se enumeran explícitamente en `registry.ts`, que establece su URL estable `/docs/<slug>`.
- Clasificaciones admitidas: `public`, `public-summary` y `restricted`. Los documentos restringidos declaran `requiredRoles`; la ruta del servidor comprueba la sesión mediante `/api/auth/me` del BFF antes de renderizar el MDX y falla cerrada si el BFF no responde. Nunca importes una página restringida en un componente cliente.
- Usa `Callout` para observaciones que cambian cómo se debe interpretar o usar el contenido.
- Usa `Source` para enlazar el documento original del que se preparó el resumen. Conserva una sola fuente de verdad cuando el material original ya esté bien mantenido.
- Antes de copiar información de despliegue, administración o seguridad, define su clasificación y el acceso necesario. No publiques secretos ni valores de ambiente.
- Revisa [EDITORIAL.md](../EDITORIAL.md) antes de cambiar una guía. La clasificación y los roles deben coincidir tanto en el `metadata` MDX como en `registry.ts`.
- Para que el control restringido funcione en despliegue, configura las URL BFF/portal a partir de `.env.example` y agrega el origen HTTPS de docs a `BFF_ALLOWED_ORIGINS`. La URL del BFF solo de servidor no se expone al navegador.
- El frontmatter YAML no está habilitado por defecto. La integración utiliza exportaciones JavaScript/MDX para metadatos, siguiendo la guía de Next.js.

La configuración sigue la [guía oficial de MDX para App Router](https://nextjs.org/docs/app/guides/mdx): `next.config.mjs`, `pageExtensions`, `src/mdx-components.tsx` e importación de contenido. La [guía de Pages Router](https://nextjs.org/docs/pages/guides/mdx) comparte la configuración del compilador y los ejemplos de importación, pero sus convenciones de rutas no se aplican a esta app.
