// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { use as registerEchartsModules } from 'echarts/core';
import { SVGRenderer } from 'echarts/renderers';
import type { EChartsOption } from 'echarts';
import { init } from '../core/engine';
import { buildChartOption } from './build';
import { DEFAULT_CHART_OPTIONS } from './chart-types';
import { cellRadiusPct, gridCells } from './small-multiples';

registerEchartsModules([SVGRenderer]);

describe('Saiku chart rendering', () => {
  it('renders a bar chart with the zoom slider for a large result', () => {
    const rows = Array.from({ length: 79 }, (_, index) => `Gestión ${index}`);
    const option = buildChartOption({
      rowCategories: rows,
      columnCategories: ['Postulantes', 'Admitidos'],
      matrix: rows.map((_, index) => [index + 10, index + 5]),
    }, 'bar');
    const chart = init(null, undefined, { renderer: 'svg', ssr: true, width: 1200, height: 460 });
    try {
      expect(() => chart.setOption(option as EChartsOption)).not.toThrow();
      expect(chart.renderToSVGString()).toContain('<svg');
      expect(chart.getOption().dataZoom).toHaveLength(2);
    } finally {
      chart.dispose();
    }
  });

  it('sizes multiple radial charts using the actual wide canvas', () => {
    const cell = gridCells(2)[0];
    expect(cellRadiusPct(cell, 3)).toBeGreaterThan(60);
    expect(cellRadiusPct(cell, 3)).toBeLessThanOrEqual(100);
    expect(cellRadiusPct(cell, 1)).toBeLessThan(cellRadiusPct(cell, 3));
  });
});

describe('Saiku layout collisions', () => {
  const projection = {
    rowCategories: ['2024 Q1', '2024 Q2', '2024 Q3'],
    columnCategories: ['Ventas', 'Costos', 'Margen'],
    matrix: [[1, 2, 3], [4, 5, 6], [7, 8, 9]],
  };
  const gridBottom = (option: Record<string, unknown> | null) =>
    (option?.grid as { bottom: number }).bottom;

  it('reserves a row under the axis labels for a bottom legend', () => {
    const top = buildChartOption(projection, 'bar', { ...DEFAULT_CHART_OPTIONS, showLegend: true, legendPosition: 'top' });
    const bottom = buildChartOption(projection, 'bar', { ...DEFAULT_CHART_OPTIONS, showLegend: true, legendPosition: 'bottom' });
    expect(gridBottom(bottom)).toBe(gridBottom(top) + 28);
  });

  it('lays titled small multiples out below the chart title', () => {
    const option = buildChartOption(projection, 'treemap', { ...DEFAULT_CHART_OPTIONS, title: 'Indicadores' });
    const series = option?.series as Array<{ top: string }>;
    expect(series.every((cell) => parseFloat(cell.top) >= 10)).toBe(true);
  });
});
