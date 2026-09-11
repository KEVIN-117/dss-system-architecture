import { describe, it, expect } from 'vitest';
import { buildBarOption, buildDonutOption, buildLineOption, ChartDataPoint } from './builders';
import { DEFAULT_DARK_THEME } from './theme';

describe('Pure ECharts Builders', () => {
  const sampleData: ChartDataPoint[] = [
    { label: 'Matemáticas', value: 85 },
    { label: 'Riesgo Alto', value: 15 },
  ];

  it('buildBarOption should return a valid ECharts option with primary color', () => {
    const option = buildBarOption(sampleData, 'Rendimiento', DEFAULT_DARK_THEME);
    
    expect(option.title).toBeDefined();
    if (option.title && !Array.isArray(option.title)) {
        expect(option.title.text).toBe('Rendimiento');
    }

    expect(option.series).toBeDefined();
    if (Array.isArray(option.series)) {
        expect(option.series[0].type).toBe('bar');
        expect(option.series[0].data).toEqual([85, 15]);
        // Theme extraction test
        expect((option.series[0] as any).itemStyle.color).toBe(DEFAULT_DARK_THEME.chartColors[0]);
    }
  });

  it('buildDonutOption should assign destructive color to "Riesgo" labels', () => {
    const option = buildDonutOption(sampleData, 'Riesgo de Deserción', DEFAULT_DARK_THEME);
    
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
});
