import type { DSSRole } from '../roles/dss-role.js';

/** Contexto académico devuelto por auth-service. */
export interface AcademicContext {
  id: string;
  userId: string;
  facultyId: number | null;
  careerId: number | null;
}

/**
 * Perfil local validado por auth-service. Los roles provienen del access token
 * firmado y sólo sirven para adaptar la interfaz; el backend aplica la
 * autorización real.
 */
/** Exact response contract of auth-service GET /api/v1/auth/me. */
export interface AuthUserProfile {
  id: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  isActive: boolean;
  academicContexts: AcademicContext[];
}

/** Profile enriched by a verified Keycloak token for BFF and UI use. */
export interface AuthUser extends AuthUserProfile {
  roles: DSSRole[];
}

export function isAuthUserProfile(value: unknown): value is AuthUserProfile {
  return isRecord(value) &&
    isUuid(value.id) &&
    isString(value.username) &&
    isString(value.email) &&
    isString(value.firstName) &&
    isString(value.lastName) &&
    typeof value.isActive === 'boolean' &&
    Array.isArray(value.academicContexts) &&
    value.academicContexts.every(isAcademicContext);
}

function isAcademicContext(value: unknown): value is AcademicContext {
  return isRecord(value) &&
    isUuid(value.id) &&
    isUuid(value.userId) &&
    isNullablePositiveInteger(value.facultyId) &&
    isNullablePositiveInteger(value.careerId);
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
