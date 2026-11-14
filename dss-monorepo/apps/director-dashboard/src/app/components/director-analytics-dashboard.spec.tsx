import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@dss-monorepo/charts', () => ({
  AcademicBarChart: ({
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

import { DirectorAnalyticsDashboard } from './director-analytics-dashboard';

const cubeId = 'academic/UATF/UATF/Academic Performance';
const schema = {
  measures: {
    attempts: { name: 'Inscripciones en materias', unit: 'intentos' },
    average: { name: 'Nota promedio', unit: 'puntos' },
    graded: { name: 'Inscripciones con resultado', unit: 'calificaciones' },
    privateCount: { name: 'Conteo de privacidad', visible: false },
  },
  dimensions: {
    period: {
      name: 'Periodo',
      hierarchies: {
        period: {
          name: 'Gestión y periodo',
          levels: {
            year: { name: 'Gestión' },
            number: { name: 'Periodo' },
          },
        },
      },
    },
  },
};

function setupFetch(options?: {
  missingContext?: boolean;
  emptyCube?: boolean;
  emptyResults?: boolean;
  failViewerOnce?: boolean;
  duplicatePeriod?: boolean;
}) {
  const requests: Array<{
    query: string;
    variables?: Record<string, unknown>;
  }> = [];
  let failViewerOnce = options?.failViewerOnce ?? false;
  const fetchMock = vi.fn(
    async (_input: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as {
        query: string;
        variables?: Record<string, unknown>;
      };
      requests.push(body);
      if (body.query.includes('DirectorViewer')) {
        if (failViewerOnce) {
          failViewerOnce = false;
          return Response.json(
            { errors: [{ message: 'BFF unavailable' }] },
            { status: 503 },
          );
        }
        return Response.json({
          data: {
            viewer: {
              academicScope: {
                kind: 'career',
                facultyIds: options?.missingContext ? [] : [12],
                careerIds: options?.missingContext ? [] : ['025'],
              },
            },
          },
        });
      }
      if (body.query.includes('DirectorCubes')) {
        return Response.json({
          data: {
            olapCubes: options?.emptyCube
              ? []
              : [{ cubeId, cubeName: 'Rendimiento académico' }],
          },
        });
      }
      if (body.query.includes('DirectorCubeSchema'))
        return Response.json({ data: { olapCubeSchema: schema } });
      if (body.query.includes('DirectorCubeMembers')) {
        return Response.json({
          data: {
            olapCubeMembers: [
              {
                name: '2025',
                caption: '2025',
                uniqueName:
                  '[Periodo].[Gestión y periodo].[Gestión].&[2025]',
              },
              {
                name: '2026',
                caption: '2026',
                uniqueName:
                  '[Periodo].[Gestión y periodo].[Gestión].&[2026]',
              },
            ],
          },
        });
      }
      const input = body.variables?.input as {
        measures?: Array<{ name: string }>;
        rows?: unknown[];
        filters?: Array<{
          dimension: string;
          hierarchy: string;
          level: string;
          members: string[];
        }>;
      };
      if (input.measures?.length === 3) {
        return Response.json({
          data: {
            analyticQuery: {
              data: options?.emptyResults
                ? []
                : [
                    {
                      'Inscripciones en materias': { value: 125 },
                      'Nota promedio': { value: 68.4 },
                      'Inscripciones con resultado': { value: 113 },
                    },
                  ],
            },
          },
        });
      }
      if (input.rows?.length === 2) {
        return Response.json({
          data: {
            analyticQuery: {
              data: options?.emptyResults
                ? []
                : [
                    {
                      'Gestión': '2025',
                      'Periodo': 1,
                      'Inscripciones en materias': { value: 60 },
                      'Nota promedio': { value: 66.2 },
                    },
                    ...(options?.duplicatePeriod
                      ? [
                          {
                            'Gestión': '2025',
                            'Periodo': 1,
                            'Inscripciones en materias': { value: 61 },
                            'Nota promedio': { value: 66.3 },
                          },
                        ]
                      : []),
                    {
                      'Gestión': '2025',
                      'Periodo': 2,
                      'Inscripciones en materias': { value: 65 },
                      'Nota promedio': { value: 70.1 },
                    },
                    {
                      'Gestión': '2026',
                      'Periodo': 1,
                      'Inscripciones en materias': { value: 72 },
                      'Nota promedio': { value: 71.3 },
                    },
                    {
                      'Gestión': '2026',
                      'Periodo': 2,
                      'Inscripciones en materias': { value: 53 },
                      'Nota promedio': { value: 69.8 },
                    },
                  ],
            },
          },
        });
      }
      return Response.json({ data: { analyticQuery: { data: [] } } });
    },
  );
  vi.stubGlobal('fetch', fetchMock);
  return { fetchMock, requests };
}

beforeEach(() => vi.stubEnv('NEXT_PUBLIC_BFF_URL', 'http://localhost:3006'));
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  window.history.replaceState({}, '', '/');
});

describe('DirectorAnalyticsDashboard', () => {
  it('renders periods with repeated labels without duplicate React keys', async () => {
    setupFetch({ duplicatePeriod: true });
    const errors = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    try {
      render(<DirectorAnalyticsDashboard />);
      await screen.findByText('125');
      await waitFor(() =>
        expect(screen.getAllByText('2025 · Periodo 1').length).toBeGreaterThan(
          1,
        ),
      );
      expect(errors.mock.calls.flat().join(' ')).not.toMatch(/same key/i);
    } finally {
      errors.mockRestore();
    }
  });

  it('loads real scoped measures and period charts through the BFF', async () => {
    const { requests } = setupFetch();
    render(<DirectorAnalyticsDashboard />);

    expect(await screen.findByText('125')).toBeTruthy();
    expect(screen.getByText('68,4')).toBeTruthy();
    expect(screen.getByText('113')).toBeTruthy();
    expect(
      screen.getByText(
        'Carrera 025 · Facultad 12. La consulta se restringe en el servidor y estos identificadores no se envían como filtros.',
      ),
    ).toBeTruthy();
    expect(
      screen.getByRole('img', {
        name: /intentos de cursado por periodo académico/i,
      }),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Promedio final' }));
    expect(
      await screen.findByRole('img', {
        name: /nota final promedio por periodo académico en el contexto asignado/i,
      }),
    ).toBeTruthy();

    const analyticRequests = requests.filter((request) =>
      request.query.includes('DirectorAnalyticQuery'),
    );
    expect(analyticRequests).toHaveLength(2);
    expect(
      analyticRequests.every(
        (request) => request.variables?.scope === undefined,
      ),
    ).toBe(true);
    const analyticInputs = analyticRequests.map(
      (request) =>
        request.variables?.input as {
          filters?: Array<{
            dimension: string;
            level: string;
            members: string[];
          }>;
          rows?: unknown[];
        },
    );
    expect(analyticInputs[0].filters).toEqual([]);
    expect(analyticInputs[0].rows).toBeUndefined();
    expect(analyticInputs[1].filters).toBeUndefined();
    expect(analyticInputs[1].rows).toHaveLength(2);
  });

  it('requeries only the selected period while keeping the career restriction server-side', async () => {
    const { requests } = setupFetch();
    render(<DirectorAnalyticsDashboard />);
    await screen.findByText('125');

    fireEvent.change(screen.getByLabelText('Gestión académica'), {
      target: { value: '2026' },
    });
    await waitFor(() =>
      expect(
        requests.filter((request) =>
          request.query.includes('DirectorAnalyticQuery'),
        ),
      ).toHaveLength(4),
    );

    const filtered = requests
      .filter((request) => request.query.includes('DirectorAnalyticQuery'))
      .slice(-2);
    const filteredInputs = filtered.map(
      (request) =>
        request.variables?.input as {
          filters?: Array<{ dimension: string; members: string[] }>;
          rows?: unknown[];
        },
    );
    expect(
      filteredInputs.some((input) =>
        input.filters?.some(
          (filter) =>
            filter.dimension === 'Periodo' &&
            filter.members[0].endsWith('&[2026]'),
        ),
      ),
    ).toBe(true);
    const trendInput = filteredInputs.find((input) => input.rows?.length === 2);
    expect(trendInput?.filters).toBeUndefined();
    expect(
      screen.getByRole('img', {
        name: /intentos de cursado por periodo académico/i,
      }).textContent,
    ).toContain('2026');
    expect(
      screen.getByRole('img', {
        name: /intentos de cursado por periodo académico/i,
      }).textContent,
    ).not.toContain('2025');
    expect(new URL(window.location.href).searchParams.get('gestion')).toBe(
      '2026',
    );
  });

  it('does not query analytics when the server has no director career context', async () => {
    const { requests } = setupFetch({ missingContext: true });
    render(<DirectorAnalyticsDashboard />);

    expect((await screen.findByRole('alert')).textContent).toMatch(
      /no confirmó un contexto de carrera/i,
    );
    expect(
      requests.some((request) =>
        request.query.includes('DirectorAnalyticQuery'),
      ),
    ).toBe(false);
  });

  it('explains when the assigned career has no data for the selected cut', async () => {
    setupFetch({ emptyResults: true });
    render(<DirectorAnalyticsDashboard />);

    expect(
      await screen.findByText(
        /no tiene indicadores para el periodo seleccionado/i,
      ),
    ).toBeTruthy();
  });

  it('shows a published-cube empty state and supports retry after a BFF error', async () => {
    const missingCube = setupFetch({ emptyCube: true });
    render(<DirectorAnalyticsDashboard />);
    expect(
      await screen.findByText(/cubo academic performance no está publicado/i),
    ).toBeTruthy();

    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.stubEnv('NEXT_PUBLIC_BFF_URL', 'http://localhost:3006');
    const retry = setupFetch({ failViewerOnce: true });
    const { unmount } = render(<DirectorAnalyticsDashboard />);
    expect((await screen.findByRole('alert')).textContent).toMatch(
      /bff unavailable/i,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByText('125')).toBeTruthy();
    expect(
      retry.requests.some((request) =>
        request.query.includes('DirectorAnalyticQuery'),
      ),
    ).toBe(true);
    unmount();
    expect(
      missingCube.requests.some((request) =>
        request.query.includes('DirectorAnalyticQuery'),
      ),
    ).toBe(false);
  });
});
