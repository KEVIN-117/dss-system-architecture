import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ForecastBandChart, forecastPeriodLabel, type ForecastBandPoint } from './forecast-band-chart';

type Factory = (theme: Record<string, unknown>, width: number, height: number) => Record<string, unknown>;

// Render the ECharts option instead of a canvas, so the spec checks what the chart is told to draw.
vi.mock('./base-chart', () => ({
  BaseChart: ({ option, empty }: { option: Factory; empty?: boolean }) => {
    const theme = {
      chartColors: ['#111', '#222'], mutedForeground: '#666', gridLine: '#ddd',
      alpha: (color: string, opacity: number) => `${color}/${opacity}`,
    };
    return <pre data-testid="chart" data-empty={String(Boolean(empty))}>{JSON.stringify(option(theme, 800, 340))}</pre>;
  },
}));

afterEach(cleanup);

function drawn(): { series: Array<{ name: string; data: unknown[] }>; xAxis: { data?: string[] } } {
  return JSON.parse(screen.getByTestId('chart').textContent ?? '{}');
}

describe('ForecastBandChart', () => {
  it('joins history and projection and stacks the prediction bands', () => {
    const points: ForecastBandPoint[] = [
      { year: 2025, period: 1, kind: 'HISTORY', horizon: null, value: 100, interval: null },
      { year: 2025, period: 2, kind: 'HISTORY', horizon: null, value: 110, interval: null },
      { year: 2026, period: 1, kind: 'FORECAST', horizon: 1, value: 120,
        interval: { '0.8': { lower: 112, upper: 128 }, '0.95': { lower: 105, upper: 135 } } },
    ];
    render(<ForecastBandChart points={points} cadence="SEMESTRAL" />);

    const series = Object.fromEntries(drawn().series.map((item) => [item.name, item.data]));
    expect(drawn().xAxis.data).toEqual(['2025-1', '2025-2', '2026-1']);
    expect(series['Histórico']).toEqual([100, 110, null]);
    // The projection starts at the last observed point so both lines join.
    expect(series['Proyección']).toEqual([null, 110, 120]);
    expect(series['Banda 95 % base']).toEqual([null, null, 105]);
    expect(series['Banda 95 %']).toEqual([null, null, 30]);
    expect(series['Banda 80 %']).toEqual([null, null, 16]);
  });

  it('labels annual and semester periods and flags an empty series', () => {
    expect(forecastPeriodLabel({ year: 2026, period: 1 }, 'ANUAL')).toBe('2026');
    expect(forecastPeriodLabel({ year: 2026, period: 2 }, 'SEMESTRAL')).toBe('2026-2');
    render(<ForecastBandChart points={[]} cadence="ANUAL" />);
    expect(screen.getByTestId('chart').getAttribute('data-empty')).toBe('true');
  });
});
