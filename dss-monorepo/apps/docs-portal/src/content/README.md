# Contenido del portal

Las guías del portal se mantienen en archivos `.mdx` versionados junto a `apps/docs-portal`. Next.js compila estos archivos con `@next/mdx`; se pueden importar desde la interfaz como componentes React y pueden incluir JSX.

## Convenciones

- Cada archivo exporta un objeto `metadata` con `title`, `audience` y `classification`. La clasificación es informativa: el portal todavía no aplica controles de acceso por documento.
- Usa `Callout` para observaciones que cambian cómo se debe interpretar o usar el contenido.
- Usa `Source` para enlazar el documento original del que se preparó el resumen. Conserva una sola fuente de verdad cuando el material original ya esté bien mantenido.
- Antes de copiar información de despliegue, administración o seguridad, define su clasificación y el acceso necesario. No publiques secretos ni valores de ambiente.
- El frontmatter YAML no está habilitado por defecto. La integración utiliza exportaciones JavaScript/MDX para metadatos, siguiendo la guía de Next.js.

La configuración sigue la [guía oficial de MDX para App Router](https://nextjs.org/docs/app/guides/mdx): `next.config.mjs`, `pageExtensions`, `src/mdx-components.tsx` e importación de contenido. La [guía de Pages Router](https://nextjs.org/docs/pages/guides/mdx) comparte la configuración del compilador y los ejemplos de importación, pero sus convenciones de rutas no se aplican a esta app.
