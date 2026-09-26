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
