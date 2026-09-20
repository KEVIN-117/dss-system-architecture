// @vitest-environment node
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { AcademicBarChart, RiskDonutChart, TrendLineChart } from '../../index';
import { buildBarOption, resolveChartTheme, DEFAULT_DARK_THEME } from '../../core';

describe('Server compatibility', () => {
  it('imports the public entries without a browser', () => {
    expect(typeof document).toBe('undefined');
    expect(resolveChartTheme()).toMatchObject(DEFAULT_DARK_THEME);
    expect(buildBarOption([{ label: 'A', value: 4 }]).series).toBeDefined();
  });
  it.each([AcademicBarChart, RiskDonutChart, TrendLineChart])('renders stable markup without creating canvas', (Component) => {
    const html = renderToString(<Component title="Datos" data={[{ label: 'A', value: 4 }]} />);
    expect(html).toContain('role="img"');
    expect(html).toContain('height:360px');
    expect(html).not.toContain('<canvas');
  });
});
