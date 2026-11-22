import { describe, expect, it } from 'vitest';

import {
  BffConfigurationError,
  getAllowedOrigins,
  getBffAuthConfig,
  getBffSessionConfig,
  getDwControlServiceConfig,
  getPortalRoleMap,
  getPredictionServiceUrl,
} from './bff-config';

const environment = {
  AUTH_SERVICE_URL: 'http://auth-service:8000/',
  KEYCLOAK_URL: 'https://keycloak.example.edu/auth/',
  KEYCLOAK_REALM: 'uatf-dss-realm',
  KEYCLOAK_AUDIENCE: 'uatf-auth-service',
  KEYCLOAK_BFF_CLIENT_ID: 'dss-bff',
  KEYCLOAK_BFF_CLIENT_SECRET:
    'a-confidential-client-secret-that-is-not-committed',
  KEYCLOAK_BFF_REDIRECT_URI: 'https://bff.example.edu/api/auth/callback',
  KEYCLOAK_BFF_POST_LOGOUT_REDIRECT_URI: 'https://admin.example.edu/login',
  BFF_DEFAULT_POST_LOGIN_REDIRECT_URI: 'https://admin.example.edu/',
  BFF_SESSION_SECRET: 'a-development-only-secret-that-is-not-committed',
  BFF_ALLOWED_ORIGINS: 'http://localhost:3001, https://admin.example.edu',
};

describe('BFF server configuration', () => {
  it('validates the private DW Control Service URL and timeout', () => {
    expect(
      getDwControlServiceConfig({
        DW_CONTROL_SERVICE_URL: 'http://dw-control-service:8090/',
      }),
    ).toEqual({ baseUrl: 'http://dw-control-service:8090', timeoutMs: 15_000 });
    expect(
      getDwControlServiceConfig({
        DW_CONTROL_SERVICE_URL: 'https://dw.example.edu/api',
        DW_CONTROL_SERVICE_TIMEOUT_MS: '30000',
      }),
    ).toEqual({ baseUrl: 'https://dw.example.edu/api', timeoutMs: 30_000 });
    expect(() =>
      getDwControlServiceConfig({
        DW_CONTROL_SERVICE_URL: 'http://user:password@dw-control-service:8090',
      }),
    ).toThrow(BffConfigurationError);
    expect(() =>
      getDwControlServiceConfig({
        DW_CONTROL_SERVICE_URL: 'http://dw-control-service:8090',
        DW_CONTROL_SERVICE_TIMEOUT_MS: '100',
      }),
    ).toThrow(BffConfigurationError);
  });

  it('validates the private Prediction Service URL', () => {
    expect(
      getPredictionServiceUrl({
        PREDICTION_SERVICE_URL: 'http://prediction-service:8000/',
      }),
    ).toBe('http://prediction-service:8000');
    expect(() =>
      getPredictionServiceUrl({
        PREDICTION_SERVICE_URL: 'javascript:alert(1)',
      }),
    ).toThrow(
      new BffConfigurationError(
        'PREDICTION_SERVICE_URL must be a valid HTTP(S) URL',
      ),
    );
    expect(() =>
      getPredictionServiceUrl({
        PREDICTION_SERVICE_URL:
          'https://user:password@prediction.example/path?token=secret',
      }),
    ).toThrow(
      new BffConfigurationError(
        'PREDICTION_SERVICE_URL must not contain credentials, query parameters, or a fragment',
      ),
    );
  });

  it('resolves connector configuration without leaking environment access to libraries', () => {
    expect(getBffAuthConfig(environment)).toEqual({
      authServiceUrl: 'http://auth-service:8000',
      keycloak: {
        keycloakUrl: 'https://keycloak.example.edu/auth',
        realm: 'uatf-dss-realm',
        audience: 'uatf-auth-service',
        permissionsClientId: 'dss-permissions',
        portalRoles: {},
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
        idleTimeoutSeconds: 1800,
        maxLifetimeSeconds: 36_000,
        refreshLeewaySeconds: 60,
        secure: false,
      },
    });
    expect(getAllowedOrigins(environment)).toEqual([
      'http://localhost:3001',
      'https://admin.example.edu',
    ]);
  });

  it('validates the session idle and absolute lifetimes', () => {
    expect(
      getBffSessionConfig({
        ...environment,
        BFF_SESSION_IDLE_TIMEOUT_SECONDS: '900',
        BFF_SESSION_MAX_LIFETIME_SECONDS: '7200',
      }),
    ).toMatchObject({ idleTimeoutSeconds: 900, maxLifetimeSeconds: 7200 });
    expect(() =>
      getBffSessionConfig({ ...environment, BFF_SESSION_IDLE_TIMEOUT_SECONDS: '60' }),
    ).toThrow(BffConfigurationError);
    expect(() =>
      getBffSessionConfig({
        ...environment,
        BFF_SESSION_IDLE_TIMEOUT_SECONDS: '3600',
        BFF_SESSION_MAX_LIFETIME_SECONDS: '1800',
      }),
    ).toThrow(BffConfigurationError);
  });

  it('marks cookies Secure in production unless BFF_COOKIE_SECURE overrides it', () => {
    const production = { ...environment, NODE_ENV: 'production' };
    expect(getBffSessionConfig(production).secure).toBe(true);
    expect(getBffSessionConfig(environment).secure).toBe(false);
    expect(
      getBffSessionConfig({ ...production, BFF_COOKIE_SECURE: 'false' }).secure,
    ).toBe(false);
    expect(
      getBffSessionConfig({ ...environment, BFF_COOKIE_SECURE: ' TRUE ' }).secure,
    ).toBe(true);
    expect(() =>
      getBffSessionConfig({ ...production, BFF_COOKIE_SECURE: 'no' }),
    ).toThrow(BffConfigurationError);
  });

  it('fails closed when a required connector value is missing', () => {
    expect(() =>
      getBffAuthConfig({ ...environment, KEYCLOAK_AUDIENCE: '' }),
    ).toThrow(
      new BffConfigurationError('KEYCLOAK_AUDIENCE must be configured'),
    );
  });

  it('fails closed when the BFF confidential-client secret is missing', () => {
    expect(() =>
      getBffAuthConfig({ ...environment, KEYCLOAK_BFF_CLIENT_SECRET: '' }),
    ).toThrow(
      new BffConfigurationError(
        'KEYCLOAK_BFF_CLIENT_SECRET must be configured',
      ),
    );
  });

  it('requires post-login redirects to target an allowed portal', () => {
    expect(() =>
      getBffAuthConfig({
        ...environment,
        BFF_DEFAULT_POST_LOGIN_REDIRECT_URI: 'https://attacker.example/',
      }),
    ).toThrow(
      new BffConfigurationError(
        'BFF_DEFAULT_POST_LOGIN_REDIRECT_URI must use an origin in BFF_ALLOWED_ORIGINS',
      ),
    );
  });

  it('maps extra realm roles to a portal and rejects unknown portals (IAM-014)', () => {
    expect(getPortalRoleMap({})).toEqual({});
    expect(getPortalRoleMap({ KEYCLOAK_PORTAL_ROLES: ' {"VICERRECTOR":"RECTOR"} ' })).toEqual({ VICERRECTOR: 'RECTOR' });
    for (const invalid of ['not-json', '[]', '{"X":"ADMIN"}', '{"X":3}']) {
      expect(() => getPortalRoleMap({ KEYCLOAK_PORTAL_ROLES: invalid })).toThrow(BffConfigurationError);
    }
    expect(
      getBffAuthConfig({ ...environment, KEYCLOAK_PERMISSIONS_CLIENT_ID: 'catalog' }).keycloak.permissionsClientId,
    ).toBe('catalog');
  });
});
