import { describe, expect, it } from 'vitest';

import { BffConfigurationError, getAllowedOrigins, getBffAuthConfig } from './bff-config';

const environment = {
  AUTH_SERVICE_URL: 'http://auth-service:8000/',
  KEYCLOAK_URL: 'https://keycloak.example.edu/auth/',
  KEYCLOAK_REALM: 'uatf-dss-realm',
  KEYCLOAK_AUDIENCE: 'uatf-auth-service',
  KEYCLOAK_ROLE_CLIENT_ID: 'uatf-auth-service',
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
});
