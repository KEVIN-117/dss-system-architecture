import type {
  KeycloakJwtVerificationOptions,
  KeycloakOidcClientConfig,
} from '@dss-monorepo/auth-connector';

type Environment = Readonly<Record<string, string | undefined>>;

export interface BffAuthConfig {
  authServiceUrl: string;
  keycloak: KeycloakJwtVerificationOptions;
  oidc: KeycloakOidcClientConfig & { postLogoutRedirectUri: string };
  defaultPostLoginRedirectUri: string;
  session: BffSessionConfig;
}

export interface BffSessionConfig {
  cookieName: string;
  secret: string;
  ttlSeconds: number;
  secure: boolean;
}

export const DEFAULT_SESSION_COOKIE_NAME = 'dss_session';
const DEFAULT_SESSION_TTL_SECONDS = 300;

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
  const allowedOrigins = getAllowedOrigins(environment);
  const defaultPostLoginRedirectUri = requiredHttpUrl(environment, 'BFF_DEFAULT_POST_LOGIN_REDIRECT_URI');
  const postLogoutRedirectUri = requiredHttpUrl(environment, 'KEYCLOAK_BFF_POST_LOGOUT_REDIRECT_URI');
  assertPortalRedirect(defaultPostLoginRedirectUri, allowedOrigins, 'BFF_DEFAULT_POST_LOGIN_REDIRECT_URI');
  assertPortalRedirect(postLogoutRedirectUri, allowedOrigins, 'KEYCLOAK_BFF_POST_LOGOUT_REDIRECT_URI');

  return {
    authServiceUrl: requiredHttpUrl(environment, 'AUTH_SERVICE_URL'),
    keycloak: {
      keycloakUrl: requiredHttpUrl(environment, 'KEYCLOAK_URL'),
      realm: requiredValue(environment, 'KEYCLOAK_REALM'),
      audience: requiredValue(environment, 'KEYCLOAK_AUDIENCE'),
      roleClientId: requiredValue(environment, 'KEYCLOAK_ROLE_CLIENT_ID'),
    },
    oidc: {
      keycloakUrl: requiredHttpUrl(environment, 'KEYCLOAK_URL'),
      realm: requiredValue(environment, 'KEYCLOAK_REALM'),
      clientId: requiredValue(environment, 'KEYCLOAK_BFF_CLIENT_ID'),
      clientSecret: requiredValue(environment, 'KEYCLOAK_BFF_CLIENT_SECRET'),
      redirectUri: requiredHttpUrl(environment, 'KEYCLOAK_BFF_REDIRECT_URI'),
      postLogoutRedirectUri,
    },
    defaultPostLoginRedirectUri,
    session: getBffSessionConfig(environment),
  };
}

export function getBffSessionConfig(environment: Environment = process.env): BffSessionConfig {
  const ttl = environment.BFF_SESSION_TTL_SECONDS?.trim();
  const ttlSeconds = ttl ? Number(ttl) : DEFAULT_SESSION_TTL_SECONDS;

  if (!Number.isInteger(ttlSeconds) || ttlSeconds < 60 || ttlSeconds > 900) {
    throw new BffConfigurationError(
      'BFF_SESSION_TTL_SECONDS must be an integer between 60 and 900 seconds',
    );
  }

  const secret = requiredValue(environment, 'BFF_SESSION_SECRET');
  if (secret.length < 32) {
    throw new BffConfigurationError('BFF_SESSION_SECRET must contain at least 32 characters');
  }

  const cookieName = getBffSessionCookieName(environment);
  if (!/^[A-Za-z0-9_-]+$/.test(cookieName)) {
    throw new BffConfigurationError('BFF_SESSION_COOKIE contains invalid characters');
  }

  return {
    cookieName,
    secret,
    ttlSeconds,
    secure: environment.NODE_ENV === 'production',
  };
}

export function getBffSessionCookieName(environment: Environment = process.env): string {
  return environment.BFF_SESSION_COOKIE?.trim() || DEFAULT_SESSION_COOKIE_NAME;
}

export function getAllowedOrigins(environment: Environment = process.env): readonly string[] {
  const configuredOrigins = environment.BFF_ALLOWED_ORIGINS?.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean) ?? [];

  if (configuredOrigins.length === 0) {
    throw new BffConfigurationError('BFF_ALLOWED_ORIGINS must configure at least one portal origin');
  }

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

function assertPortalRedirect(
  redirectUri: string,
  allowedOrigins: readonly string[],
  variableName: string,
): void {
  if (!allowedOrigins.includes(new URL(redirectUri).origin)) {
    throw new BffConfigurationError(`${variableName} must use an origin in BFF_ALLOWED_ORIGINS`);
  }
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
