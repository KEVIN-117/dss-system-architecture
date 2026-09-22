import type { KeycloakJwtVerificationOptions } from '@dss-monorepo/auth-connector';

type Environment = Readonly<Record<string, string | undefined>>;

export interface BffAuthConfig {
  authServiceUrl: string;
  keycloak: KeycloakJwtVerificationOptions;
}

export class BffConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BffConfigurationError';
  }
}

/**
 * The BFF is the only layer allowed to read environment variables. Connector
 * functions receive this resolved, typed configuration as arguments.
 */
export function getBffAuthConfig(environment: Environment = process.env): BffAuthConfig {
  return {
    authServiceUrl: requiredHttpUrl(environment, 'AUTH_SERVICE_URL'),
    keycloak: {
      keycloakUrl: requiredHttpUrl(environment, 'KEYCLOAK_URL'),
      realm: requiredValue(environment, 'KEYCLOAK_REALM'),
      audience: requiredValue(environment, 'KEYCLOAK_AUDIENCE'),
      roleClientId: requiredValue(environment, 'KEYCLOAK_ROLE_CLIENT_ID'),
    },
  };
}

export function getAllowedOrigins(environment: Environment = process.env): readonly string[] {
  const configuredOrigins = environment.BFF_ALLOWED_ORIGINS?.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean) ?? [];

  return configuredOrigins.map((origin) => {
    try {
      const parsed = new URL(origin);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        throw new Error('unsupported protocol');
      }
      return parsed.origin;
    } catch {
      throw new BffConfigurationError('BFF_ALLOWED_ORIGINS must contain valid HTTP(S) origins');
    }
  });
}

function requiredValue(environment: Environment, name: string): string {
  const value = environment[name]?.trim();
  if (!value) {
    throw new BffConfigurationError(`${name} must be configured`);
  }
  return value;
}

function requiredHttpUrl(environment: Environment, name: string): string {
  const value = requiredValue(environment, name);

  try {
    const parsed = new URL(value);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new Error('unsupported protocol');
    }
    return parsed.toString().replace(/\/$/, '');
  } catch {
    throw new BffConfigurationError(`${name} must be a valid HTTP(S) URL`);
  }
}
