import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@dss-monorepo/charts', () => ({
  TrendLineChart: ({
    data,
    ariaLabel,
  }: {
    data: Array<{ label: string; value: number }>;
    ariaLabel: string;
  }) => (
    <div role="img" aria-label={ariaLabel}>
      {data.map((point) => point.label).join(', ')}
    </div>
  ),
}));

import { RectorAnalyticsDashboard } from './rector-analytics-dashboard';

const admissionCubeId = 'academic/UATF/UATF/Admision';
const retentionCubeId = 'academic/UATF/UATF/Permanencia';

const periodDimension = {
  name: 'Periodo',
  hierarchies: {
    period: {
      name: 'Gestión y periodo',
      levels: { year: { name: 'Gestión' }, number: { name: 'Periodo' } },
    },
  },
};

const admissionSchema = {
  measures: {
    applications: { name: 'Postulaciones' },
    admitted: { name: 'Admitidos' },
    known: { name: 'Postulaciones con resultado' },
  },
  dimensions: {
    period: periodDimension,
    program: {
      name: 'Programa',
      hierarchies: {
        program: {
          name: 'Facultad y carrera',
          levels: { faculty: { name: 'Facultad' } },
        },
      },
    },
  },
};

const retentionSchema = {
  measures: {
    retained: { name: 'Permanecen' },
    evaluated: { name: 'Estudiantes evaluados' },
  },
  dimensions: { period: periodDimension },
};

type AnalyticInput = {
  cubeId: string;
  measures?: Array<{ name: string }>;
  rows?: Array<{ level: string }>;
  filters?: Array<{ dimension: string; level: string; members: string[] }>;
};

type GraphqlRequest = {
  query: string;
  variables?: Record<string, unknown>;
};

const ok = (data: unknown) =>
  new Response(JSON.stringify({ data }), { status: 200 });

function analyticRows(input: AnalyticInput) {
  if (input.cubeId === retentionCubeId)
    return [{ Permanecen: { value: 800 }, 'Estudiantes evaluados': 1000 }];
  const level = input.rows?.[0]?.level;
  if (level === 'Facultad')
    return [
      {
        Facultad: 'Ingeniería',
        Postulaciones: { value: 700 },
        Admitidos: 350,
        'Postulaciones con resultado': 600,
      },
      {
        Facultad: 'Ciencias Puras',
        Postulaciones: { value: 580 },
        Admitidos: 290,
        'Postulaciones con resultado': 400,
      },
    ];
  if (level === 'Gestión')
    return [
      { 'Gestión': '2026', Postulaciones: 680 },
      { 'Gestión': '2025', Postulaciones: 600 },
    ];
  return [
    {
      Postulaciones: { value: 1280 },
      Admitidos: { value: 640 },
      'Postulaciones con resultado': { value: 1000 },
    },
  ];
}

function setupFetch(options?: { failCubes?: boolean; emptyCubes?: boolean }) {
  const requests: GraphqlRequest[] = [];
  const fetchMock = vi.fn(
    async (_input: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as GraphqlRequest;
      requests.push(body);
      if (body.query.includes('RectorCubes')) {
        if (options?.failCubes)
          return new Response(
            JSON.stringify({ errors: [{ message: 'BFF unavailable' }] }),
            { status: 503 },
          );
        return ok({
          olapCubes: options?.emptyCubes
            ? []
            : [
                { cubeId: admissionCubeId, cubeName: 'Admisión' },
                { cubeId: retentionCubeId, cubeName: 'Permanencia y deserción' },
              ],
        });
      }
      if (body.query.includes('RectorCubeSchema'))
        return ok({
          olapCubeSchema:
            body.variables?.cubeId === retentionCubeId
              ? retentionSchema
              : admissionSchema,
        });
      if (body.query.includes('RectorCubeMembers'))
        return ok({
          olapCubeMembers: ['2025', '2026'].map((year) => ({
            name: year,
            uniqueName: `[Periodo].[Gestión y periodo].[Gestión].&[${year}]`,
            caption: year,
          })),
        });

      const input = body.variables?.input as AnalyticInput;
      return ok({
        analyticQuery: { data: analyticRows(input), totalRows: 1 },
      });
    },
  );
  vi.stubGlobal('fetch', fetchMock);
  return { fetchMock, requests };
}

function analyticInputs(requests: GraphqlRequest[]): AnalyticInput[] {
  return requests
    .filter((request) => request.query.includes('RectorAnalyticQuery'))
    .map((request) => request.variables?.input as AnalyticInput);
}

/** Year-scoped queries: the overall and faculty admission queries plus retention. */
function yearScoped(inputs: AnalyticInput[]): AnalyticInput[] {
  return inputs.filter((input) => input.rows?.[0]?.level !== 'Gestión');
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
  it('loads admission and retention indicators from the authenticated BFF', async () => {
    const { requests } = setupFetch();
    render(<RectorAnalyticsDashboard />);

    expect(await screen.findByText('1.280')).toBeTruthy();
    expect(screen.getAllByText('640').length).toBeGreaterThan(0);
    // 640 admitted applications out of 1 000 with a known result.
    expect(screen.getByText('64 %')).toBeTruthy();
    // 800 retained out of 1 000 evaluable records.
    expect(screen.getByText('80 %')).toBeTruthy();
    expect(
      screen.getByRole('list', {
        name: /facultades ordenadas por postulaciones/i,
      }),
    ).toBeTruthy();
    expect(
      screen.getByRole('img', { name: 'Ingeniería: 700 postulaciones' }),
    ).toBeTruthy();
    expect(
      screen.getByRole('img', {
        name: 'Postulaciones registradas por gestión',
      }).textContent,
    ).toBe('2025, 2026');
    expect(
      requests.some((request) => request.query.includes('olapCubeSchema')),
    ).toBe(true);
    expect(
      requests.every((request) => request.variables?.scope === undefined),
    ).toBe(true);
  });

  it('re-runs the year-scoped queries when another academic year is selected', async () => {
    const { requests } = setupFetch();
    render(<RectorAnalyticsDashboard />);
    await screen.findByText('1.280');
    // The latest published year is selected by default.
    expect(
      (screen.getByLabelText('Gestión académica') as HTMLSelectElement).value,
    ).toBe('2026');

    const before = analyticInputs(requests).length;
    fireEvent.change(screen.getByLabelText('Gestión académica'), {
      target: { value: '2025' },
    });

    await waitFor(() =>
      expect(new URLSearchParams(window.location.search).get('gestion')).toBe(
        '2025',
      ),
    );
    const rerun = yearScoped(analyticInputs(requests).slice(before));
    expect(rerun.length).toBe(3);
    expect(
      rerun.every(
        (input) =>
          input.filters?.[0]?.dimension === 'Periodo' &&
          input.filters[0].members[0].endsWith('&[2025]'),
      ),
    ).toBe(true);
    expect(screen.getByText('Gestión 2025')).toBeTruthy();
  });

  it('restores a valid academic year from the URL', async () => {
    const { requests } = setupFetch();
    window.history.replaceState({}, '', '/?gestion=2025');
    render(<RectorAnalyticsDashboard />);

    await screen.findByText('1.280');
    expect(
      (screen.getByLabelText('Gestión académica') as HTMLSelectElement).value,
    ).toBe('2025');
    const scoped = yearScoped(analyticInputs(requests));
    expect(scoped.length).toBeGreaterThan(0);
    expect(
      scoped.every((input) => input.filters?.[0]?.members[0].endsWith('&[2025]')),
    ).toBe(true);
  });

  it('shows an actionable error and supports retry when the BFF is unavailable', async () => {
    const { fetchMock } = setupFetch({ failCubes: true });
    render(<RectorAnalyticsDashboard />);
    expect(await screen.findByRole('alert')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  });

  it('explains when the admission cube is not available to the account', async () => {
    setupFetch({ emptyCubes: true });
    render(<RectorAnalyticsDashboard />);
    expect((await screen.findByRole('status')).textContent).toContain(
      'no está publicado',
    );
  });
});
