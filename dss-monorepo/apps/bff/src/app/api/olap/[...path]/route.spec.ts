import { NextResponse } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

const { authenticateRequest, requireRoles } = vi.hoisted(() => ({
  authenticateRequest: vi.fn(),
  requireRoles: vi.fn(),
}));
vi.mock('../../_lib/auth-guard', () => ({
  authenticateRequest,
  requireRoles,
}));

import { GET, POST } from './route';

const authentication = {
  authenticated: true as const,
  value: {
    token: 'verified-access-token',
    user: {
      id: 'user-1',
      username: 'director',
      academicContexts: [
        {
          id: 'aaaabbbb-1111-4111-8111-000000000001',
          userId: 'user-1',
          facultyId: 12,
          careerId: '025',
        },
      ],
      roles: ['DIRECTOR'],
    },
    roles: ['DIRECTOR'],
  },
};

const adminAuthentication = {
  authenticated: true as const,
  value: {
    token: 'verified-admin-token',
    user: { id: 'admin-1', roles: ['SUPERADMIN'] },
    roles: ['SUPERADMIN'],
    clientRoles: { 'dss-permissions': ['olap:admin'] },
  },
};

/** A platform administrator without the OLAP admin permission (D4). */
const superadminWithoutOlapAdmin = {
  authenticated: true as const,
  value: {
    token: 'verified-superadmin-token',
    user: { id: 'admin-2', roles: ['SUPERADMIN'] },
    roles: ['SUPERADMIN'],
    clientRoles: { 'dss-permissions': ['iam:users:write'] },
  },
};

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe('OLAP BFF proxy route', () => {
  it('requires an authenticated session and rejects paths outside Saiku', async () => {
    authenticateRequest.mockResolvedValue({
      authenticated: false,
      response: NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 },
      ),
    });
    const unauthorized = await POST(
      new Request('http://bff/api/olap/rest/saiku/api/graphql', {
        method: 'POST',
      }),
      {
        params: Promise.resolve({ path: ['rest', 'saiku', 'api', 'graphql'] }),
      },
    );
    expect(unauthorized.status).toBe(401);

    authenticateRequest.mockResolvedValue(authentication);
    const invalidPath = await POST(
      new Request('http://bff/api/olap/admin/secrets', { method: 'POST' }),
      { params: Promise.resolve({ path: ['admin', 'secrets'] }) },
    );
    expect(invalidPath.status).toBe(400);

    const traversalPath = await POST(
      new Request('http://bff/api/olap/rest/saiku/../admin/schema', {
        method: 'POST',
      }),
      {
        params: Promise.resolve({
          path: ['rest', 'saiku', '..', 'admin', 'schema'],
        }),
      },
    );
    expect(traversalPath.status).toBe(400);
  });

  it('forwards the verified bearer token to the configured OLAP service', async () => {
    authenticateRequest.mockResolvedValue(adminAuthentication);
    vi.stubEnv('OLAP_SERVICE_URL', 'http://olap-service:8080/');
    const upstream = Response.json({ data: { ping: 'pong' } });
    const fetchMock = vi.fn().mockResolvedValue(upstream);
    vi.stubGlobal('fetch', fetchMock);

    const response = await POST(
      new Request('http://bff/api/olap/rest/saiku/api/graphql?x=1', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ query: '{ ping }' }),
      }),
      {
        params: Promise.resolve({ path: ['rest', 'saiku', 'api', 'graphql'] }),
      },
    );

    expect(response.status).toBe(200);
    expect(String(fetchMock.mock.calls[0][0])).toBe(
      'http://olap-service:8080/rest/saiku/api/graphql?x=1',
    );
    const upstreamOptions = fetchMock.mock.calls[0][1] as RequestInit;
    expect(upstreamOptions.method).toBe('POST');
    expect(new Headers(upstreamOptions.headers).get('authorization')).toBe(
      'Bearer verified-admin-token',
    );
    expect(upstreamOptions.signal).toBeInstanceOf(AbortSignal);
    expect(upstreamOptions.redirect).toBe('manual');
  });

  it('preserves a trailing slash on Saiku endpoint paths', async () => {
    authenticateRequest.mockResolvedValue(authentication);
    vi.stubEnv('OLAP_SERVICE_URL', 'http://olap-service:8080');
    const fetchMock = vi.fn().mockResolvedValue(Response.json([]));
    vi.stubGlobal('fetch', fetchMock);

    const path = [
      'rest',
      'saiku',
      'director',
      'discover',
      'uatf-dw',
      'UATF_DW',
      'UATF_DW',
      'Admisión',
      'metadata',
    ];
    await GET(
      new Request(
        'http://bff/api/olap/rest/saiku/director/discover/uatf-dw/UATF_DW/UATF_DW/Admisi%C3%B3n/metadata/',
      ),
      { params: Promise.resolve({ path }) },
    );

    expect(String(fetchMock.mock.calls[0][0])).toBe(
      'http://olap-service:8080/rest/saiku/director/discover/uatf-dw/UATF_DW/UATF_DW/Admisi%C3%B3n/metadata/',
    );
  });

  it('returns 504 when the OLAP upstream exceeds the proxy timeout', async () => {
    vi.useFakeTimers();
    authenticateRequest.mockResolvedValue(adminAuthentication);
    vi.stubEnv('OLAP_SERVICE_URL', 'http://olap-service:8080');
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (_input: string | URL | Request, init?: RequestInit) =>
          new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener('abort', () =>
              reject(new DOMException('Aborted', 'AbortError')),
            );
          }),
      ),
    );

    const pending = POST(
      new Request('http://bff/api/olap/rest/saiku/api/graphql', {
        method: 'POST',
        body: JSON.stringify({ query: '{ ping }' }),
      }),
      {
        params: Promise.resolve({ path: ['rest', 'saiku', 'api', 'graphql'] }),
      },
    );
    const assertion = expect(pending).resolves.toMatchObject({ status: 504 });
    await vi.advanceTimersByTimeAsync(30_000);
    await assertion;
  });

  it('rejects users without olap:admin from OLAP admin paths before proxying', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    for (const caller of [authentication, superadminWithoutOlapAdmin]) {
      authenticateRequest.mockResolvedValue(caller);
      const response = await GET(
        new Request('http://bff/api/olap/rest/saiku/admin/schema'),
        {
          params: Promise.resolve({ path: ['rest', 'saiku', 'admin', 'schema'] }),
        },
      );

      expect(response.status).toBe(403);
      await expect(response.json()).resolves.toMatchObject({
        requiredPermissions: ['olap:admin'],
      });
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('accepts the legacy OLAP_ADMIN role only while the coexistence is on', async () => {
    const legacyAdmin = {
      authenticated: true as const,
      value: {
        token: 'verified-legacy-token',
        user: { id: 'admin-3', roles: [] },
        roles: [],
        clientRoles: { 'olap-service': ['OLAP_ADMIN'] },
      },
    };
    authenticateRequest.mockResolvedValue(legacyAdmin);
    vi.stubEnv('OLAP_SERVICE_URL', 'http://olap-service:8080');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('[]', { status: 200 })));
    const request = () =>
      GET(new Request('http://bff/api/olap/rest/saiku/admin/schema'), {
        params: Promise.resolve({ path: ['rest', 'saiku', 'admin', 'schema'] }),
      });

    expect((await request()).status).toBe(200);
    vi.stubEnv('OLAP_LEGACY_ROLES_ENABLED', 'false');
    expect((await request()).status).toBe(403);
  });

  it('forwards OLAP admin operations with olap:admin, without academic-scope checks', async () => {
    const olapAdminOnly = {
      authenticated: true as const,
      value: {
        token: 'verified-admin-token',
        user: { id: 'admin-4', roles: [] },
        roles: [],
        clientRoles: { 'dss-permissions': ['olap:admin'] },
      },
    };
    authenticateRequest.mockResolvedValue(olapAdminOnly);
    vi.stubEnv('OLAP_SERVICE_URL', 'http://olap-service:8080');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('[]', { status: 200 })));

    const response = await GET(
      new Request('http://bff/api/olap/rest/saiku/admin/datasources'),
      {
        params: Promise.resolve({ path: ['rest', 'saiku', 'admin', 'datasources'] }),
      },
    );

    expect(response.status).toBe(200);
    expect(requireRoles).not.toHaveBeenCalled();
  });

  it('forwards OLAP admin operations only after the olap:admin guard passes', async () => {
    authenticateRequest.mockResolvedValue(adminAuthentication);
    vi.stubEnv('OLAP_SERVICE_URL', 'http://olap-service:8080');
    const fetchMock = vi.fn().mockResolvedValue(
      new Response('[{"name":"academic.xml"}]', {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const response = await GET(
      new Request('http://bff/api/olap/rest/saiku/admin/schema'),
      {
        params: Promise.resolve({ path: ['rest', 'saiku', 'admin', 'schema'] }),
      },
    );

    expect(response.status).toBe(200);
    const upstreamOptions = fetchMock.mock.calls[0][1] as RequestInit;
    expect(String(fetchMock.mock.calls[0][0])).toBe(
      'http://olap-service:8080/rest/saiku/admin/schema',
    );
    expect(new Headers(upstreamOptions.headers).get('authorization')).toBe(
      'Bearer verified-admin-token',
    );
    expect(response.headers.get('cache-control')).toBe('no-store');
  });

  it('keeps ordinary OLAP paths available to authenticated non-admin roles', async () => {
    authenticateRequest.mockResolvedValue(authentication);
    vi.stubEnv('OLAP_ACADEMIC_SCOPE_FILTERS', JSON.stringify({
      career: {
        dimension: 'Ámbito de carrera',
        hierarchy: 'Carrera',
        level: 'Carrera',
        memberTemplate: '[Ámbito de carrera].[Carrera].[Carrera].&[{id}]',
      },
    }));
    vi.stubEnv('OLAP_SERVICE_URL', 'http://olap-service:8080');
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ ok: true }));
    vi.stubGlobal('fetch', fetchMock);
    const query = {
      type: 'QUERYMODEL',
      queryModel: {
        axes: {
          FILTER: { hierarchies: [] },
          COLUMNS: { hierarchies: [] },
          ROWS: { hierarchies: [] },
          PAGES: { hierarchies: [] },
        },
        details: { measures: [] },
      },
    };

    const response = await POST(
      new Request('http://bff/api/olap/rest/saiku/api/query/execute', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(query),
      }),
      {
        params: Promise.resolve({
          path: ['rest', 'saiku', 'api', 'query', 'execute'],
        }),
      },
    );

    expect(response.status).toBe(200);
    expect(requireRoles).toHaveBeenCalledWith(authentication.value, [
      'RECTOR',
      'DECANO',
      'DIRECTOR',
    ]);
    const upstreamOptions = fetchMock.mock.calls[0][1] as RequestInit;
    expect(JSON.parse(String(upstreamOptions.body))).toMatchObject({
      queryModel: {
        axes: {
          FILTER: {
            hierarchies: [
              {
                name: '[Ámbito de carrera].[Carrera]',
                dimension: 'Ámbito de carrera',
              },
            ],
          },
        },
      },
    });
  });
});
