// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { use as registerEchartsModules } from 'echarts/core';
import { SVGRenderer } from 'echarts/renderers';
import type { EChartsOption } from 'echarts';
import { init } from '../core/engine';
import { buildChartOption } from './build';
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
