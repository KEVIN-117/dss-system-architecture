import { describe, it, expect } from 'vitest';
import {
  buildBarOption,
  buildDonutOption,
  buildLineOption,
  buildScatterOption,
  buildClusteringScatterOption,
  buildRegressionScatterOption,
  ChartDataPoint,
} from './builders';
import { DEFAULT_DARK_THEME } from './theme';

describe('Pure ECharts Builders', () => {
  const sampleData: ChartDataPoint[] = [
    { label: 'Matemáticas', value: 85 },
    { label: 'Riesgo Alto', value: 15, tone: 'destructive' },
  ];

  it('buildBarOption should return a valid ECharts option with primary color', () => {
    const option = buildBarOption(
      sampleData,
      'Rendimiento',
      DEFAULT_DARK_THEME,
    );

    expect(option.title).toBeDefined();
    if (option.title && !Array.isArray(option.title)) {
      expect(option.title.text).toBe('Rendimiento');
    }

    expect(option.series).toBeDefined();
    if (Array.isArray(option.series)) {
      expect(option.series[0].type).toBe('bar');
      expect(option.series[0].data).toEqual([85, 15]);
      // Theme extraction test
      expect(option.series[0]).toMatchObject({ itemStyle: { color: DEFAULT_DARK_THEME.chartColors[0] } });
    }
  });

  it('buildDonutOption uses explicit tone instead of guessing from translated labels', () => {
    const option = buildDonutOption(
      sampleData,
      'Riesgo de Deserción',
      DEFAULT_DARK_THEME,
    );

    expect(option.series).toBeDefined();
    if (Array.isArray(option.series)) {
      const data = option.series[0].data as Array<{name: string; itemStyle: {color: string}}>;
      expect(data[0].name).toBe('Matemáticas');
      expect(data[0].itemStyle.color).not.toBe(DEFAULT_DARK_THEME.destructive);

      expect(data[1].name).toBe('Riesgo Alto');
      expect(data[1].itemStyle.color).toBe(DEFAULT_DARK_THEME.riskColors.high);
    }
  });

  it('buildLineOption should contain an area gradient', () => {
    const option = buildLineOption(sampleData, 'Tendencia', DEFAULT_DARK_THEME);

    expect(option.series).toBeDefined();
    if (Array.isArray(option.series)) {
      expect(option.series[0].type).toBe('line');
      expect(option.series[0].data).toEqual([85, 15]);
      expect(option.series[0]).toMatchObject({ areaStyle: { color: { type: 'linear' } } });
    }
  });

  it('buildScatterOption should return a scatter series', () => {
    const option = buildScatterOption(
      [{ x: 1, y: 2 }],
      'Scatter',
      DEFAULT_DARK_THEME,
    );
    expect((option.series as Array<{type: string; name?: string}>)[0].type).toBe('scatter');
  });

  it('buildClusteringScatterOption should map clusters to series', () => {
    const option = buildClusteringScatterOption(
      { clusters: [{ name: 'A', data: [{ x: 1, y: 2 }] }] },
      'Clustering',
      DEFAULT_DARK_THEME,
    );
    expect((option.series as Array<{type: string; name?: string}>)[0].name).toBe('A');
    expect((option.series as Array<{type: string; name?: string}>)[0].type).toBe('scatter');
  });

  it('buildRegressionScatterOption should return a scatter and a line series', () => {
    const option = buildRegressionScatterOption(
      {
        points: [{ x: 1, y: 2 }],
        line: [
          { x: 1, y: 2 },
          { x: 2, y: 4 },
        ],
      },
      'Regresión',
      DEFAULT_DARK_THEME,
    );
    expect((option.series as Array<{type: string; name?: string}>).length).toBe(2);
    expect((option.series as Array<{type: string; name?: string}>)[0].type).toBe('scatter');
    expect((option.series as Array<{type: string; name?: string}>)[1].type).toBe('line');
  });
});


describe('Donut semantics and proportions', () => {
  it('preserves input order and raw values instead of guessing percentages', () => {
    const option = buildDonutOption([{label:'B',value:3},{label:'A',value:1}]);
    expect(option.series).toMatchObject([{ data: [{ name:'B', value:3 },{ name:'A',value:1 }] }]);
    expect(option.aria?.label?.description).toContain('B: 3 (75%)');
    expect(option.aria?.label?.description).toContain('A: 1 (25%)');
  });
  it('does not derive risk from display text', () => {
    const option = buildDonutOption([{label:'Riesgo Alto',value:4},{label:'High risk',value:2}]);
    expect(option.series).toMatchObject([{ data: [
      {itemStyle:{color:DEFAULT_DARK_THEME.chartColors[0]}},
      {itemStyle:{color:DEFAULT_DARK_THEME.chartColors[1]}},
    ] }]);
  });
  it('does not fabricate shares for a zero sum and adapts the legend to narrow charts', () => {
    const option=buildDonutOption([{label:'A',value:0}], undefined, DEFAULT_DARK_THEME, 300);
    expect(option.series).toMatchObject([{stillShowZeroSum:false}]);
    expect(option.legend).toMatchObject({orient:'horizontal',bottom:0});
    expect(option.aria?.label?.description).not.toContain('NaN');
  });
});
