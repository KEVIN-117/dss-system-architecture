import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AcademicReports } from '@dss-monorepo/academic-analytics';

vi.mock('@dss-monorepo/charts', () => ({ AcademicBarChart: () => null, TrendLineChart: () => null }));
const names = ['Enrollment Attempts', 'Graded Attempts', 'Passed Attempts', 'Failed Attempts', 'Repeated Attempts', 'Abandoned Attempts', 'Average Final Grade'];
const schema = { measures: Object.fromEntries(names.map((name) => [name, { name }])), dimensions: {
  period: { name: 'Academic Period', hierarchies: { period: { name: 'Academic Period', levels: { year: { name: 'Academic Year' } } } } },
  program: { name: 'Academic Program', hierarchies: { program: { name: 'Program', levels: { career: { name: 'Career' } } } } },
} };
let requests: Array<{query: string; variables?: Record<string, unknown>}>;
let kind = 'career';
beforeEach(() => {
  requests = []; kind = 'career'; vi.stubEnv('NEXT_PUBLIC_BFF_URL', 'http://localhost:3006');
  vi.stubGlobal('fetch', vi.fn(async (_url: string, init: RequestInit) => {
    const body = JSON.parse(String(init.body)); requests.push(body);
    if (body.query.includes('DirectorAnalyticsViewer')) return Response.json({ data: { viewer: { academicScope: { kind, careerIds: kind === 'career' ? ['AGR'] : [], facultyIds: kind === 'faculty' ? ['FAC-1'] : [] } } } });
    if (body.query.includes('DirectorAnalyticsCubes')) return Response.json({ data: { olapCubes: [{ cubeId: 'dw/catalog/schema/Academic Performance', cubeName: 'Academic Performance' }] } });
    if (body.query.includes('DirectorAnalyticsSchema')) return Response.json({ data: { olapCubeSchema: schema } });
    return Response.json({ data: { analyticQuery: { data: [{ 'Academic Year': '2024', Career: 'Agronomía', 'Enrollment Attempts': 45 }, { 'Academic Year': '2023', Career: 'Medicina', 'Enrollment Attempts': 30 }] } } });
  }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
describe('academic reports', () => {
  it.each([['career'], ['faculty'], ['global']] as const)('loads only the selected cube for %s scope and filters its rows', async (scope) => {
    kind = scope; render(<AcademicReports section="performance" scope={scope} />);
    await screen.findByText('Agronomía');
    expect(screen.getByText('Medicina')).toBeTruthy();
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'Agronomía' } });
    expect(screen.queryByText('Medicina')).toBeNull();
    const calls = requests.filter((r) => r.query.includes('DirectorAnalyticsReport'));
    expect(calls).toHaveLength(1);
    const input = calls[0].variables?.input as { cubeId: string; filters?: unknown };
    expect(input.cubeId).toContain('Academic Performance');
    expect(input.filters).toBeUndefined();
  });
  it('fails closed when the session scope differs', async () => {
    kind = 'global'; render(<AcademicReports section="performance" scope="career" />);
    await screen.findByRole('alert');
    await waitFor(() => expect(requests).toHaveLength(1));
  });
});
