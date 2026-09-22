import { fetchUserProfile, verifyKeycloakJwt } from '@dss-monorepo/auth-connector';
import { describe, expect, it, beforeEach, vi } from 'vitest';

import { authenticateRequest, extractBearerToken, requireRoles } from './auth-guard';

vi.mock('@dss-monorepo/auth-connector', () => ({
  AuthServiceClientError: class AuthServiceClientError extends Error {},
  JwtVerificationError: class JwtVerificationError extends Error {},
  fetchUserProfile: vi.fn(),
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

describe('BFF authentication guard', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubEnv('AUTH_SERVICE_URL', 'http://auth-service:8000');
    vi.stubEnv('KEYCLOAK_URL', 'http://keycloak:8080');
    vi.stubEnv('KEYCLOAK_REALM', 'uatf-dss-realm');
    vi.stubEnv('KEYCLOAK_AUDIENCE', 'uatf-auth-service');
    vi.stubEnv('KEYCLOAK_ROLE_CLIENT_ID', 'uatf-auth-service');
  });

  it('uses the connector to verify the token and fetch the local profile', async () => {
    vi.mocked(verifyKeycloakJwt).mockResolvedValue({
      claims: {
        sub: '123e4567-e89b-42d3-a456-426614174000',
        iss: 'http://keycloak:8080/realms/uatf-dss-realm',
        aud: 'uatf-auth-service',
        exp: 2_000_000_000,
      },
      roles: ['DIRECTOR'],
    });
    vi.mocked(fetchUserProfile).mockResolvedValue(profile);

    const result = await authenticateRequest(new Request('http://bff/api/auth/me', {
      headers: { Authorization: 'Bearer access-token' },
    }));

    expect(result).toEqual({
      authenticated: true,
      value: {
        token: 'access-token',
        roles: ['DIRECTOR'],
        user: { ...profile, roles: ['DIRECTOR'] },
      },
    });
    expect(verifyKeycloakJwt).toHaveBeenCalledWith('access-token', {
      keycloakUrl: 'http://keycloak:8080',
      realm: 'uatf-dss-realm',
      audience: 'uatf-auth-service',
      roleClientId: 'uatf-auth-service',
    });
    expect(fetchUserProfile).toHaveBeenCalledWith('http://auth-service:8000', 'access-token');
  });

  it('rejects malformed bearer headers before calling a connector', async () => {
    const result = await authenticateRequest(new Request('http://bff/api/auth/me'));

    expect(result.authenticated).toBe(false);
    expect(verifyKeycloakJwt).not.toHaveBeenCalled();
    expect(fetchUserProfile).not.toHaveBeenCalled();
    expect(extractBearerToken('Basic abc')).toBeNull();
    expect(extractBearerToken('Bearer token')).toBe('token');
  });

  it('uses the shared RBAC hierarchy and returns 403 when authorization fails', async () => {
    const denied = requireRoles({
      token: 'access-token',
      roles: ['DIRECTOR'],
      user: { ...profile, roles: ['DIRECTOR'] },
    }, ['DECANO']);

    expect(denied?.status).toBe(403);
  });
});
