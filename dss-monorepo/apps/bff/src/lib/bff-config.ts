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
  /** Inactivity window; only explicit user-activity heartbeats extend it. */
  idleTimeoutSeconds: number;
  /** Absolute cap measured from login, regardless of activity. */
  maxLifetimeSeconds: number;
  /** Access tokens are renewed when they have fewer seconds than this left. */
  refreshLeewaySeconds: number;
  secure: boolean;
}

export interface DwControlServiceRuntimeConfig {
  baseUrl: string;
  timeoutMs: number;
}

export const DEFAULT_SESSION_COOKIE_NAME = 'dss_session';
// Aligned with the realm's ssoSessionIdleTimeout / ssoSessionMaxLifespan.
const DEFAULT_SESSION_IDLE_TIMEOUT_SECONDS = 1800;
const DEFAULT_SESSION_MAX_LIFETIME_SECONDS = 36_000;
const SESSION_REFRESH_LEEWAY_SECONDS = 60;

export class BffConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BffConfigurationError';
  }
}

export function getOlapServiceUrl(
  environment: Environment = process.env,
): string {
  return requiredHttpUrl(environment, 'OLAP_SERVICE_URL');
}

export function getPredictionServiceUrl(
  environment: Environment = process.env,
): string {
  const value = requiredHttpUrl(environment, 'PREDICTION_SERVICE_URL');
  const url = new URL(value);
  if (url.username || url.password || url.search || url.hash) {
    throw new BffConfigurationError(
      'PREDICTION_SERVICE_URL must not contain credentials, query parameters, or a fragment',
    );
  }
  return url.toString().replace(/\/$/, '');
}

/** Private server-side endpoint for the authenticated DW control API. */
export function getDwControlServiceConfig(
  environment: Environment = process.env,
): DwControlServiceRuntimeConfig {
  const baseUrl = requiredHttpUrl(environment, 'DW_CONTROL_SERVICE_URL');
  const url = new URL(baseUrl);
  if (url.username || url.password || url.search || url.hash) {
    throw new BffConfigurationError(
      'DW_CONTROL_SERVICE_URL must not contain credentials, query parameters, or a fragment',
    );
  }
  const configuredTimeout = environment.DW_CONTROL_SERVICE_TIMEOUT_MS?.trim();
  const timeoutMs = configuredTimeout ? Number(configuredTimeout) : 15_000;
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1000 || timeoutMs > 60_000) {
    throw new BffConfigurationError(
      'DW_CONTROL_SERVICE_TIMEOUT_MS must be an integer between 1000 and 60000 milliseconds',
    );
  }
  return { baseUrl: url.toString().replace(/\/$/, ''), timeoutMs };
}

/**
 * The BFF is the only layer allowed to read environment variables. Connector
 * functions receive this resolved, typed configuration as arguments.
 */
export function getBffAuthConfig(
  environment: Environment = process.env,
): BffAuthConfig {
  const allowedOrigins = getAllowedOrigins(environment);
  const defaultPostLoginRedirectUri = requiredHttpUrl(
    environment,
    'BFF_DEFAULT_POST_LOGIN_REDIRECT_URI',
  );
  const postLogoutRedirectUri = requiredHttpUrl(
    environment,
    'KEYCLOAK_BFF_POST_LOGOUT_REDIRECT_URI',
  );
  assertPortalRedirect(
    defaultPostLoginRedirectUri,
    allowedOrigins,
    'BFF_DEFAULT_POST_LOGIN_REDIRECT_URI',
  );
  assertPortalRedirect(
    postLogoutRedirectUri,
    allowedOrigins,
    'KEYCLOAK_BFF_POST_LOGOUT_REDIRECT_URI',
  );

  return {
    authServiceUrl: requiredHttpUrl(environment, 'AUTH_SERVICE_URL'),
    keycloak: {
      keycloakUrl: requiredHttpUrl(environment, 'KEYCLOAK_URL'),
      realm: requiredValue(environment, 'KEYCLOAK_REALM'),
      audience: requiredValue(environment, 'KEYCLOAK_AUDIENCE'),
      roleClientId: requiredValue(environment, 'KEYCLOAK_ROLE_CLIENT_ID'),
      permissionsClientId:
        environment.KEYCLOAK_PERMISSIONS_CLIENT_ID?.trim() || 'dss-permissions',
      portalRoles: getPortalRoleMap(environment),
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

const PORTAL_ROLES = ['SUPERADMIN', 'RECTOR', 'DECANO', 'DIRECTOR'] as const;

/**
 * `KEYCLOAK_PORTAL_ROLES`: JSON object mapping extra realm roles to the portal they open, for example
 * `{"VICERRECTOR":"RECTOR"}` (IAM-014). Without it only the four known roles open a portal.
 */
export function getPortalRoleMap(
  environment: Environment = process.env,
): Record<string, (typeof PORTAL_ROLES)[number]> {
  const raw = environment.KEYCLOAK_PORTAL_ROLES?.trim();
  if (!raw) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    throw new BffConfigurationError('KEYCLOAK_PORTAL_ROLES must be a JSON object');
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new BffConfigurationError('KEYCLOAK_PORTAL_ROLES must be a JSON object');
  }
  const map: Record<string, (typeof PORTAL_ROLES)[number]> = {};
  for (const [role, portal] of Object.entries(parsed)) {
    if (
      !role.trim() ||
      typeof portal !== 'string' ||
      !(PORTAL_ROLES as readonly string[]).includes(portal)
    ) {
      throw new BffConfigurationError(
        `KEYCLOAK_PORTAL_ROLES maps "${role}" to an unknown portal role`,
      );
    }
    map[role.trim()] = portal as (typeof PORTAL_ROLES)[number];
  }
  return map;
}

export function getBffSessionConfig(
  environment: Environment = process.env,
): BffSessionConfig {
  const idleTimeoutSeconds = integerSetting(
    environment,
    'BFF_SESSION_IDLE_TIMEOUT_SECONDS',
    DEFAULT_SESSION_IDLE_TIMEOUT_SECONDS,
    300,
    28_800,
  );
  const maxLifetimeSeconds = integerSetting(
    environment,
    'BFF_SESSION_MAX_LIFETIME_SECONDS',
    DEFAULT_SESSION_MAX_LIFETIME_SECONDS,
    900,
    86_400,
  );
  if (maxLifetimeSeconds < idleTimeoutSeconds) {
    throw new BffConfigurationError(
      'BFF_SESSION_MAX_LIFETIME_SECONDS must be greater than or equal to BFF_SESSION_IDLE_TIMEOUT_SECONDS',
    );
  }

  const secret = requiredValue(environment, 'BFF_SESSION_SECRET');
  if (secret.length < 32) {
    throw new BffConfigurationError(
      'BFF_SESSION_SECRET must contain at least 32 characters',
    );
  }

  const cookieName = getBffSessionCookieName(environment);
  if (!/^[A-Za-z0-9_-]+$/.test(cookieName)) {
    throw new BffConfigurationError(
      'BFF_SESSION_COOKIE contains invalid characters',
    );
  }

  return {
    cookieName,
    secret,
    idleTimeoutSeconds,
    maxLifetimeSeconds,
    refreshLeewaySeconds: SESSION_REFRESH_LEEWAY_SECONDS,
    secure: cookieSecureSetting(environment),
  };
}

/**
 * Whether BFF cookies carry the `Secure` attribute. Defaults to production
 * mode; `BFF_COOKIE_SECURE=false` is an explicit opt-out for deployments that
 * are still served over plain HTTP, where browsers drop `Secure` cookies.
 */
function cookieSecureSetting(environment: Environment): boolean {
  const raw = environment.BFF_COOKIE_SECURE?.trim().toLowerCase();
  if (!raw) {
    return environment.NODE_ENV === 'production';
  }
  if (raw === 'true') {
    return true;
  }
  if (raw === 'false') {
    return false;
  }
  throw new BffConfigurationError('BFF_COOKIE_SECURE must be "true" or "false"');
}

export function getBffSessionCookieName(
  environment: Environment = process.env,
): string {
  return environment.BFF_SESSION_COOKIE?.trim() || DEFAULT_SESSION_COOKIE_NAME;
}

export function getAllowedOrigins(
  environment: Environment = process.env,
): readonly string[] {
  const configuredOrigins =
    environment.BFF_ALLOWED_ORIGINS?.split(',')
      .map((origin) => origin.trim())
      .filter(Boolean) ?? [];

  if (configuredOrigins.length === 0) {
    throw new BffConfigurationError(
      'BFF_ALLOWED_ORIGINS must configure at least one portal origin',
    );
  }

  return configuredOrigins.map((origin) => {
    try {
      const parsed = new URL(origin);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        throw new Error('unsupported protocol');
      }
      return parsed.origin;
    } catch {
      throw new BffConfigurationError(
        'BFF_ALLOWED_ORIGINS must contain valid HTTP(S) origins',
      );
    }
  });
}

function assertPortalRedirect(
  redirectUri: string,
  allowedOrigins: readonly string[],
  variableName: string,
): void {
  if (!allowedOrigins.includes(new URL(redirectUri).origin)) {
    throw new BffConfigurationError(
      `${variableName} must use an origin in BFF_ALLOWED_ORIGINS`,
    );
  }
}

function integerSetting(
  environment: Environment,
  name: string,
  fallback: number,
  min: number,
  max: number,
): number {
  const raw = environment[name]?.trim();
  const value = raw ? Number(raw) : fallback;
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new BffConfigurationError(
      `${name} must be an integer between ${min} and ${max} seconds`,
    );
  }
  return value;
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
