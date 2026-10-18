import {
  isAcademicContext,
  isAuthUserProfile,
  type AcademicContext,
  type AuthUserProfile,
} from '@dss-monorepo/auth-models';

const DEFAULT_AUTH_SERVICE_TIMEOUT_MS = 15_000;

export class AuthServiceClientError extends Error {
  constructor(
    public readonly status: number,
    message = 'Unable to load the authenticated user profile',
  ) {
    super(message);
    this.name = 'AuthServiceClientError';
  }
}

export interface AcademicContextAssignment {
  facultyId: number | null;
  careerId: string | null;
}

/** Request shape accepted by the auth-service administrative API. */
export interface ReplaceUserAcademicContextsRequest {
  contexts: AcademicContextAssignment[];
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
  const response = await fetchAuthService(
    `${authServiceUrl.replace(/\/$/, '')}/api/v1/auth/me`,
    {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${bearerToken}`,
      },
    },
    signal,
  );

  if (!response.ok) {
    throw new AuthServiceClientError(response.status);
  }

  const profile: unknown = await readJson(
    response,
    'auth-service returned an invalid user profile',
  );
  if (!isAuthUserProfile(profile)) {
    throw new AuthServiceClientError(
      502,
      'auth-service returned an invalid user profile',
    );
  }
  return profile;
}

/**
 * Replaces a user's academic contexts through the superadmin-only auth-service
 * API. Callers must enforce the actor's role before invoking this operation.
 */
export async function replaceUserAcademicContexts(
  authServiceUrl: string,
  bearerToken: string,
  userId: string,
  request: ReplaceUserAcademicContextsRequest,
  signal?: AbortSignal,
): Promise<AcademicContext[]> {
  if (!isUuid(userId) || !isAcademicContextAssignmentRequest(request)) {
    throw new AuthServiceClientError(
      400,
      'Invalid academic context assignment request',
    );
  }

  const response = await fetchAuthService(
    `${authServiceUrl.replace(/\/$/, '')}/api/v1/admin/users/${encodeURIComponent(userId)}/academic-contexts`,
    {
      method: 'PUT',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${bearerToken}`,
      },
      body: JSON.stringify(request),
    },
    signal,
  );

  if (!response.ok) {
    throw new AuthServiceClientError(
      response.status,
      'Unable to update user academic contexts',
    );
  }

  const contexts: unknown = await readJson(
    response,
    'auth-service returned invalid academic contexts',
  );
  if (!Array.isArray(contexts) || !contexts.every(isAcademicContext)) {
    throw new AuthServiceClientError(
      502,
      'auth-service returned invalid academic contexts',
    );
  }

  return contexts;
}

async function fetchAuthService(
  url: string,
  init: RequestInit,
  externalSignal?: AbortSignal,
): Promise<Response> {
  const timeoutController = new AbortController();
  const timeout = setTimeout(
    () => timeoutController.abort(),
    DEFAULT_AUTH_SERVICE_TIMEOUT_MS,
  );
  const signal = externalSignal
    ? AbortSignal.any([externalSignal, timeoutController.signal])
    : timeoutController.signal;

  try {
    return await fetch(url, { ...init, signal });
  } catch (error) {
    if (timeoutController.signal.aborted && !externalSignal?.aborted) {
      throw new AuthServiceClientError(504, 'auth-service request timed out');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function readJson(
  response: Response,
  errorMessage: string,
): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    throw new AuthServiceClientError(502, errorMessage);
  }
}

export function isAcademicContextAssignmentRequest(
  value: unknown,
): value is ReplaceUserAcademicContextsRequest {
  if (!isRecord(value) || !Array.isArray(value.contexts)) {
    return false;
  }

  return value.contexts.every(
    (context) =>
      isRecord(context) &&
      isNullablePositiveInteger(context.facultyId) &&
      isNullableCareerId(context.careerId),
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isNullablePositiveInteger(value: unknown): value is number | null {
  return (
    value === null ||
    (typeof value === 'number' && Number.isInteger(value) && value > 0)
  );
}

function isNullableCareerId(value: unknown): value is string | null {
  return (
    value === null ||
    (typeof value === 'string' && value.length === 3 && value.trim() === value)
  );
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}
