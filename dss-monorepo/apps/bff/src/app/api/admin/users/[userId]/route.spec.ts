import { NextResponse } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

const { authenticateRequest, requireRoles, getAdminUser } = vi.hoisted(() => ({
  authenticateRequest: vi.fn(),
  requireRoles: vi.fn(),
  getAdminUser: vi.fn(),
}));

vi.mock('../../../_lib/auth-guard', () => ({ authenticateRequest, requireRoles }));
vi.mock('@dss-monorepo/auth-connector', () => ({
  AuthServiceClientError: class AuthServiceClientError extends Error {
    constructor(public readonly status: number) { super('auth-service client error'); }
  },
  getAdminUser,
}));

import { GET } from './route';

const superadmin = {
  authenticated: true as const,
  value: { token: 'verified-token', user: { id: 'admin-id' }, roles: ['SUPERADMIN'] },
};

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});

describe('admin user detail BFF route', () => {
  it('requires SUPERADMIN', async () => {
    authenticateRequest.mockResolvedValue(superadmin);
    requireRoles.mockReturnValue(NextResponse.json({ error: 'Forbidden' }, { status: 403 }));
    const response = await GET(new Request('http://bff/api/admin/users/user-1'), {
      params: Promise.resolve({ userId: 'user-1' }),
    });
    expect(response.status).toBe(403);
    expect(getAdminUser).not.toHaveBeenCalled();
  });

  it('loads a user detail through the connector and disables caching', async () => {
    vi.stubEnv('AUTH_SERVICE_URL', 'http://auth-service:8000');
    vi.stubEnv('KEYCLOAK_URL', 'http://keycloak:8080');
    vi.stubEnv('KEYCLOAK_REALM', 'uatf-dss-realm');
    vi.stubEnv('KEYCLOAK_AUDIENCE', 'uatf-auth-service');
    vi.stubEnv('KEYCLOAK_ROLE_CLIENT_ID', 'uatf-auth-service');
    vi.stubEnv('KEYCLOAK_BFF_CLIENT_ID', 'dss-bff');
    vi.stubEnv('KEYCLOAK_BFF_CLIENT_SECRET', 'test-secret');
    vi.stubEnv('KEYCLOAK_BFF_REDIRECT_URI', 'http://bff/api/auth/callback');
    vi.stubEnv('KEYCLOAK_BFF_POST_LOGOUT_REDIRECT_URI', 'http://portal/login');
    vi.stubEnv('BFF_DEFAULT_POST_LOGIN_REDIRECT_URI', 'http://portal/');
    vi.stubEnv('BFF_ALLOWED_ORIGINS', 'http://portal');
    vi.stubEnv('BFF_SESSION_SECRET', 'test-session-secret-with-enough-entropy');
    authenticateRequest.mockResolvedValue(superadmin);
    requireRoles.mockReturnValue(null);
    const user = { id: '6acb7476-663d-4c94-b3bd-9e5ac6db7f31', username: 'ana' };
    getAdminUser.mockResolvedValue(user);

    const response = await GET(new Request(`http://bff/api/admin/users/${user.id}`), {
      params: Promise.resolve({ userId: user.id }),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(user);
    expect(getAdminUser).toHaveBeenCalledWith('http://auth-service:8000', 'verified-token', user.id, expect.any(AbortSignal));
    expect(response.headers.get('cache-control')).toBe('no-store');
  });
});
