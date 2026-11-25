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
  ForecastBandChart: ({ points, cadence }: { points: unknown[]; cadence?: string | null }) => (
    <div data-testid="forecast-band-chart">{`${points.length} puntos · ${cadence}`}</div>
  ),
  forecastPeriodLabel: (point: { year: number; period: number }, cadence?: string | null) =>
    cadence === 'ANUAL' ? String(point.year) : `${point.year}-${point.period}`,
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

  // The band chart itself is specified in @dss-monorepo/charts (forecast-band-chart.spec.tsx).
  it('delegates forecasts to the shared band chart', () => {
    const points: ForecastPoint[] = [
      { year: 2025, period: 1, kind: 'HISTORY', horizon: null, value: 100, interval: null },
      { year: 2026, period: 1, kind: 'FORECAST', horizon: 1, value: 120, interval: { '0.8': { lower: 112, upper: 128 } } },
    ];
    render(<ForecastChart points={points} cadence="SEMESTRAL" />);

    expect(screen.getByTestId('forecast-band-chart').textContent).toBe('2 puntos · SEMESTRAL');
    expect(periodLabel({ year: 2026, period: 1 }, 'ANUAL')).toBe('2026');
    expect(periodLabel({ year: 2026, period: 2 }, 'SEMESTRAL')).toBe('2026-2');
  });
});
