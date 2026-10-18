import { NextResponse } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

const { authenticateRequest, requireRoles, replaceUserAcademicContexts } =
  vi.hoisted(() => ({
    authenticateRequest: vi.fn(),
    requireRoles: vi.fn(),
    replaceUserAcademicContexts: vi.fn(),
  }));

vi.mock('../../../../_lib/auth-guard', () => ({
  authenticateRequest,
  requireRoles,
}));
vi.mock('@dss-monorepo/auth-connector', () => ({
  AuthServiceClientError: class AuthServiceClientError extends Error {
    constructor(public readonly status: number) {
      super('auth-service client failure');
    }
  },
  isAcademicContextAssignmentRequest: (value: unknown) =>
    typeof value === 'object' &&
    value !== null &&
    'contexts' in value &&
    Array.isArray(value.contexts),
  replaceUserAcademicContexts,
}));

import { PUT } from './route';

const superadmin = {
  authenticated: true as const,
  value: {
    token: 'verified-access-token',
    user: { id: 'admin-id', roles: ['SUPERADMIN'] },
    roles: ['SUPERADMIN'],
  },
};

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});

function configureBff() {
  vi.stubEnv('AUTH_SERVICE_URL', 'http://auth-service:8000');
  vi.stubEnv('KEYCLOAK_URL', 'http://keycloak:8080');
  vi.stubEnv('KEYCLOAK_REALM', 'uatf-dss-realm');
  vi.stubEnv('KEYCLOAK_AUDIENCE', 'uatf-auth-service');
  vi.stubEnv('KEYCLOAK_ROLE_CLIENT_ID', 'uatf-auth-service');
  vi.stubEnv('KEYCLOAK_BFF_CLIENT_ID', 'dss-bff');
  vi.stubEnv(
    'KEYCLOAK_BFF_CLIENT_SECRET',
    'a-confidential-client-secret-not-committed',
  );
  vi.stubEnv('KEYCLOAK_BFF_REDIRECT_URI', 'http://bff/api/auth/callback');
  vi.stubEnv('KEYCLOAK_BFF_POST_LOGOUT_REDIRECT_URI', 'http://portal/login');
  vi.stubEnv('BFF_DEFAULT_POST_LOGIN_REDIRECT_URI', 'http://portal/');
  vi.stubEnv('BFF_ALLOWED_ORIGINS', 'http://portal');
  vi.stubEnv('BFF_SESSION_SECRET', 'a-development-only-secret-not-committed');
}

describe('admin academic-contexts BFF route', () => {
  it('requires SUPERADMIN and never calls auth-service for other roles', async () => {
    authenticateRequest.mockResolvedValue({
      authenticated: true,
      value: { token: 'token', user: { id: 'director' }, roles: ['DIRECTOR'] },
    });
    requireRoles.mockReturnValue(
      NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
    );

    const response = await PUT(
      new Request('http://bff/api/admin/users/user-1/academic-contexts', {
        method: 'PUT',
        body: JSON.stringify({ contexts: [] }),
      }),
      { params: Promise.resolve({ userId: 'user-1' }) },
    );

    expect(response.status).toBe(403);
    expect(requireRoles).toHaveBeenCalledWith(expect.anything(), [
      'SUPERADMIN',
    ]);
    expect(replaceUserAcademicContexts).not.toHaveBeenCalled();
  });

  it('passes the verified token and validated assignment to the auth connector', async () => {
    configureBff();
    authenticateRequest.mockResolvedValue(superadmin);
    requireRoles.mockReturnValue(null);
    const body = { contexts: [{ facultyId: 4, careerId: 'INF' }] };
    replaceUserAcademicContexts.mockResolvedValue([
      { id: 'ctx-1', ...body.contexts[0] },
    ]);

    const response = await PUT(
      new Request(
        'http://bff/api/admin/users/6acb7476-663d-4c94-b3bd-9e5ac6db7f31/academic-contexts',
        {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body),
        },
      ),
      {
        params: Promise.resolve({
          userId: '6acb7476-663d-4c94-b3bd-9e5ac6db7f31',
        }),
      },
    );

    expect(response.status).toBe(200);
    expect(replaceUserAcademicContexts).toHaveBeenCalledWith(
      'http://auth-service:8000',
      'verified-access-token',
      '6acb7476-663d-4c94-b3bd-9e5ac6db7f31',
      body,
      expect.any(AbortSignal),
    );
    expect(response.headers.get('cache-control')).toBe('no-store');
  });
});
