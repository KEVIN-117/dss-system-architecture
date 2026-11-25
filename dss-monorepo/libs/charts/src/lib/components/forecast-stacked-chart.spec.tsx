import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ForecastStackedChart } from './forecast-stacked-chart';

type Factory = (theme: Record<string, unknown>, width: number, height: number) => Record<string, unknown>;

vi.mock('./base-chart', () => ({
  BaseChart: ({ option, empty, ariaLabel }: { option: Factory; empty?: boolean; ariaLabel?: string }) => {
    const theme = {
      chartColors: ['#111', '#222', '#333'],
      mutedForeground: '#666',
      gridLine: '#ddd',
      alpha: (color: string, opacity: number) => `${color}/${opacity}`,
    };
    return (
      <pre data-testid="base-chart" data-empty={String(Boolean(empty))} aria-label={ariaLabel}>
        {JSON.stringify(option(theme, 800, 380))}
      </pre>
    );
  },
}));

afterEach(cleanup);

describe('ForecastStackedChart', () => {
  it('builds a stacked series per program across unified periods', () => {
    render(
      <ForecastStackedChart
        cadence="SEMESTRAL"
        seriesList={[
          {
            programRef: 'SIS',
            label: 'Sistemas (SIS)',
            points: [
              { year: 2024, period: 1, kind: 'HISTORY', horizon: null, value: 100, interval: null },
              { year: 2024, period: 2, kind: 'FORECAST', horizon: 1, value: 110, interval: null },
            ],
          },
          {
            programRef: 'MED',
            label: 'Medicina (MED)',
            points: [
              { year: 2024, period: 1, kind: 'HISTORY', horizon: null, value: 200, interval: null },
              { year: 2024, period: 2, kind: 'FORECAST', horizon: 1, value: 220, interval: null },
            ],
          },
        ]}
      />,
    );

    const chart = screen.getByTestId('base-chart');
    expect(chart.getAttribute('data-empty')).toBe('false');
    const option = JSON.parse(chart.textContent ?? '{}') as {
      series: Array<{ name: string; stack: string; data: number[] }>;
    };
    expect(option.series.map((s) => s.name)).toEqual(['Sistemas (SIS)', 'Medicina (MED)']);
    expect(option.series.every((s) => s.stack === 'programs')).toBe(true);
    expect(option.series[0].data).toEqual([100, 110]);
  });

  it('marks chart empty when there are no series', () => {
    render(<ForecastStackedChart seriesList={[]} />);
    expect(screen.getByTestId('base-chart').getAttribute('data-empty')).toBe('true');
  });
});
