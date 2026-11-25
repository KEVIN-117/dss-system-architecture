import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ForecastPanel } from './forecast-panel';

vi.mock('@dss-monorepo/auth', () => ({
  useAuth: () => ({ hasPermission: () => true }),
}));

vi.mock('@dss-monorepo/charts', () => ({
  ForecastBandChart: ({ points }: { points: unknown[] }) => <div data-testid="forecast-chart">{points.length} puntos</div>,
  ForecastStackedChart: ({ seriesList }: { seriesList: unknown[] }) => (
    <div data-testid="forecast-stacked-chart">{seriesList.length} carreras</div>
  ),
  forecastPeriodLabel: (point: { year: number; period: number }, cadence?: string | null) =>
    cadence === 'ANUAL' ? String(point.year) : `${point.year}-${point.period}`,
}));

// KpiCard animates with GSAP; render label, formatted value and detail only.
vi.mock('@dss-monorepo/design-system/page', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@dss-monorepo/design-system/page')>()),
  KpiCard: ({ label, value, format, detail }: { label: string; value?: number | null; format: (v: number) => string; detail?: string }) => (
    <div data-testid="kpi">
      {label}: {value == null ? '—' : format(value)} {detail}
    </div>
  ),
}));

const BFF = 'http://bff.test';

const SIS_POINTS = [
  { year: 2023, period: 1, kind: 'HISTORY', horizon: null, value: 120, interval: null },
  { year: 2024, period: 1, kind: 'HISTORY', horizon: null, value: 132, interval: null },
  { year: 2025, period: 1, kind: 'FORECAST', horizon: 1, value: 140, interval: { '0.8': { lower: 130, upper: 150 }, '0.95': { lower: 124, upper: 156 } } },
  { year: 2026, period: 1, kind: 'FORECAST', horizon: 2, value: 147, interval: { '0.8': { lower: 133, upper: 161 }, '0.95': { lower: 125, upper: 169 } } },
];

function run(programRef: string, extra: Record<string, unknown> = {}) {
  return {
    run_id: `run-${programRef}`, series_code: 'APPLICATIONS_BY_PROGRAM', program_ref: programRef, cadence: 'SEMESTRAL',
    horizon: 2, model_kind: 'linear_trend', history_points: 2, created_at: '2026-11-24T10:00:00Z', ...extra,
  };
}

function json(body: unknown, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }));
}

/** Routes the BFF facade by path and query; ``listing`` and ``detail`` vary per test. */
function stubBff({ listing = [run('SIS'), run('MED')], detail = (ref: string) => json(run(ref, { points: SIS_POINTS })) }: {
  listing?: unknown[];
  detail?: (programRef: string) => Promise<Response>;
} = {}) {
  const fetchMock = vi.fn((input: RequestInfo | URL, _init?: RequestInit) => {
    const url = new URL(String(input));
    if (url.pathname.endsWith('/v1/academic-options')) {
      return json({ programs: [{ program_ref: 'SIS', name: 'Ingeniería de Sistemas' }], cuts: [] });
    }
    const programRef = url.searchParams.get('program_ref');
    return programRef ? detail(programRef) : json({ series: url.searchParams.get('series'), forecasts: listing });
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function forecastCalls(fetchMock: ReturnType<typeof stubBff>) {
  return fetchMock.mock.calls.map(([input]) => new URL(String(input))).filter((url) => url.pathname.endsWith('/v1/forecasts'));
}

beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_BFF_URL', BFF);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('ForecastPanel', () => {
  it('lists the programs returned for the caller scope and shows the forecast of the first one', async () => {
    const fetchMock = stubBff();
    render(<ForecastPanel />);

    expect((await screen.findByTestId('forecast-chart')).textContent).toContain('4 puntos');
    const program = screen.getByLabelText('Programa') as HTMLSelectElement;
    expect(Array.from(program.options).map((option) => option.textContent)).toEqual([
      'Ingeniería de Sistemas (SIS)',
      'MED',
    ]);
    await waitFor(() => expect(screen.getAllByTestId('kpi')[1].textContent).toContain('Proyección 2025-1: 140 Banda 80 %: 130 – 150'));
    expect(screen.getAllByTestId('kpi')[0].textContent).toContain('Último periodo observado (2024-1): 132');
    expect(screen.getAllByTestId('kpi')[2].textContent).toContain('Modelo: Tendencia lineal');

    const [listing, detail] = forecastCalls(fetchMock);
    expect(Object.fromEntries(listing.searchParams)).toEqual({ series: 'APPLICATIONS_BY_PROGRAM', cadence: 'SEMESTRAL' });
    expect(Object.fromEntries(detail.searchParams)).toEqual({ series: 'APPLICATIONS_BY_PROGRAM', program_ref: 'SIS', cadence: 'SEMESTRAL' });
    expect(fetchMock.mock.calls.every(([, init]) => (init as RequestInit).credentials === 'include')).toBe(true);
  });

  it('switches to the enrolled-students series', async () => {
    const fetchMock = stubBff();
    render(<ForecastPanel />);
    await screen.findByTestId('forecast-chart');

    fireEvent.change(screen.getByLabelText('Serie'), { target: { value: 'ENROLLED_BY_PROGRAM' } });

    await waitFor(() =>
      expect(forecastCalls(fetchMock).some((url) => url.searchParams.get('series') === 'ENROLLED_BY_PROGRAM')).toBe(true),
    );
  });

  it('explains that there is nothing to show when no program of the scope has a forecast', async () => {
    stubBff({ listing: [] });
    render(<ForecastPanel scope="career" />);

    expect(await screen.findByText('No hay pronósticos de postulaciones para tu alcance')).toBeTruthy();
    expect(screen.getByText('Solo ves tu carrera.')).toBeTruthy();
    expect(screen.queryByTestId('forecast-chart')).toBeNull();
  });

  it('reports a program outside the academic scope', async () => {
    stubBff({ listing: [run('SIS')], detail: () => json({ code: 'INSUFFICIENT_SCOPE' }, 403) });
    render(<ForecastPanel scope="faculty" />);

    expect(await screen.findByText(/fuera de tu alcance académico/)).toBeTruthy();
    expect(screen.getByText('Solo ves los programas de tu facultad.')).toBeTruthy();
  });
});
