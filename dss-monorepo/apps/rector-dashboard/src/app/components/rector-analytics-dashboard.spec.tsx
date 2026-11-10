import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@dss-monorepo/charts', () => ({
  RiskDonutChart: ({
    data,
    ariaLabel,
    loading,
  }: {
    data: Array<{ label: string; value: number }>;
    ariaLabel: string;
    loading: boolean;
  }) => (
    <div role="img" aria-label={ariaLabel}>
      {loading
        ? 'Cargando gráfico'
        : data.map((point) => point.label).join(', ')}
    </div>
  ),
  TrendLineChart: ({
    data,
    ariaLabel,
    loading,
  }: {
    data: Array<{ label: string; value: number }>;
    ariaLabel: string;
    loading: boolean;
  }) => (
    <div role="img" aria-label={ariaLabel}>
      {loading
        ? 'Cargando gráfico'
        : data.map((point) => point.label).join(', ')}
    </div>
  ),
}));

import { RectorAnalyticsDashboard } from './rector-analytics-dashboard';

const cubeId = 'academic/UATF/UATF/Academic Performance';
const schema = {
  measures: {
    enrolled: { name: 'Enrollment Attempts', unit: 'intentos' },
    average: { name: 'Average Final Grade', unit: 'puntos' },
  },
  dimensions: {
    program: {
      name: 'Academic Program',
      hierarchies: {
        program: { name: 'Program', levels: { faculty: { name: 'Faculty' } } },
      },
    },
    period: {
      name: 'Academic Period',
      hierarchies: {
        period: {
          name: 'Academic Period',
          levels: {
            year: { name: 'Academic Year' },
            number: { name: 'Period Number' },
          },
        },
      },
    },
  },
};

function setupFetch(options?: { failCubes?: boolean; emptyCubes?: boolean }) {
  const requests: Array<{
    query: string;
    variables?: Record<string, unknown>;
  }> = [];
  const fetchMock = vi.fn(
    async (_input: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as {
        query: string;
        variables?: Record<string, unknown>;
      };
      requests.push(body);
      if (body.query.includes('RectorCubes')) {
        if (options?.failCubes)
          return new Response(
            JSON.stringify({ errors: [{ message: 'BFF unavailable' }] }),
            { status: 503 },
          );
        return new Response(
          JSON.stringify({
            data: {
              olapCubes: options?.emptyCubes
                ? []
                : [{ cubeId, cubeName: 'Academic Performance' }],
            },
          }),
          { status: 200 },
        );
      }
      if (body.query.includes('RectorCubeSchema'))
        return new Response(
          JSON.stringify({ data: { olapCubeSchema: schema } }),
          { status: 200 },
        );
      if (body.query.includes('RectorCubeMembers'))
        return new Response(
          JSON.stringify({
            data: {
              olapCubeMembers: [
                {
                  name: '2025',
                  uniqueName:
                    '[Academic Period].[Academic Period].[Academic Year].&[2025]',
                  caption: '2025',
                },
                {
                  name: '2026',
                  uniqueName:
                    '[Academic Period].[Academic Period].[Academic Year].&[2026]',
                  caption: '2026',
                },
              ],
            },
          }),
          { status: 200 },
        );

      const input = body.variables?.input as {
        measures?: Array<{ name: string }>;
        rows?: unknown[];
        filters?: unknown[];
      };
      if (input.measures?.length === 2)
        return new Response(
          JSON.stringify({
            data: {
              analyticQuery: {
                data: [
                  {
                    'Enrollment Attempts': { value: 1280 },
                    'Average Final Grade': { value: 72.5 },
                  },
                ],
                totalRows: 1,
              },
            },
          }),
          { status: 200 },
        );
      if (input.rows?.length === 2)
        return new Response(
          JSON.stringify({
            data: {
              analyticQuery: {
                data: [
                  {
                    'Academic Year': '2025',
                    'Period Number': 1,
                    'Enrollment Attempts': { value: 120 },
                  },
                  {
                    'Academic Year': '2025',
                    'Period Number': 2,
                    'Enrollment Attempts': { value: 140 },
                  },
                ],
                totalRows: 2,
              },
            },
          }),
          { status: 200 },
        );
      return new Response(
        JSON.stringify({
          data: {
            analyticQuery: {
              data: [
                {
                  Faculty: 'Ingeniería',
                  'Enrollment Attempts': { value: 700 },
                },
                {
                  Faculty: 'Ciencias Puras',
                  'Enrollment Attempts': { value: 580 },
                },
              ],
              totalRows: 2,
            },
          },
        }),
        { status: 200 },
      );
    },
  );
  vi.stubGlobal('fetch', fetchMock);
  return { fetchMock, requests };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  window.history.replaceState({}, '', '/');
});

beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_BFF_URL', 'http://localhost:3006');
});

describe('RectorAnalyticsDashboard', () => {
  it('loads published OLAP indicators, charts, and periods from the authenticated BFF', async () => {
    const { requests } = setupFetch();
    render(<RectorAnalyticsDashboard />);

    expect(await screen.findByText('1.280')).toBeTruthy();
    expect(screen.getByText('72,5')).toBeTruthy();
    expect(
      screen.getByRole('img', {
        name: /intentos de inscripción por facultad/i,
      }),
    ).toBeTruthy();
    expect(
      screen.getByRole('img', {
        name: /tendencia de intentos de inscripción/i,
      }),
    ).toBeTruthy();
    expect(
      requests.some((request) => request.query.includes('olapCubeSchema')),
    ).toBe(true);
    expect(
      requests.every((request) => request.variables?.scope === undefined),
    ).toBe(true);
  });

  it('re-runs the data query when a schema-published academic year is selected', async () => {
    const { requests } = setupFetch();
    render(<RectorAnalyticsDashboard />);
    await screen.findByText('1.280');

    fireEvent.change(screen.getByLabelText('Gestión académica'), {
      target: { value: '2026' },
    });
    await waitFor(() =>
      expect(
        requests.filter((request) =>
          request.query.includes('RectorAnalyticQuery'),
        ).length,
      ).toBe(5),
    );

    const filteredInputs = requests
      .filter((request) => request.query.includes('RectorAnalyticQuery'))
      .slice(-2)
      .map(
        (request) =>
          request.variables?.input as {
            filters?: Array<{
              dimension: string;
              level: string;
              members: string[];
            }>;
          },
      );
    expect(
      filteredInputs.every(
        (input) => input.filters?.[0]?.dimension === 'Academic Period',
      ),
    ).toBe(true);
    expect(
      filteredInputs.every((input) =>
        input.filters?.[0]?.members[0].endsWith('&[2026]'),
      ),
    ).toBe(true);
    expect(new URLSearchParams(window.location.search).get('gestion')).toBe(
      '2026',
    );
    expect(screen.getByText('Intentos acumulados · gestión 2026')).toBeTruthy();
    expect(screen.getByText('Nota final promedio · gestión 2026')).toBeTruthy();
    expect(screen.getByText(/Selecciona “Todas las gestiones”/)).toBeTruthy();
  });

  it('restores a valid academic year from the URL', async () => {
    const { requests } = setupFetch();
    window.history.replaceState({}, '', '/?gestion=2025');
    render(<RectorAnalyticsDashboard />);

    await screen.findByText('1.280');
    expect(
      (screen.getByLabelText('Gestión académica') as HTMLSelectElement).value,
    ).toBe('2025');
    const analyticsRequests = requests.filter((request) =>
      request.query.includes('RectorAnalyticQuery'),
    );
    await waitFor(() => expect(analyticsRequests.length).toBe(2));
    expect(
      analyticsRequests.every((request) => {
        const input = request.variables?.input as {
          filters?: Array<{ members: string[] }>;
        };
        return input.filters?.[0]?.members[0].endsWith('&[2025]');
      }),
    ).toBe(true);
  });

  it('shows an actionable error and supports retry when the BFF is unavailable', async () => {
    const { fetchMock } = setupFetch({ failCubes: true });
    render(<RectorAnalyticsDashboard />);
    expect(await screen.findByRole('alert')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  });

  it('explains when the academic cube is not available to the account', async () => {
    setupFetch({ emptyCubes: true });
    render(<RectorAnalyticsDashboard />);
    expect((await screen.findByRole('status')).textContent).toContain(
      'no está publicado',
    );
  });
});
