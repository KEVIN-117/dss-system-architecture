# @dss-monorepo/design-system

This library was generated with [Nx](https://nx.dev).

## Academic DSS palette

Import `@dss-monorepo/design-system/styles/globals.css` once at the application
root. The stylesheet is the shared source for light and dark academic themes.
Applications should use semantic classes such as `bg-background`, `text-foreground`,
`bg-primary`, `text-muted-foreground`, `border-border` and `ring-ring` instead of
declaring local brand colors.

The brand scale is available when a component needs a deliberate accent:

| Token | Purpose |
| --- | --- |
| `--dss-navy-950` / `--dss-navy-900` | Main dark background and elevated surfaces |
| `--dss-blue-700` / `--dss-blue-500` | Institutional actions and links |
| `--dss-cyan-400` / `--dss-cyan-600` | Focus, active and academic accents |
| `--dss-gold-400` / `--dss-gold-700` | Highlights and operational data |
| `--dss-red-500` | Destructive and error states |

Role themes keep the existing `data-theme` contract: `superadmin` (and the
legacy `admin` alias) uses technical navy, `rector` uses institutional blue,
`decano` uses academic cyan, and `director` uses gold/amber. Each role has
light and `.dark` variants while destructive states remain crimson globally.

## Running unit tests

Run `nx test @dss-monorepo/design-system` to execute the unit tests via [Vitest](https://vitest.dev/).
