import { beforeEach, describe, expect, it, vi } from 'vitest';

const { authenticateRequest } = vi.hoisted(() => ({
  authenticateRequest: vi.fn(),
}));

vi.mock('../../../_lib/auth-guard', () => ({ authenticateRequest }));

import { GET } from './route';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/admin/dw/capabilities', () => {
  it('returns only boolean DW capabilities for the authenticated user', async () => {
    authenticateRequest.mockResolvedValue({
      authenticated: true,
      value: {
        permissions: ['dw:closure:read', 'dw:etl-monitor:read', 'analytics:read'],
      },
    });

    const response = await GET(
      new Request('http://bff/api/admin/dw/capabilities'),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      canReadClosures: true,
      canManageClosures: false,
      canReadEtlExecutions: true,
    });
    expect(response.headers.get('cache-control')).toBe('no-store');
  });

  it('ignores the retired DW_* client roles (IAM-019)', async () => {
    authenticateRequest.mockResolvedValue({
      authenticated: true,
      value: {
        permissions: ['DW_CLOSURE_READ', 'DW_CLOSURE_MANAGE'],
        clientRoles: { 'dw-control-service': ['DW_CLOSURE_READ', 'DW_CLOSURE_MANAGE'] },
      },
    });

    const response = await GET(
      new Request('http://bff/api/admin/dw/capabilities'),
    );

    expect(await response.json()).toEqual({
      canReadClosures: false,
      canManageClosures: false,
      canReadEtlExecutions: false,
    });
  });

  it('preserves the authentication error response', async () => {
    authenticateRequest.mockResolvedValue({
      authenticated: false,
      response: Response.json(
        { error: 'Authentication required' },
        { status: 401 },
      ),
    });

    const response = await GET(
      new Request('http://bff/api/admin/dw/capabilities'),
    );

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: 'Authentication required' });
  });
});
