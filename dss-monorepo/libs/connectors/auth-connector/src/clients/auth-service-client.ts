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

export interface AdminUserDirectoryEntry {
  id: string;
  username: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  isActive: boolean;
  roles: string[];
  academicContexts: AcademicContext[];
}

export interface AdminUserDirectoryPage {
  content: AdminUserDirectoryEntry[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

export interface AdminUserDirectoryQuery {
  q?: string;
  active?: boolean;
  role?: string;
  facultyId?: number;
  careerId?: string;
  page?: number;
  size?: number;
}

export interface AcademicFacultyOption {
  id: number;
  name: string;
}

export interface AcademicCareerOption {
  id: string;
  name: string;
  facultyId: number;
}

export interface AcademicCatalog {
  faculties: AcademicFacultyOption[];
  careers: AcademicCareerOption[];
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

/** Lists users from the superadmin-only Auth Service directory. */
export async function listAdminUsers(
  authServiceUrl: string,
  bearerToken: string,
  query: AdminUserDirectoryQuery = {},
  signal?: AbortSignal,
): Promise<AdminUserDirectoryPage> {
  if (!isAdminUserDirectoryQuery(query)) {
    throw new AuthServiceClientError(400, 'Invalid user directory query');
  }

  const search = new URLSearchParams();
  if (query.q?.trim()) search.set('q', query.q.trim());
  if (query.active !== undefined) search.set('active', String(query.active));
  if (query.role?.trim()) search.set('role', query.role.trim());
  if (query.facultyId !== undefined) search.set('facultyId', String(query.facultyId));
  if (query.careerId?.trim()) search.set('careerId', query.careerId.trim());
  if (query.page !== undefined) search.set('page', String(query.page));
  if (query.size !== undefined) search.set('size', String(query.size));

  const suffix = search.size ? `?${search.toString()}` : '';
  const response = await fetchAuthService(
    `${authServiceUrl.replace(/\/$/, '')}/api/v1/admin/users${suffix}`,
    {
      method: 'GET',
      headers: { Accept: 'application/json', Authorization: `Bearer ${bearerToken}` },
    },
    signal,
  );
  if (!response.ok) throw new AuthServiceClientError(response.status, 'Unable to list users');

  const payload: unknown = await readJson(response, 'auth-service returned an invalid user directory');
  if (!isAdminUserDirectoryPage(payload)) {
    throw new AuthServiceClientError(502, 'auth-service returned an invalid user directory');
  }

  // Rebuild the response from the allowed contract so unexpected upstream fields
  // such as provider credentials can never flow through the BFF.
  return {
    content: payload.content.map((user) => ({
      id: user.id,
      username: user.username,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      isActive: user.isActive,
      roles: [...user.roles],
      academicContexts: user.academicContexts.map((context) => ({ ...context })),
    })),
    page: payload.page,
    size: payload.size,
    totalElements: payload.totalElements,
    totalPages: payload.totalPages,
  };
}

/** Loads active faculties and careers from auth-service's academic catalog. */
export async function getAcademicCatalog(
  authServiceUrl: string,
  bearerToken: string,
  signal?: AbortSignal,
): Promise<AcademicCatalog> {
  const response = await fetchAuthService(
    `${authServiceUrl.replace(/\/$/, '')}/api/v1/admin/academic-catalog`,
    {
      method: 'GET',
      headers: { Accept: 'application/json', Authorization: `Bearer ${bearerToken}` },
    },
    signal,
  );
  if (!response.ok) {
    throw new AuthServiceClientError(response.status, 'Unable to load academic catalog');
  }

  const payload: unknown = await readJson(
    response,
    'auth-service returned an invalid academic catalog',
  );
  if (!isAcademicCatalog(payload)) {
    throw new AuthServiceClientError(502, 'auth-service returned an invalid academic catalog');
  }
  return {
    faculties: payload.faculties.map(({ id, name }) => ({ id, name })),
    careers: payload.careers.map(({ id, name, facultyId }) => ({ id, name, facultyId })),
  };
}

/** Loads a safe directory detail by the local Auth Service UUID. */
export async function getAdminUser(
  authServiceUrl: string,
  bearerToken: string,
  userId: string,
  signal?: AbortSignal,
): Promise<AdminUserDirectoryEntry> {
  if (!isUuid(userId)) throw new AuthServiceClientError(400, 'Invalid local user ID');
  const response = await fetchAuthService(
    `${authServiceUrl.replace(/\/$/, '')}/api/v1/admin/users/${encodeURIComponent(userId)}`,
    {
      method: 'GET',
      headers: { Accept: 'application/json', Authorization: `Bearer ${bearerToken}` },
    },
    signal,
  );
  if (!response.ok) throw new AuthServiceClientError(response.status, 'Unable to load user details');

  const payload: unknown = await readJson(response, 'auth-service returned an invalid user detail');
  if (!isAdminUserDirectoryEntry(payload)) {
    throw new AuthServiceClientError(502, 'auth-service returned an invalid user detail');
  }
  return {
    id: payload.id,
    username: payload.username,
    email: payload.email,
    firstName: payload.firstName,
    lastName: payload.lastName,
    isActive: payload.isActive,
    roles: [...payload.roles],
    academicContexts: payload.academicContexts.map((context) => ({ ...context })),
  };
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
    if (externalSignal?.aborted) {
      throw error;
    }
    throw new AuthServiceClientError(503, 'auth-service is unavailable');
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
      isNullableNonNegativeInteger(context.facultyId) &&
      isNullableCareerId(context.careerId),
  );
}

function isAdminUserDirectoryEntry(value: unknown): value is AdminUserDirectoryEntry {
  return isRecord(value) &&
    isUuid(value.id) &&
    isString(value.username) &&
    isString(value.email) &&
    (value.firstName === null || isString(value.firstName)) &&
    (value.lastName === null || isString(value.lastName)) &&
    typeof value.isActive === 'boolean' &&
    Array.isArray(value.roles) && value.roles.every(isString) &&
    Array.isArray(value.academicContexts) && value.academicContexts.every(isAcademicContext);
}

function isAdminUserDirectoryPage(value: unknown): value is AdminUserDirectoryPage {
  return isRecord(value) &&
    Array.isArray(value.content) && value.content.every(isAdminUserDirectoryEntry) &&
    isNonNegativeInteger(value.page) &&
    isPositiveInteger(value.size) &&
    isNonNegativeInteger(value.totalElements) &&
    isNonNegativeInteger(value.totalPages);
}

function isAcademicCatalog(value: unknown): value is AcademicCatalog {
  return isRecord(value) &&
    Array.isArray(value.faculties) && value.faculties.every((faculty) =>
      isRecord(faculty) && isNonNegativeInteger(faculty.id) && isString(faculty.name)) &&
    Array.isArray(value.careers) && value.careers.every((career) =>
      isRecord(career) && isCareerId(career.id) && isString(career.name) && isNonNegativeInteger(career.facultyId));
}

function isCareerId(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9]{3}$/.test(value);
}

function isAdminUserDirectoryQuery(value: AdminUserDirectoryQuery): boolean {
  return (value.q === undefined || (isString(value.q) && value.q.length <= 120)) &&
    (value.active === undefined || typeof value.active === 'boolean') &&
    (value.role === undefined || (isString(value.role) && value.role.length <= 50)) &&
    (value.facultyId === undefined || (Number.isInteger(value.facultyId) && value.facultyId >= 0)) &&
    (value.careerId === undefined || (isString(value.careerId) && /^[A-Za-z0-9]{3}$/.test(value.careerId))) &&
    (value.page === undefined || isNonNegativeInteger(value.page)) &&
    (value.size === undefined || (Number.isInteger(value.size) && value.size > 0 && value.size <= 100));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isNullableNonNegativeInteger(value: unknown): value is number | null {
  return (
    value === null ||
    (typeof value === 'number' && Number.isInteger(value) && value >= 0)
  );
}

function isNullableCareerId(value: unknown): value is string | null {
  return (
    value === null ||
    (typeof value === 'string' && value.length === 3 && value.trim() === value)
  );
}

function isUuid(value: unknown): value is string {
  return (
    isString(value) &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  );
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}
