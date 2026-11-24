import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

type Factory = (theme: Record<string, unknown>, width: number) => Record<string, unknown>;

// Render the ECharts option instead of a canvas, so the specs check what the chart is told to draw.
vi.mock('@dss-monorepo/charts', () => ({
  BaseChart: ({ option, ariaLabel, empty }: { option: Factory; ariaLabel: string; empty?: boolean }) => {
    const theme = {
      chartColors: ['#111', '#222'], foreground: '#000', mutedForeground: '#666', gridLine: '#ddd',
      destructive: '#f00', alpha: (color: string, opacity: number) => `${color}/${opacity}`,
    };
    return <pre data-testid="chart" aria-label={ariaLabel} data-empty={String(Boolean(empty))}>{JSON.stringify(option(theme, 800))}</pre>;
  },
}));

import { CorrelationChart, CountBarChart, ForecastChart, ResidualsChart, periodLabel } from './studio-charts';
import type { ForecastPoint } from '../../data-access/ml-studio';

function drawn(): { series: Array<{ name: string; data: unknown[] }>; xAxis: { data?: string[] }; yAxis: { data?: string[] } } {
  return JSON.parse(screen.getByTestId('chart').textContent ?? '{}');
}

describe('studio charts', () => {
  it('draws counts per category and flags empty data', () => {
    const { rerender } = render(<CountBarChart ariaLabel="Filas" items={[{ key: '2024-1', count: 3 }]} />);
    expect(drawn().xAxis.data).toEqual(['2024-1']);
    rerender(<CountBarChart ariaLabel="Filas" items={[]} />);
    expect(screen.getByTestId('chart').getAttribute('data-empty')).toBe('true');
  });

  it('draws correlations as horizontal bars, negative values highlighted', () => {
    render(<CorrelationChart correlations={[{ field: 'a', correlation: 0.5 }, { field: 'b', correlation: -0.3 }]} />);
    const chart = drawn();
    expect(chart.yAxis.data).toEqual(['a', 'b']);
    expect(chart.series[0].data).toEqual([{ value: 0.5 }, { value: -0.3, itemStyle: { color: '#f00' } }]);
  });

  it('draws regression error and bias per bucket, or explains their absence', () => {
    const { rerender } = render(
      <ResidualsChart
        metrics={{
          mae: 1, rmse: 1, r2: 1, mape: null, bias: 0, interval_coverage: null, test_row_count: 4,
          residuals_by_bucket: [{ observed_min: 0, observed_max: 10, count: 4, mae: 2, bias: -1 }],
        }}
      />,
    );
    expect(drawn().series.map((item) => item.data)).toEqual([[2], [-1]]);
    rerender(<ResidualsChart metrics={null} />);
    expect(screen.getByText('El candidato no publicó residuos por tramo.')).toBeTruthy();
  });

  it('joins history and projection and stacks the prediction bands', () => {
    const points: ForecastPoint[] = [
      { year: 2025, period: 1, kind: 'HISTORY', horizon: null, value: 100, interval: null },
      { year: 2025, period: 2, kind: 'HISTORY', horizon: null, value: 110, interval: null },
      { year: 2026, period: 1, kind: 'FORECAST', horizon: 1, value: 120, interval: { '0.8': { lower: 112, upper: 128 }, '0.95': { lower: 105, upper: 135 } } },
    ];
    render(<ForecastChart points={points} cadence="SEMESTRAL" />);

    const series = Object.fromEntries(drawn().series.map((item) => [item.name, item.data]));
    expect(drawn().xAxis.data).toEqual(['2025-1', '2025-2', '2026-1']);
    expect(series['Histórico']).toEqual([100, 110, null]);
    expect(series['Proyección']).toEqual([null, 110, 120]);
    expect(series['Banda 95 % base']).toEqual([null, null, 105]);
    expect(series['Banda 95 %']).toEqual([null, null, 30]);
    expect(series['Banda 80 %']).toEqual([null, null, 16]);
    expect(periodLabel({ year: 2026, period: 1 }, 'ANUAL')).toBe('2026');
  });
});
