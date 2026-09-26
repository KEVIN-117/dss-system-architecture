import {
  exchangeAuthorizationCode,
  fetchUserProfile,
  verifyKeycloakIdToken,
  verifyKeycloakJwt,
} from '@dss-monorepo/auth-connector';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createOAuthTransaction, sealOAuthTransaction } from '../../_lib/oauth-transaction';
import { GET } from './route';

vi.mock('@dss-monorepo/auth-connector', () => ({
  exchangeAuthorizationCode: vi.fn(),
  fetchUserProfile: vi.fn(),
  verifyKeycloakIdToken: vi.fn(),
  verifyKeycloakJwt: vi.fn(),
}));

const profile = {
  id: '123e4567-e89b-42d3-a456-426614174000',
  username: 'director',
  email: 'director@example.edu',
  firstName: 'Directora',
  lastName: 'DSS',
  isActive: true,
  academicContexts: [],
};

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

describe('GET /api/auth/callback', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    configureEnvironment();
  });

  afterEach(() => vi.unstubAllEnvs());

  it('redirects a missing transaction to the configured portal login, never the BFF origin', async () => {
    const response = await GET(new Request('http://localhost:3006/api/auth/callback'));
    const location = new URL(response.headers.get('location')!);

    expect(response.status).toBe(303);
    expect(location.origin).toBe('http://localhost:3000');
    expect(location.pathname).toBe('/login');
  });

  it('rejects an unmatched state before exchanging a code', async () => {
    const transaction = await createOAuthTransaction('http://localhost:3000/');
    const cookie = await sealOAuthTransaction(transaction);
    const response = await GET(new Request(
      'http://localhost:3006/api/auth/callback?code=authorization-code&state=wrong-state',
      { headers: { Cookie: `dss_session_oauth=${encodeURIComponent(cookie)}` } },
    ));

    expect(response.status).toBe(303);
    expect(new URL(response.headers.get('location')!).origin).toBe('http://localhost:3000');
    expect(vi.mocked(exchangeAuthorizationCode)).not.toHaveBeenCalled();
  });

  it('validates the token pair and active profile before issuing the BFF cookie', async () => {
    const transaction = await createOAuthTransaction('http://localhost:3000/dashboard');
    const cookie = await sealOAuthTransaction(transaction);
    vi.mocked(exchangeAuthorizationCode).mockResolvedValue({
      accessToken: 'access-token',
      idToken: 'id-token',
      expiresIn: 300,
    });
    vi.mocked(verifyKeycloakIdToken).mockResolvedValue(undefined);
    vi.mocked(verifyKeycloakJwt).mockResolvedValue({
      claims: {
        sub: profile.id,
        iss: 'http://keycloak:8080/realms/uatf-dss-realm',
        aud: 'uatf-auth-service',
        exp: 2_000_000_000,
      },
      roles: ['DIRECTOR'],
    });
    vi.mocked(fetchUserProfile).mockResolvedValue(profile);

    const response = await GET(new Request(
      `http://localhost:3006/api/auth/callback?code=authorization-code&state=${transaction.state}`,
      { headers: { Cookie: `dss_session_oauth=${encodeURIComponent(cookie)}` } },
    ));

    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe('http://localhost:3000/dashboard');
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(response.cookies.get('dss_session')?.httpOnly).toBe(true);
    expect(verifyKeycloakIdToken).toHaveBeenCalledWith('id-token', expect.objectContaining({
      audience: 'dss-bff',
      nonce: transaction.nonce,
    }));
    expect(fetchUserProfile).toHaveBeenCalledWith('http://auth-service:8000', 'access-token');
  });
});
