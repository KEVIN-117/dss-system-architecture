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
    user: { id: 'user-1', roles: ['DIRECTOR'] },
    roles: ['DIRECTOR'],
  },
};

const adminAuthentication = {
  authenticated: true as const,
  value: {
    token: 'verified-admin-token',
    user: { id: 'admin-1', roles: ['SUPERADMIN'] },
    roles: ['SUPERADMIN'],
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
  });

  it('forwards the verified bearer token to the configured OLAP service', async () => {
    authenticateRequest.mockResolvedValue(authentication);
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
      'Bearer verified-access-token',
    );
    expect(upstreamOptions.signal).toBeInstanceOf(AbortSignal);
    expect(upstreamOptions.redirect).toBe('manual');
  });

  it('returns 504 when the OLAP upstream exceeds the proxy timeout', async () => {
    vi.useFakeTimers();
    authenticateRequest.mockResolvedValue(authentication);
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

  it('rejects non-SUPERADMIN users from OLAP admin paths before proxying', async () => {
    authenticateRequest.mockResolvedValue(authentication);
    requireRoles.mockReturnValue(
      NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 }),
    );
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const response = await GET(
      new Request('http://bff/api/olap/rest/saiku/admin/schema'),
      {
        params: Promise.resolve({ path: ['rest', 'saiku', 'admin', 'schema'] }),
      },
    );

    expect(response.status).toBe(403);
    expect(requireRoles).toHaveBeenCalledWith(authentication.value, [
      'SUPERADMIN',
    ]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('forwards OLAP admin operations only after the SUPERADMIN guard passes', async () => {
    authenticateRequest.mockResolvedValue(adminAuthentication);
    requireRoles.mockReturnValue(null);
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
    expect(requireRoles).toHaveBeenCalledWith(adminAuthentication.value, [
      'SUPERADMIN',
    ]);
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
    vi.stubEnv('OLAP_SERVICE_URL', 'http://olap-service:8080');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(Response.json({ ok: true })),
    );

    const response = await GET(
      new Request('http://bff/api/olap/rest/saiku/query/execute'),
      {
        params: Promise.resolve({
          path: ['rest', 'saiku', 'query', 'execute'],
        }),
      },
    );

    expect(response.status).toBe(200);
    expect(requireRoles).not.toHaveBeenCalled();
  });
});
