import { NextResponse } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

const { authenticateRequest, requirePermissions, listAdminUsers } = vi.hoisted(() => ({
  authenticateRequest: vi.fn(),
  requirePermissions: vi.fn(),
  listAdminUsers: vi.fn(),
}));

vi.mock('../../_lib/auth-guard', () => ({ authenticateRequest, requirePermissions }));
vi.mock('@dss-monorepo/auth-connector', () => ({
  AuthServiceClientError: class AuthServiceClientError extends Error {
    constructor(public readonly status: number) { super('auth-service client error'); }
  },
  listAdminUsers,
}));

import { GET } from './route';

const superadmin = {
  authenticated: true as const,
  value: { token: 'verified-token', user: { id: 'admin-id' }, roles: ['SUPERADMIN'] },
};

function configureBff() {
  vi.stubEnv('AUTH_SERVICE_URL', 'http://auth-service:8000');
  vi.stubEnv('KEYCLOAK_URL', 'http://keycloak:8080');
  vi.stubEnv('KEYCLOAK_REALM', 'uatf-dss-realm');
  vi.stubEnv('KEYCLOAK_AUDIENCE', 'uatf-auth-service');
  vi.stubEnv('KEYCLOAK_BFF_CLIENT_ID', 'dss-bff');
  vi.stubEnv('KEYCLOAK_BFF_CLIENT_SECRET', 'test-secret');
  vi.stubEnv('KEYCLOAK_BFF_REDIRECT_URI', 'http://bff/api/auth/callback');
  vi.stubEnv('KEYCLOAK_BFF_POST_LOGOUT_REDIRECT_URI', 'http://portal/login');
  vi.stubEnv('BFF_DEFAULT_POST_LOGIN_REDIRECT_URI', 'http://portal/');
  vi.stubEnv('BFF_ALLOWED_ORIGINS', 'http://portal');
  vi.stubEnv('BFF_SESSION_SECRET', 'test-session-secret-with-enough-entropy');
}

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});

describe('admin user directory BFF route', () => {
  it('requires iam:users:read before querying auth-service', async () => {
    authenticateRequest.mockResolvedValue(superadmin);
    requirePermissions.mockReturnValue(NextResponse.json({ error: 'Forbidden' }, { status: 403 }));

    const response = await GET(new Request('http://bff/api/admin/users'));

    expect(response.status).toBe(403);
    expect(requirePermissions).toHaveBeenCalledWith(superadmin.value, ['iam:users:read']);
    expect(listAdminUsers).not.toHaveBeenCalled();
  });

  it('forwards validated pagination and filters with the verified token', async () => {
    configureBff();
    authenticateRequest.mockResolvedValue(superadmin);
    requirePermissions.mockReturnValue(null);
    const page = { content: [], page: 1, size: 10, totalElements: 12, totalPages: 2 };
    listAdminUsers.mockResolvedValue(page);

    const response = await GET(new Request('http://bff/api/admin/users?q=ana&active=true&role=DECANO&facultyId=4&careerId=INF&page=1&size=10'));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(page);
    expect(listAdminUsers).toHaveBeenCalledWith(
      'http://auth-service:8000',
      'verified-token',
      { q: 'ana', active: true, role: 'DECANO', facultyId: 4, careerId: 'INF', page: 1, size: 10 },
      expect.any(AbortSignal),
    );
    expect(response.headers.get('cache-control')).toBe('no-store');
  });

  it('rejects invalid query parameters before calling auth-service', async () => {
    authenticateRequest.mockResolvedValue(superadmin);
    requirePermissions.mockReturnValue(null);

    const response = await GET(new Request('http://bff/api/admin/users?page=-2&size=200'));

    expect(response.status).toBe(400);
    expect(listAdminUsers).not.toHaveBeenCalled();
  });
});
