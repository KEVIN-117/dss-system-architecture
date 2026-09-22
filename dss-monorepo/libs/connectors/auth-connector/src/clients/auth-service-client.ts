import {
  isAuthUserProfile,
  type AuthUserProfile,
} from '@dss-monorepo/auth-models';

export class AuthServiceClientError extends Error {
  constructor(
    public readonly status: number,
    message = 'Unable to load the authenticated user profile',
  ) {
    super(message);
    this.name = 'AuthServiceClientError';
  }
}

/**
 * Retrieves the local profile synchronized by auth-service. Roles are not
 * returned by this endpoint and must be taken from a verified JWT instead.
 */
export async function fetchUserProfile(
  authServiceUrl: string,
  bearerToken: string,
  signal?: AbortSignal,
): Promise<AuthUserProfile> {
  const response = await fetch(`${authServiceUrl.replace(/\/$/, '')}/api/v1/auth/me`, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${bearerToken}`,
    },
    signal,
  });

  if (!response.ok) {
    throw new AuthServiceClientError(response.status);
  }

  const profile: unknown = await response.json();
  if (!isAuthUserProfile(profile)) {
    throw new AuthServiceClientError(502, 'auth-service returned an invalid user profile');
  }
  return profile;
}
