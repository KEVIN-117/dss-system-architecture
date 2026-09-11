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
    { label: 'Riesgo Alto', value: 15 },
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
      expect((option.series[0] as any).itemStyle.color).toBe(
        DEFAULT_DARK_THEME.chartColors[0],
      );
    }
  });

  it('buildDonutOption should assign destructive color to "Riesgo" labels', () => {
    const option = buildDonutOption(
      sampleData,
      'Riesgo de Deserción',
      DEFAULT_DARK_THEME,
    );

    expect(option.series).toBeDefined();
    if (Array.isArray(option.series)) {
      const data = option.series[0].data as any[];
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
      const areaColor = (option.series[0] as any).areaStyle.color;
      expect(areaColor.type).toBe('linear');
    }
  });

  it('buildScatterOption should return a scatter series', () => {
    const option = buildScatterOption(
      [{ x: 1, y: 2 }],
      'Scatter',
      DEFAULT_DARK_THEME,
    );
    expect((option.series as any[])[0].type).toBe('scatter');
  });

  it('buildClusteringScatterOption should map clusters to series', () => {
    const option = buildClusteringScatterOption(
      { clusters: [{ name: 'A', data: [{ x: 1, y: 2 }] }] },
      'Clustering',
      DEFAULT_DARK_THEME,
    );
    expect((option.series as any[])[0].name).toBe('A');
    expect((option.series as any[])[0].type).toBe('scatter');
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
    expect((option.series as any[]).length).toBe(2);
    expect((option.series as any[])[0].type).toBe('scatter');
    expect((option.series as any[])[1].type).toBe('line');
  });
});
