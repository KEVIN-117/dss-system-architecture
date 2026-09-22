import { isAuthUserProfile, type AuthUserProfile } from '@dss-monorepo/auth-models';

/**
 * Obtiene el perfil local sincronizado por auth-service. Los roles no son
 * parte de este endpoint: el proveedor los lee del access token firmado.
 * 
 * @param authServiceUrl Origen del auth-service, sin el context path del API.
 * @returns Perfil local sin roles, tal como lo expone auth-service.
 */
export async function fetchCurrentUser(
  authServiceUrl: string,
  token: string,
  signal?: AbortSignal,
): Promise<AuthUserProfile> {
  const baseUrl = authServiceUrl.replace(/\/$/, '');
  const response = await fetch(`${baseUrl}/api/v1/auth/me`, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
    cache: 'no-store',
    signal,
  });

  if (!response.ok) {
    throw new AuthProfileError(response.status, await response.text());
  }

  return parseAuthUserProfile(await response.json());
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

export function parseAuthUserProfile(value: unknown): AuthUserProfile {
  if (!isAuthUserProfile(value)) {
    throw new AuthProfileError(502, 'auth-service returned an invalid user profile');
  }

  return value;
}
