import { describe, expect, it } from 'vitest';

import { BffConfigurationError, getAllowedOrigins, getBffAuthConfig } from './bff-config';

const environment = {
  AUTH_SERVICE_URL: 'http://auth-service:8000/',
  KEYCLOAK_URL: 'https://keycloak.example.edu/auth/',
  KEYCLOAK_REALM: 'uatf-dss-realm',
  KEYCLOAK_AUDIENCE: 'uatf-auth-service',
  KEYCLOAK_ROLE_CLIENT_ID: 'uatf-auth-service',
  KEYCLOAK_BFF_CLIENT_ID: 'dss-bff',
  KEYCLOAK_BFF_CLIENT_SECRET: 'a-confidential-client-secret-that-is-not-committed',
  KEYCLOAK_BFF_REDIRECT_URI: 'https://bff.example.edu/api/auth/callback',
  KEYCLOAK_BFF_POST_LOGOUT_REDIRECT_URI: 'https://admin.example.edu/login',
  BFF_DEFAULT_POST_LOGIN_REDIRECT_URI: 'https://admin.example.edu/',
  BFF_SESSION_SECRET: 'a-development-only-secret-that-is-not-committed',
  BFF_ALLOWED_ORIGINS: 'http://localhost:3001, https://admin.example.edu',
};

describe('BFF server configuration', () => {
  it('resolves connector configuration without leaking environment access to libraries', () => {
    expect(getBffAuthConfig(environment)).toEqual({
      authServiceUrl: 'http://auth-service:8000',
      keycloak: {
        keycloakUrl: 'https://keycloak.example.edu/auth',
        realm: 'uatf-dss-realm',
        audience: 'uatf-auth-service',
        roleClientId: 'uatf-auth-service',
      },
      oidc: {
        keycloakUrl: 'https://keycloak.example.edu/auth',
        realm: 'uatf-dss-realm',
        clientId: 'dss-bff',
        clientSecret: 'a-confidential-client-secret-that-is-not-committed',
        redirectUri: 'https://bff.example.edu/api/auth/callback',
        postLogoutRedirectUri: 'https://admin.example.edu/login',
      },
      defaultPostLoginRedirectUri: 'https://admin.example.edu',
      session: {
        cookieName: 'dss_session',
        secret: 'a-development-only-secret-that-is-not-committed',
        ttlSeconds: 300,
        secure: false,
      },
    });
    expect(getAllowedOrigins(environment)).toEqual([
      'http://localhost:3001',
      'https://admin.example.edu',
    ]);
  });

  it('fails closed when a required connector value is missing', () => {
    expect(() => getBffAuthConfig({ ...environment, KEYCLOAK_AUDIENCE: '' }))
      .toThrow(new BffConfigurationError('KEYCLOAK_AUDIENCE must be configured'));
  });

  it('fails closed when the BFF confidential-client secret is missing', () => {
    expect(() => getBffAuthConfig({ ...environment, KEYCLOAK_BFF_CLIENT_SECRET: '' }))
      .toThrow(new BffConfigurationError('KEYCLOAK_BFF_CLIENT_SECRET must be configured'));
  });

  it('requires post-login redirects to target an allowed portal', () => {
    expect(() => getBffAuthConfig({
      ...environment,
      BFF_DEFAULT_POST_LOGIN_REDIRECT_URI: 'https://attacker.example/',
    })).toThrow(new BffConfigurationError(
      'BFF_DEFAULT_POST_LOGIN_REDIRECT_URI must use an origin in BFF_ALLOWED_ORIGINS',
    ));
  });
});
