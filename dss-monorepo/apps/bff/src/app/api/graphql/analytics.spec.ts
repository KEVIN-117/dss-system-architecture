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
import { createAnalyticsResolvers, deriveAcademicScope } from './analytics';

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
      dimension: 'Academic Career Scope', hierarchy: 'Career Scope', level: 'Career',
      memberTemplate: '[Academic Career Scope].[Career Scope].[Career].&[{id}]',
    },
    faculty: {
      dimension: 'Academic Faculty Scope', hierarchy: 'Faculty Scope', level: 'Faculty',
      memberTemplate: '[Academic Faculty Scope].[Faculty Scope].[Faculty].&[{id}]',
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
      'http://prediction-service:8000/v1/prediction-publications?program_ref=025&cut_id=2020-2&limit=1000&offset=0',
      expect.objectContaining({ headers: { Authorization: `Bearer ${auth.token}` }, cache: 'no-store' }),
    );
  });

  it('rejects publication reads for identities without analytics scope before calling Prediction Service', async () => {
    vi.stubEnv('PREDICTION_SERVICE_URL', 'http://prediction-service:8000');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(resolver().predictionPublication({}, { programRef: '025', cutId: '2020-2' }, ctx({
      ...auth, roles: ['SUPERADMIN'] as never,
    }))).rejects.toMatchObject({ extensions: { code: 'FORBIDDEN' } });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('derives director scope only from Auth Service contexts', () => {
    expect(deriveAcademicScope(['DIRECTOR'], [academicContext])).toEqual({ kind: 'career', contexts: [academicContext] });
    expect(() => deriveAcademicScope(['DIRECTOR'], [])).toThrowError(/career context is required/i);
    expect(() => deriveAcademicScope(['SUPERADMIN'], [academicContext])).toThrowError(/not permitted/i);
  });

  it('keeps dean and rector scopes at their role level even when realm composites include lower roles', () => {
    const deanContext = { ...academicContext, careerId: null };
    expect(deriveAcademicScope(['DECANO', 'DIRECTOR'], [deanContext])).toEqual({ kind: 'faculty', contexts: [deanContext] });
    expect(deriveAcademicScope(['RECTOR', 'DECANO', 'DIRECTOR'], [])).toEqual({ kind: 'global', contexts: [] });
  });

  it('returns validated identity and academic scopes without accepting client scope arguments', async () => {
    const viewer = await resolver().viewer({}, {}, ctx()) as Record<string, unknown>;
    expect(viewer).toMatchObject({ id: auth.user.id, username: 'director', roles: ['DIRECTOR'] });
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
          name: 'Academic Period',
          hierarchies: {
            'academic period': {
              name: 'Academic Period',
              levels: { 'academic year': { name: 'Academic Year' } },
            },
          },
        },
      },
    });
    searchServerOlapMembers.mockResolvedValueOnce([
      { name: '2026', uniqueName: '[Academic Period].[Academic Period].[Academic Year].&[2026]', caption: '2026' },
    ]);
    const result = await resolver().olapCubeMembers({}, {
      cubeId, dimension: 'Academic Period', hierarchy: 'Academic Period', level: 'Academic Year', limit: 50,
    }, ctx());

    expect(result).toEqual([
      { name: '2026', uniqueName: '[Academic Period].[Academic Period].[Academic Year].&[2026]', caption: '2026' },
    ]);
    expect(searchServerOlapMembers).toHaveBeenCalledWith(
      { baseUrl: 'http://olap-service:8080', accessToken: auth.token },
      { cubeId, dimension: 'Academic Period', hierarchy: 'Academic Period', level: 'Academic Year', limit: 50 },
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
        measures: [{ name: 'Enrolled Students' }, { name: 'Attempt Count' }],
        filters: expect.arrayContaining([
          expect.objectContaining({ dimension: 'Academic Term', level: 'Term', op: 'in', members: ['2026-1'] }),
          expect.objectContaining({
            dimension: 'Academic Career Scope', hierarchy: 'Career Scope', level: 'Career', op: 'in',
            members: ['[Academic Career Scope].[Career Scope].[Career].&[025]'],
          }),
        ]),
        order: [{ by: 'Enrolled Students', direction: 'desc' }],
      }),
    );
  });

  it('uses the private count measure for k-anonymity but removes it from the GraphQL result', async () => {
    executeServerOlapQuery.mockResolvedValueOnce({
      status: 'SUCCESS',
      data: [{ Career: '025', Enrolled: { value: 20 }, 'Attempt Count': { value: 3 } }],
      totalRows: 1,
    });
    const result = await resolver().analyticQuery({}, {
      input: { cubeId, measures: [{ name: 'Enrolled Students' }] },
    }, ctx()) as { data: Array<Record<string, unknown>> };

    expect(executeServerOlapQuery).toHaveBeenCalledWith(
      expect.anything(), expect.objectContaining({ measures: [{ name: 'Enrolled Students' }, { name: 'Attempt Count' }] }),
    );
    expect(result.data).toEqual([{ Career: '025', Enrolled: { value: 20 } }]);
  });

  it('rejects attempts to override the server-owned scope hierarchy', async () => {
    const input = {
      cubeId,
      measures: [{ name: 'Enrolled Students' }],
      filters: [{ dimension: 'Academic Career Scope', hierarchy: 'Career Scope', level: 'Career', op: 'not_in', members: ['[Academic Career Scope].[Career Scope].[Career].&[025]'] }],
    };
    await expect(resolver().analyticQuery({}, { input }, ctx())).rejects.toMatchObject({
      extensions: { code: 'SCOPE_FILTER_IMMUTABLE' },
    });
    expect(executeServerOlapQuery).not.toHaveBeenCalled();
  });

  it('rejects malformed authoritative career IDs before interpolating OLAP members', async () => {
    const maliciousContext = { ...academicContext, careerId: ']&]' };
    const input = { cubeId, measures: [{ name: 'Enrollment Attempts' }] };
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
    const input = { cubeId, measures: [{ name: 'Enrollment Attempts' }] };
    executeServerOlapQuery.mockResolvedValueOnce({
      status: 'VALIDATION_ERROR', error: 'SQL or internal details', field: 'measures[0].name', available: ['Enrollment Attempts'],
    });
    await expect(resolver().analyticQuery({}, { input }, ctx())).rejects.toMatchObject({
      message: 'OLAP rejected the query definition',
      extensions: {
        code: 'OLAP_INVALID_QUERY',
        http: { status: 400 },
        field: 'measures[0].name',
        available: ['Enrollment Attempts'],
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
