import { afterEach, describe, expect, it, vi } from 'vitest';

import { GET } from './route';

function configureEnvironment() {
  vi.stubEnv('AUTH_SERVICE_URL', 'http://auth-service:8000');
  vi.stubEnv('KEYCLOAK_URL', 'http://keycloak:8080');
  vi.stubEnv('KEYCLOAK_REALM', 'uatf-dss-realm');
  vi.stubEnv('KEYCLOAK_AUDIENCE', 'uatf-auth-service');
  vi.stubEnv('KEYCLOAK_ROLE_CLIENT_ID', 'uatf-auth-service');
  vi.stubEnv('KEYCLOAK_BFF_CLIENT_ID', 'dss-bff');
  vi.stubEnv('KEYCLOAK_BFF_CLIENT_SECRET', 'a-confidential-client-secret-that-is-not-committed');
  vi.stubEnv('KEYCLOAK_BFF_REDIRECT_URI', 'http://localhost:3006/api/auth/callback');
  vi.stubEnv('KEYCLOAK_BFF_POST_LOGOUT_REDIRECT_URI', 'http://localhost:3000/login');
  vi.stubEnv('BFF_DEFAULT_POST_LOGIN_REDIRECT_URI', 'http://localhost:3000/');
  vi.stubEnv('BFF_ALLOWED_ORIGINS', 'http://localhost:3000');
  vi.stubEnv('BFF_SESSION_SECRET', 'a-development-only-secret-that-is-not-committed');
}

describe('GET /api/auth/login', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('starts a stateful PKCE flow and limits the return target to an allowed portal', async () => {
    configureEnvironment();
    const response = await GET(new Request(
      'http://localhost:3006/api/auth/login?action=register&returnTo=https://attacker.example/',
    ));
    const location = new URL(response.headers.get('location')!);

    expect(response.status).toBe(302);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(location.origin).toBe('http://keycloak:8080');
    expect(location.pathname).toBe('/realms/uatf-dss-realm/protocol/openid-connect/auth');
    expect(location.searchParams.get('response_type')).toBe('code');
    expect(location.searchParams.get('code_challenge_method')).toBe('S256');
    expect(location.searchParams.get('state')).toBeTruthy();
    expect(location.searchParams.get('nonce')).toBeTruthy();
    expect(location.searchParams.get('kc_action')).toBe('REGISTER');
    expect(response.cookies.get('dss_session_oauth')?.httpOnly).toBe(true);
  });
});
