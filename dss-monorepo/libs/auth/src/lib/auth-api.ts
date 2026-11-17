import {
  isAuthUserProfile,
  isDSSRole,
  type AuthUserProfile,
  type DSSRole,
} from '@dss-monorepo/auth-models';

export interface BffSessionResponse {
  user: AuthUserProfile;
  roles: DSSRole[];
  permissions: string[];
}

function bffUrl(bffBaseUrl: string, path: string): string {
  return `${bffBaseUrl.replace(/\/$/, '')}${path}`;
}

/** Reads the current profile from the BFF session cookie. */
export async function fetchBffSession(
  bffBaseUrl: string,
  signal?: AbortSignal,
): Promise<BffSessionResponse> {
  const response = await fetch(bffUrl(bffBaseUrl, '/api/auth/me'), {
    method: 'GET',
    headers: { Accept: 'application/json' },
    credentials: 'include',
    cache: 'no-store',
    signal,
  });

  if (!response.ok) {
    throw new AuthProfileError(response.status, await response.text());
  }

  return parseBffSessionResponse(await response.json());
}

export interface BffSessionHeartbeat {
  /** Epoch milliseconds when the session ends unless more activity is reported. */
  expiresAt: number;
  /** Epoch milliseconds of the absolute session cap (login + max lifetime). */
  absoluteExpiresAt: number;
  idleTimeoutSeconds: number;
}

/**
 * Reports user activity to the BFF. It extends the idle window and renews the
 * Keycloak access token server-side when needed; no token reaches the browser.
 */
export async function refreshBffSession(
  bffBaseUrl: string,
  signal?: AbortSignal,
): Promise<BffSessionHeartbeat> {
  const response = await fetch(bffUrl(bffBaseUrl, '/api/auth/refresh'), {
    method: 'POST',
    headers: { Accept: 'application/json' },
    credentials: 'include',
    cache: 'no-store',
    signal,
  });
  if (!response.ok) {
    throw new AuthProfileError(response.status, await response.text());
  }
  const value: unknown = await response.json();
  if (
    !isRecord(value) ||
    !isPositiveNumber(value.expiresAt) ||
    !isPositiveNumber(value.absoluteExpiresAt) ||
    !isPositiveNumber(value.idleTimeoutSeconds)
  ) {
    throw new AuthProfileError(502, 'BFF returned an invalid session heartbeat');
  }
  return {
    expiresAt: value.expiresAt,
    absoluteExpiresAt: value.absoluteExpiresAt,
    idleTimeoutSeconds: value.idleTimeoutSeconds,
  };
}

function isPositiveNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

export function parseBffSessionResponse(value: unknown): BffSessionResponse {
  if (
    !isRecord(value) ||
    !isAuthUserProfile(value.user) ||
    !Array.isArray(value.roles) ||
    !Array.isArray(value.permissions)
  ) {
    throw new AuthProfileError(502, 'BFF returned an invalid authentication response');
  }

  const rawRoles: unknown[] = value.roles;
  const roles = rawRoles.filter(
    (role: unknown): role is DSSRole => typeof role === 'string' && isDSSRole(role),
  );
  if (roles.length !== rawRoles.length) {
    throw new AuthProfileError(502, 'BFF returned an invalid role set');
  }

  const permissions = value.permissions.filter(
    (permission: unknown): permission is string => typeof permission === 'string' && permission.length > 0,
  );
  if (permissions.length !== value.permissions.length) {
    throw new AuthProfileError(502, 'BFF returned an invalid permission set');
  }

  return { user: value.user, roles, permissions };
}

export class AuthProfileError extends Error {
  constructor(
    public readonly status: number,
    detail: string,
  ) {
    super(detail || 'Unable to load the authenticated user profile');
    this.name = 'AuthProfileError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
