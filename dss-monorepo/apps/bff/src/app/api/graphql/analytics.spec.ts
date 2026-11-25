import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { executeServerOlapQuery, getServerOlapCubeSchema, listServerOlapCubes, searchServerOlapMembers } = vi.hoisted(() => ({
  executeServerOlapQuery: vi.fn(),
  getServerOlapCubeSchema: vi.fn(),
  listServerOlapCubes: vi.fn(),
  searchServerOlapMembers: vi.fn(),
}));

vi.mock('@dss-monorepo/olap-connector/server', () => ({
  executeServerOlapQuery,
  getServerOlapCubeSchema,
  listServerOlapCubes,
  searchServerOlapMembers,
  OlapServerClientError: class OlapServerClientError extends Error {
    constructor(message: string, public status: number, public code: string) { super(message); }
  },
}));

import { OlapServerClientError } from '@dss-monorepo/olap-connector/server';
import { createAnalyticsResolvers } from './analytics';
import { deriveAcademicScope } from '../_lib/academic-scope';

const cube = {
  connectionName: 'academic', catalog: 'UATF', schema: 'UATF', cubeName: 'Students',
};
const cubeId = 'academic/UATF/UATF/Students';
const academicContext = {
  id: 'aaaabbbb-1111-4111-8111-000000000001',
  userId: 'aaaabbbb-1111-4111-8111-000000000002',
  facultyId: 12,
  careerId: '025',
};
const auth = {
  token: 'validated-access-token',
  roles: ['DIRECTOR'] as const,
  permissions: ['analytics:read', 'analytics:career'],
  user: {
    id: academicContext.userId,
    username: 'director', firstName: 'Ana', lastName: 'Pérez',
    academicContexts: [academicContext], roles: ['DIRECTOR'] as const,
  },
};

function resolver() {
  return createAnalyticsResolvers().Query as Record<string, (...args: never[]) => unknown>;
}

function ctx(authentication = auth) {
  return { authentication };
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv('OLAP_SERVICE_URL', 'http://olap-service:8080');
  vi.stubEnv('OLAP_ACADEMIC_SCOPE_FILTERS', JSON.stringify({
    career: {
      dimension: 'Ámbito de carrera', hierarchy: 'Carrera', level: 'Carrera',
      memberTemplate: '[Ámbito de carrera].[Carrera].[Carrera].&[{id}]',
    },
    faculty: {
      dimension: 'Ámbito de facultad', hierarchy: 'Facultad', level: 'Facultad',
      memberTemplate: '[Ámbito de facultad].[Facultad].[Facultad].&[{id}]',
    },
  }));
  listServerOlapCubes.mockResolvedValue([cube]);
  executeServerOlapQuery.mockResolvedValue({ status: 'SUCCESS', data: [{ Enrolled: { value: 20 } }], totalRows: 1 });
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('BFF analytic GraphQL resolvers', () => {
  it('reads prediction publications through the authenticated Prediction Service', async () => {
    vi.stubEnv('PREDICTION_SERVICE_URL', 'http://prediction-service:8000/');
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ publication: { status: 'PUBLISHED', result_count: 4 } }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await resolver().predictionPublication({}, {
      programRef: '025', cutId: '2020-2', limit: 1200, offset: 0,
    }, ctx()) as { publication: { status: string; result_count: number } };

    expect(result).toEqual({ publication: { status: 'PUBLISHED', result_count: 4 } });
    expect(fetchMock).toHaveBeenCalledWith(
      'http://prediction-service:8000/v1/prediction-publications?program_ref=025&cut_id=2020-2&limit=1000&offset=0&event_type=program_dropout',
      expect.objectContaining({ headers: { Authorization: `Bearer ${auth.token}` }, cache: 'no-store' }),
    );
  });

  it('reads the publication of the selected objective (PRED-108)', async () => {
    vi.stubEnv('PREDICTION_SERVICE_URL', 'http://prediction-service:8000');
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ publication: null }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await resolver().predictionPublication({}, { programRef: '025', cutId: '2020-2', eventType: 'student_gpa' }, ctx());

    expect(String(fetchMock.mock.calls[0][0])).toContain('event_type=student_gpa');
  });

  it('rejects an unsupported prediction objective before calling Prediction Service', async () => {
    vi.stubEnv('PREDICTION_SERVICE_URL', 'http://prediction-service:8000');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(resolver().predictionPublication({}, { programRef: '025', cutId: '2020-2', eventType: 'course_failure' }, ctx()))
      .rejects.toMatchObject({ extensions: { code: 'BAD_USER_INPUT' } });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects publication reads for identities without analytics scope before calling Prediction Service', async () => {
    vi.stubEnv('PREDICTION_SERVICE_URL', 'http://prediction-service:8000');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(resolver().predictionPublication({}, { programRef: '025', cutId: '2020-2' }, ctx({
      ...auth, roles: ['SUPERADMIN'] as never, permissions: ['iam:users:read', 'prediction:train'],
    }))).rejects.toMatchObject({ extensions: { code: 'FORBIDDEN' } });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('derives director scope only from Auth Service contexts', () => {
    expect(deriveAcademicScope(auth.permissions, [academicContext])).toEqual({ kind: 'career', contexts: [academicContext] });
    expect(() => deriveAcademicScope(auth.permissions, [])).toThrowError(/career context is required/i);
    expect(() => deriveAcademicScope(['iam:users:read'], [academicContext])).toThrowError(/not permitted/i);
  });

  it('keeps dean and rector scopes at their permission level even when composites include lower ones', () => {
    const deanContext = { ...academicContext, careerId: null };
    expect(deriveAcademicScope(['analytics:read', 'analytics:career', 'analytics:faculty'], [deanContext]))
      .toEqual({ kind: 'faculty', contexts: [deanContext] });
    expect(deriveAcademicScope(['analytics:read', 'analytics:career', 'analytics:faculty', 'analytics:global'], []))
      .toEqual({ kind: 'global', contexts: [] });
  });

  it('returns validated identity and academic scopes without accepting client scope arguments', async () => {
    const viewer = await resolver().viewer({}, {}, ctx()) as Record<string, unknown>;
    expect(viewer).toMatchObject({
      id: auth.user.id, username: 'director', roles: ['DIRECTOR'], permissions: ['analytics:read', 'analytics:career'],
    });
    expect(viewer.academicScope).toEqual({ kind: 'career', facultyIds: [12], careerIds: ['025'] });
  });

  it('lists live OLAP cubes with the validated bearer token on the server', async () => {
    const result = await resolver().olapCubes({}, {}, ctx()) as Array<Record<string, unknown>>;
    expect(result[0]).toMatchObject({ cubeId, cubeName: 'Students' });
    expect(listServerOlapCubes).toHaveBeenCalledWith({ baseUrl: 'http://olap-service:8080', accessToken: auth.token });
  });

  it('lists members only for dimensions and levels published in the visible cube schema', async () => {
    getServerOlapCubeSchema.mockResolvedValueOnce({
      dimensions: {
        'academic period': {
          name: 'Periodo',
          hierarchies: {
            'academic period': {
              name: 'Gestión y periodo',
              levels: { 'academic year': { name: 'Gestión' } },
            },
          },
        },
      },
    });
    searchServerOlapMembers.mockResolvedValueOnce([
      { name: '2026', uniqueName: '[Periodo].[Gestión y periodo].[Gestión].&[2026]', caption: '2026' },
    ]);
    const result = await resolver().olapCubeMembers({}, {
      cubeId, dimension: 'Periodo', hierarchy: 'Gestión y periodo', level: 'Gestión', limit: 50,
    }, ctx());

    expect(result).toEqual([
      { name: '2026', uniqueName: '[Periodo].[Gestión y periodo].[Gestión].&[2026]', caption: '2026' },
    ]);
    expect(searchServerOlapMembers).toHaveBeenCalledWith(
      { baseUrl: 'http://olap-service:8080', accessToken: auth.token },
      { cubeId, dimension: 'Periodo', hierarchy: 'Gestión y periodo', level: 'Gestión', limit: 50 },
    );
  });

  it('rejects member lookup for levels absent from the published schema', async () => {
    getServerOlapCubeSchema.mockResolvedValueOnce({ dimensions: {} });
    await expect(resolver().olapCubeMembers({}, {
      cubeId, dimension: 'Private Dimension', hierarchy: 'Private Hierarchy', level: 'Private Level',
    }, ctx())).rejects.toMatchObject({ extensions: { code: 'BAD_USER_INPUT' } });
    expect(searchServerOlapMembers).not.toHaveBeenCalled();
  });

  it('executes with a server-derived academic filter and never accepts a client context id', async () => {
    const input = {
      cubeId,
      measures: [{ name: 'Enrolled Students' }],
      rows: [{ dimension: 'Academic Term', level: 'Term' }],
      filters: [{ dimension: 'Academic Term', level: 'Term', op: 'IN' as const, members: ['2026-1'] }],
      order: [{ by: 'Enrolled Students', direction: 'DESC' as const }],
    };
    const result = await resolver().analyticQuery({}, { input }, ctx()) as Record<string, unknown>;
    expect(result).toMatchObject({ status: 'SUCCESS', totalRows: 1 });
    expect(executeServerOlapQuery).toHaveBeenCalledWith(
      { baseUrl: 'http://olap-service:8080', accessToken: auth.token },
      expect.objectContaining({
        cube: cubeId,
        measures: [{ name: 'Enrolled Students' }, { name: 'Conteo de privacidad' }],
        filters: expect.arrayContaining([
          expect.objectContaining({ dimension: 'Academic Term', level: 'Term', op: 'in', members: ['2026-1'] }),
          expect.objectContaining({
            dimension: 'Ámbito de carrera', hierarchy: 'Carrera', level: 'Carrera', op: 'in',
            members: ['[Ámbito de carrera].[Carrera].[Carrera].&[025]'],
          }),
        ]),
        order: [{ by: 'Enrolled Students', direction: 'desc' }],
      }),
    );
  });

  it('sends each measure once even when report roles resolve to the same published measure', async () => {
    await resolver().analyticQuery({}, {
      input: { cubeId, measures: [{ name: 'Postulaciones' }, { name: 'Admitidos' }, { name: 'admitidos ' }, { name: 'Postulaciones' }] },
    }, ctx());

    expect(executeServerOlapQuery).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({
        measures: [{ name: 'Postulaciones' }, { name: 'Admitidos' }, { name: 'Conteo de privacidad' }],
      }),
    );
  });

  it('uses the private count measure for k-anonymity but removes it from the GraphQL result', async () => {
    executeServerOlapQuery.mockResolvedValueOnce({
      status: 'SUCCESS',
      data: [{ Career: '025', Enrolled: { value: 20 }, 'Conteo de privacidad': { value: 3 } }],
      totalRows: 1,
    });
    const result = await resolver().analyticQuery({}, {
      input: { cubeId, measures: [{ name: 'Enrolled Students' }] },
    }, ctx()) as { data: Array<Record<string, unknown>> };

    expect(executeServerOlapQuery).toHaveBeenCalledWith(
      expect.anything(), expect.objectContaining({ measures: [{ name: 'Enrolled Students' }, { name: 'Conteo de privacidad' }] }),
    );
    expect(result.data).toEqual([{ Career: '025', Enrolled: { value: 20 } }]);
  });

  it('rejects attempts to override the server-owned scope hierarchy', async () => {
    const input = {
      cubeId,
      measures: [{ name: 'Enrolled Students' }],
      filters: [{ dimension: 'Ámbito de carrera', hierarchy: 'Carrera', level: 'Carrera', op: 'not_in', members: ['[Ámbito de carrera].[Carrera].[Carrera].&[025]'] }],
    };
    await expect(resolver().analyticQuery({}, { input }, ctx())).rejects.toMatchObject({
      extensions: { code: 'SCOPE_FILTER_IMMUTABLE' },
    });
    expect(executeServerOlapQuery).not.toHaveBeenCalled();
  });

  it('rejects malformed authoritative career IDs before interpolating OLAP members', async () => {
    const maliciousContext = { ...academicContext, careerId: ']&]' };
    const input = { cubeId, measures: [{ name: 'Inscripciones en materias' }] };
    await expect(resolver().analyticQuery({}, { input }, ctx({
      ...auth,
      user: { ...auth.user, academicContexts: [maliciousContext] },
    }))).rejects.toMatchObject({
      extensions: { code: 'ACADEMIC_CONTEXT_INVALID' },
    });
    expect(executeServerOlapQuery).not.toHaveBeenCalled();
  });

  it('rejects malformed arguments and cubes not visible to the user', async () => {
    await expect(resolver().analyticQuery({}, { input: { cubeId, measures: [], limit: 1000 } }, ctx())).rejects.toMatchObject({
      extensions: { code: 'INVALID_ARGUMENT' },
    });
    await expect(resolver().analyticQuery({}, { input: { cubeId: 'secret/C/C/C', measures: [{ name: 'Enrolled Students' }] } }, ctx())).rejects.toMatchObject({
      extensions: { code: 'CUBE_FORBIDDEN' },
    });
    expect(executeServerOlapQuery).not.toHaveBeenCalled();
  });

  it('normalizes upstream OLAP failures and timeouts without leaking upstream bodies', async () => {
    executeServerOlapQuery.mockRejectedValueOnce(new OlapServerClientError('OLAP request timed out', 504, 'OLAP_TIMEOUT'));
    const input = { cubeId, measures: [{ name: 'Enrolled Students' }] };
    await expect(resolver().analyticQuery({}, { input }, ctx())).rejects.toMatchObject({
      message: 'OLAP request timed out', extensions: { code: 'OLAP_TIMEOUT', http: { status: 504 } },
    });

    executeServerOlapQuery.mockRejectedValueOnce(new OlapServerClientError('OLAP request failed', 502, 'OLAP_UNAVAILABLE'));
    await expect(resolver().analyticQuery({}, { input }, ctx())).rejects.toMatchObject({
      message: 'OLAP request failed', extensions: { code: 'OLAP_UNAVAILABLE', http: { status: 502 } },
    });
  });

  it('normalizes OLAP query statuses returned in a successful HTTP response', async () => {
    const input = { cubeId, measures: [{ name: 'Inscripciones en materias' }] };
    executeServerOlapQuery.mockResolvedValueOnce({
      status: 'VALIDATION_ERROR', error: 'SQL or internal details', field: 'measures[0].name', available: ['Inscripciones en materias'],
    });
    await expect(resolver().analyticQuery({}, { input }, ctx())).rejects.toMatchObject({
      message: 'OLAP rejected the query definition',
      extensions: {
        code: 'OLAP_INVALID_QUERY',
        http: { status: 400 },
        field: 'measures[0].name',
        available: ['Inscripciones en materias'],
      },
    });

    executeServerOlapQuery.mockResolvedValueOnce({ status: 'TIMEOUT', error: 'warehouse internals' });
    await expect(resolver().analyticQuery({}, { input }, ctx())).rejects.toMatchObject({
      message: 'OLAP query timed out', extensions: { code: 'OLAP_TIMEOUT', http: { status: 504 } },
    });
  });

  it('requires configured context-to-cube filter bindings before scoped queries can run', async () => {
    vi.stubEnv('OLAP_ACADEMIC_SCOPE_FILTERS', '{}');
    const input = { cubeId, measures: [{ name: 'Enrolled Students' }] };
    await expect(resolver().analyticQuery({}, { input }, ctx())).rejects.toMatchObject({
      extensions: { code: 'SCOPE_CONFIGURATION_ERROR' },
    });
    expect(executeServerOlapQuery).not.toHaveBeenCalled();
  });
});

describe('Program forecast resolvers (PRED-106)', () => {
  const reader = { ...auth, permissions: [...auth.permissions, 'prediction:forecast:read'] };

  it('reads the latest program forecast through Prediction Service', async () => {
    vi.stubEnv('PREDICTION_SERVICE_URL', 'http://prediction-service:8000/');
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ series_code: 'ADMITTED_BY_PROGRAM', points: [] }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await resolver().admissionForecast({}, { programRef: '025', cadence: 'SEMESTRAL', admitted: true }, ctx(reader));

    expect(result).toEqual({ forecast: { series_code: 'ADMITTED_BY_PROGRAM', points: [] } });
    expect(fetchMock).toHaveBeenCalledWith(
      'http://prediction-service:8000/v1/forecasts?series=ADMITTED_BY_PROGRAM&program_ref=025&cadence=SEMESTRAL',
      expect.objectContaining({ headers: { Authorization: `Bearer ${auth.token}` }, cache: 'no-store' }),
    );
  });

  it('returns null when no forecast exists yet', async () => {
    vi.stubEnv('PREDICTION_SERVICE_URL', 'http://prediction-service:8000');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 404 })));
    await expect(resolver().enrollmentForecast({}, { programRef: '025' }, ctx(reader))).resolves.toEqual({ forecast: null });
  });

  it('requires prediction:forecast:read and the director career scope before calling Prediction Service', async () => {
    vi.stubEnv('PREDICTION_SERVICE_URL', 'http://prediction-service:8000');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(resolver().enrollmentForecast({}, { programRef: '025' }, ctx()))
      .rejects.toMatchObject({ extensions: { code: 'FORBIDDEN' } });
    await expect(resolver().enrollmentForecast({}, { programRef: '999' }, ctx(reader)))
      .rejects.toMatchObject({ extensions: { code: 'FORBIDDEN' } });
    await expect(resolver().admissionForecast({}, { programRef: '../x' }, ctx(reader)))
      .rejects.toMatchObject({ extensions: { code: 'BAD_USER_INPUT' } });
    await expect(resolver().admissionForecast({}, { programRef: '025', cadence: 'TRIMESTRAL' }, ctx(reader)))
      .rejects.toMatchObject({ extensions: { code: 'BAD_USER_INPUT' } });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
