import type { AcademicContext, AuthUser } from './types';

/**
 * Obtiene el perfil local sincronizado por auth-service. Los roles no son
 * parte de este endpoint: el proveedor los lee del access token firmado.
 * 
 * @param authServiceUrl Origen del auth-service, sin el context path del API.
 * @returns Promesa que resuelve a AuthUser
 */
export async function fetchCurrentUser(
  authServiceUrl: string,
  token: string,
  signal?: AbortSignal,
): Promise<Omit<AuthUser, 'roles'>> {
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

export function parseAuthUserProfile(value: unknown): Omit<AuthUser, 'roles'> {
  if (!isRecord(value) ||
      !isUuid(value.id) ||
      !isString(value.username) ||
      !isString(value.email) ||
      !isString(value.firstName) ||
      !isString(value.lastName) ||
      typeof value.isActive !== 'boolean' ||
      !Array.isArray(value.academicContexts)) {
    throw new AuthProfileError(502, 'auth-service returned an invalid user profile');
  }

  return {
    id: value.id,
    username: value.username,
    email: value.email,
    firstName: value.firstName,
    lastName: value.lastName,
    isActive: value.isActive,
    academicContexts: value.academicContexts.map(parseAcademicContext),
  };
}

function parseAcademicContext(value: unknown): AcademicContext {
  if (!isRecord(value) ||
      !isUuid(value.id) ||
      !isUuid(value.userId) ||
      !isNullablePositiveInteger(value.facultyId) ||
      !isNullablePositiveInteger(value.careerId)) {
    throw new AuthProfileError(502, 'auth-service returned an invalid academic context');
  }

  return {
    id: value.id,
    userId: value.userId,
    facultyId: value.facultyId,
    careerId: value.careerId,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function isUuid(value: unknown): value is string {
  return isString(value) && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function isNullablePositiveInteger(value: unknown): value is number | null {
  return value === null || (typeof value === 'number' && Number.isInteger(value) && value > 0);
}
