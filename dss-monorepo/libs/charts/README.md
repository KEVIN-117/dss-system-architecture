# @dss-monorepo/charts

Biblioteca de visualización compartida del DSS. El paquete publicado se llama `@dss-monorepo/charts`; su proyecto Nx es `charts`. Ambos nombres describen la misma biblioteca.

Los once gráficos se apoyan en Apache ECharts con Canvas y en un único `BaseChart`. Los builders permanecen puros, por lo que se pueden importar en un proceso sin DOM y usar al construir opciones en el servidor.

## Uso

```tsx
'use client';

import { AcademicBarChart, type ChartDataPoint } from '@dss-monorepo/charts';

const data: ChartDataPoint[] = [
  { label: 'Ingeniería', value: 80 },
  { label: 'Ciencias', value: 45 },
];

export function Rendimiento() {
  return <AcademicBarChart title="Rendimiento por facultad" data={data} height={320} ariaLabel="Rendimiento promedio por facultad" onChartClick={(event) => console.log(event.name, event.value)} />;
}
```

Las entradas interactivas incluyen `'use client'` en el resultado compilado. Para builders, tipos y temas que no necesitan React, importa `@dss-monorepo/charts/core`.

## Gráficos OLAP de Saiku

`SaikuChart` adapta el builder compartido de Saiku al ciclo de vida React de `BaseChart`. El builder es puro y acepta una proyección común de categorías y matriz; el wrapper resuelve los tokens del Design System, aplica opciones, eventos y carga del mapa geográfico cuando se solicita.

```tsx
import { SaikuChart, type ChartProjection } from '@dss-monorepo/charts';

const projection: ChartProjection = {
  rowCategories: ['2024', '2025'],
  columnCategories: ['Ventas'],
  matrix: [[120], [155]],
};

<SaikuChart chartType="bar" projection={projection} title="Ventas por año" />;
```

Los `ChartOptions` y tipos `ChartType` migrados de Saiku se exportan desde el paquete. Para datos de cellset, la proyección debe prepararse antes de renderizar; `SaikuChart` no interpreta respuestas del backend ni aplica reglas de interacción OLAP.

## API común

Todos los componentes aceptan `title`, `loading`, `className`, `style`, `height`, `ariaLabel`, `emptyMessage`, `themeTokens` y `onChartClick`.

- La altura predeterminada es `360px`; el ancho sigue al contenedor.
- `onChartClick` recibe el `ChartClickEvent` nativo de ECharts y solo se activa al seleccionar elementos de datos.
- La carga tiene prioridad sobre los estados vacío e inválido.
- Se muestra `Sin datos disponibles` para conjuntos vacíos. Barras, línea y dona muestran un estado visible de datos inválidos ante valores negativos o no finitos; la dona considera una suma total de cero como vacía.
- `ChartDataPoint` mantiene `{ label, value }` y admite `tone: 'default' | 'success' | 'warning' | 'destructive'`. La dona usa ese tono cuando está presente; el texto de la etiqueta no determina el color.

`BaseChart` es exportado para casos que requieran una opción ECharts propia. Gestiona una sola instancia, actualizaciones sin series residuales, carga, resize agrupado, visibilidad, eventos actuales y limpieza al desmontar, incluso con React Strict Mode.

## Temas

El Design System del DSS es la fuente visual. Al montar, el gráfico lee las variables heredadas del contenedor (`--primary`, `--foreground`, `--muted-foreground`, `--background`, `--border`, `--destructive` y `--chart-*`) y observa cambios de `class`, `data-theme` y `style` en sus ancestros. Esto cubre administración, rector, decano y director, tanto en claro como en oscuro, sin remontar el canvas.

`themeTokens` permite una sobrescritura explícita. La precedencia es: valores suministrados, variables CSS y valores de respaldo. Los colores HEX, RGB, HSL y OKLCH se normalizan a sRGB antes de enviarlos a Canvas.

Storybook conserva la importación pública:

```ts
import '@dss-monorepo/design-system/styles/globals.css';
```

En el monorepo, `.storybook/main.ts` la resuelve hacia `libs/ui/design-system/src/styles/globals.css` mediante un alias de Vite. Así funciona aun cuando el gestor de paquetes no haya creado el enlace de espacio de trabajo en `node_modules`.

## Validación

Desde `dss-monorepo`:

```sh
bun nx run-many -t lint typecheck test build --projects charts
bun nx run charts:build-storybook
bun nx run charts:e2e
```

La prueba de navegador inicia Storybook en `http://localhost:6011`, porque el preview de Vite protege el host de desarrollo. Cubre Canvas real, clics, resize, contenedor oculto, temas DSS, OKLCH, movimiento reducido, estados y los once gráficos. Los artefactos de Playwright se excluyen del watcher de Vite para que no recarguen el iframe durante la ejecución.

Referencia de bundle registrada el 20 de septiembre de 2026: el chunk de builders de Storybook fue 756.85 kB (253.55 kB gzip) y el iframe completo 1,130.32 kB (321.82 kB gzip). Es una línea de base, no un umbral.
