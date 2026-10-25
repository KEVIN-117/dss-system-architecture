import { afterEach, describe, expect, it, vi } from 'vitest';

const { authenticateRequest, requireClientRoles } = vi.hoisted(() => ({
  authenticateRequest: vi.fn(),
  requireClientRoles: vi.fn(),
}));

vi.mock('../../../../_lib/auth-guard', () => ({
  authenticateRequest,
  requireClientRoles,
}));

import { GET } from './route';

const authenticatedRequest = {
  authenticated: true as const,
  value: {
    token: 'verified-jwt',
    user: { sub: 'authorized-subject' },
    roles: [],
    clientRoles: { 'dw-control-service': ['DW_ETL_MONITOR_READ'] },
  },
};

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('GET /api/admin/dw/etl/executions BFF-service contract', () => {
  it('forwards validated filters and the verified JWT, then returns the normalized page', async () => {
    vi.stubEnv('DW_CONTROL_SERVICE_URL', 'http://dw-control-service:8090');
    authenticateRequest.mockResolvedValue(authenticatedRequest);
    requireClientRoles.mockReturnValue(null);
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        Response.json({
          items: [],
          page: 0,
          size: 20,
          totalElements: 0,
          totalPages: 0,
        }),
      );
    vi.stubGlobal('fetch', fetchMock);

    const response = await GET(
      new Request(
        'http://bff/api/admin/dw/etl/executions?status=FALLIDA&gestion=2026&page=0&size=20',
      ),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      items: [],
      page: 0,
      size: 20,
      totalElements: 0,
      totalPages: 0,
    });
    expect(requireClientRoles).toHaveBeenCalledWith(
      authenticatedRequest.value,
      'dw-control-service',
      ['DW_ETL_MONITOR_READ'],
    );
    const [url, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(url.toString()).toBe(
      'http://dw-control-service:8090/api/v1/etl/executions?status=FALLIDA&gestion=2026&page=0&size=20',
    );
    expect(new Headers(init.headers).get('authorization')).toBe(
      'Bearer verified-jwt',
    );
    expect(response.headers.get('cache-control')).toBe('no-store');
  });

  it('rejects unsupported filters before contacting dw-control-service', async () => {
    authenticateRequest.mockResolvedValue(authenticatedRequest);
    requireClientRoles.mockReturnValue(null);
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const response = await GET(
      new Request(
        'http://bff/api/admin/dw/etl/executions?databasePassword=secret',
      ),
    );

    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('checks authorization before making service requests', async () => {
    authenticateRequest.mockResolvedValue(authenticatedRequest);
    requireClientRoles.mockReturnValue(
      Response.json({ error: 'Insufficient permissions' }, { status: 403 }),
    );
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const response = await GET(
      new Request('http://bff/api/admin/dw/etl/executions'),
    );

    expect(response.status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
