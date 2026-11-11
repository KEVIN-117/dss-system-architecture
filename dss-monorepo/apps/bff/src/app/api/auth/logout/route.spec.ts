import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GET } from './route';
import { sealSession } from '../../_lib/session-cookie';

describe('GET /api/auth/logout', () => {
  beforeEach(() => {
    vi.stubEnv('AUTH_SERVICE_URL', 'http://auth-service:8000');
    vi.stubEnv('KEYCLOAK_URL', 'http://keycloak:8080');
    vi.stubEnv('KEYCLOAK_REALM', 'uatf-dss-realm');
    vi.stubEnv('KEYCLOAK_AUDIENCE', 'uatf-auth-service');
    vi.stubEnv('KEYCLOAK_ROLE_CLIENT_ID', 'uatf-auth-service');
    vi.stubEnv('KEYCLOAK_BFF_CLIENT_ID', 'dss-bff');
    vi.stubEnv('KEYCLOAK_BFF_CLIENT_SECRET', 'development-only-secret');
    vi.stubEnv(
      'KEYCLOAK_BFF_REDIRECT_URI',
      'http://localhost:3006/api/auth/callback',
    );
    vi.stubEnv(
      'KEYCLOAK_BFF_POST_LOGOUT_REDIRECT_URI',
      'http://localhost:3000/login',
    );
    vi.stubEnv('BFF_DEFAULT_POST_LOGIN_REDIRECT_URI', 'http://localhost:3000/');
    vi.stubEnv('BFF_ALLOWED_ORIGINS', 'http://localhost:3000');
    vi.stubEnv(
      'BFF_SESSION_SECRET',
      'a-development-only-secret-that-is-not-committed',
    );
  });
  afterEach(() => vi.unstubAllEnvs());

  it.each([undefined, 'dss_session=%'])(
    'redirects to the landing and clears an absent or invalid session',
    async (cookie) => {
      const headers = cookie ? { cookie } : undefined;
      const response = await GET(
        new Request('http://localhost:3006/api/auth/logout', { headers }),
      );
      expect(response.status).toBe(303);
      expect(response.headers.get('location')).toBe(
        'http://localhost:3000/login',
      );
      expect(response.headers.get('set-cookie')).toContain('Max-Age=0');
    },
  );

  it('sends an active SSO session to Keycloak with the configured landing redirect', async () => {
    const session = await sealSession({ accessToken: 'access', idToken: 'id-token' });
    const response = await GET(new Request('http://localhost:3006/api/auth/logout', {
      headers: { cookie: `dss_session=${session.value}` },
    }));
    const location = new URL(response.headers.get('location') as string);
    expect(response.status).toBe(303);
    expect(location.origin).toBe('http://keycloak:8080');
    expect(location.searchParams.get('id_token_hint')).toBe('id-token');
    expect(location.searchParams.get('post_logout_redirect_uri')).toBe('http://localhost:3000/login');
    expect(response.headers.get('set-cookie')).toContain('Max-Age=0');
  });
});
