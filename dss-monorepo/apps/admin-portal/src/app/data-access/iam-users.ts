/**
 * User administration through the BFF IAM routes (`/api/admin/iam/**`, IAM-015). The browser only ever
 * sends its session cookie; the BFF forwards the user's own token to auth-service.
 */

export type IamRequiredAction = 'UPDATE_PASSWORD' | 'VERIFY_EMAIL' | 'UPDATE_PROFILE' | 'CONFIGURE_TOTP';

export interface IamUser {
  id: string;
  username: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  enabled: boolean;
  emailVerified: boolean;
  createdAt: string | null;
  /** Only on creation: `false` when the invitation e-mail could not be sent. */
  invitationSent: boolean | null;
}

export interface IamNamedRole {
  name: string;
  description: string | null;
}

export interface IamAssignments {
  direct: IamNamedRole[];
  effective: IamNamedRole[];
}

export interface IamRole {
  name: string;
  description: string | null;
  portal: string | null;
  system: boolean;
}

export interface IamPermission {
  name: string;
  description: string | null;
  resource: string;
  action: string;
  system: boolean;
}

export interface CreateIamUser {
  username: string;
  email: string;
  firstName?: string;
  lastName?: string;
  sendInvitation: boolean;
}

/** A rejected or failed IAM call, with the message auth-service gave when there is one. */
export class IamRequestError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string | null = null,
  ) {
    super(message);
    this.name = 'IamRequestError';
  }
}

const BFF_BASE_URL = process.env.NEXT_PUBLIC_BFF_URL?.trim().replace(/\/$/, '') ?? '';

/** One call to `/api/admin/iam/<path>`; failures become an {@link IamRequestError} with the domain message. */
export async function iamRequest<T>(
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  path: string,
  fallback: string,
  body?: unknown,
  signal?: AbortSignal,
): Promise<T> {
  const response = await fetch(`${BFF_BASE_URL}/api/admin/iam/${path}`, {
    method,
    credentials: 'include',
    cache: 'no-store',
    headers: body === undefined
      ? { Accept: 'application/json' }
      : { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal,
  });
  if (!response.ok) throw await iamError(response, fallback);
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

async function iamError(response: Response, fallback: string): Promise<IamRequestError> {
  let message = `${fallback} (${response.status}).`;
  let code: string | null = null;
  try {
    const body: unknown = await response.json();
    if (typeof body === 'object' && body !== null) {
      const record = body as Record<string, unknown>;
      if (typeof record.code === 'string') code = record.code;
      if (typeof record.detail === 'string' && record.detail.trim()) message = record.detail;
      else if (response.status === 403) message = 'Tu cuenta no tiene permiso para esta operación.';
    }
  } catch {
    // Keep the local message when the BFF does not answer JSON.
  }
  return new IamRequestError(message, response.status, code);
}

const user = (id: string) => `users/${encodeURIComponent(id)}`;

export function createIamUser(request: CreateIamUser, signal?: AbortSignal): Promise<IamUser> {
  return iamRequest('POST', 'users', 'No se pudo crear el usuario', {
    username: request.username.trim(),
    email: request.email.trim(),
    ...(request.firstName?.trim() ? { firstName: request.firstName.trim() } : {}),
    ...(request.lastName?.trim() ? { lastName: request.lastName.trim() } : {}),
    sendInvitation: request.sendInvitation,
  }, signal);
}

export function setIamUserEnabled(userId: string, enabled: boolean, signal?: AbortSignal): Promise<IamUser> {
  return iamRequest('PATCH', user(userId), enabled ? 'No se pudo activar el usuario' : 'No se pudo desactivar el usuario',
    { enabled }, signal);
}

export function sendIamActionsEmail(
  userId: string,
  actions: IamRequiredAction[],
  signal?: AbortSignal,
): Promise<void> {
  return iamRequest('POST', `${user(userId)}/actions-email`, 'No se pudo enviar el correo', { actions }, signal);
}

export function getIamUserRoles(userId: string, signal?: AbortSignal): Promise<IamAssignments> {
  return iamRequest('GET', `${user(userId)}/roles`, 'No se pudieron cargar los roles', undefined, signal);
}

export function replaceIamUserRoles(userId: string, roles: string[], signal?: AbortSignal): Promise<IamAssignments> {
  return iamRequest('PUT', `${user(userId)}/roles`, 'No se pudieron guardar los roles', { roles }, signal);
}

export function getIamUserPermissions(userId: string, signal?: AbortSignal): Promise<IamAssignments> {
  return iamRequest('GET', `${user(userId)}/permissions`, 'No se pudieron cargar los permisos', undefined, signal);
}

export function replaceIamUserPermissions(
  userId: string,
  permissions: string[],
  signal?: AbortSignal,
): Promise<IamAssignments> {
  return iamRequest('PUT', `${user(userId)}/permissions`, 'No se pudieron guardar los permisos', { permissions }, signal);
}

export function listIamRoles(signal?: AbortSignal): Promise<IamRole[]> {
  return iamRequest('GET', 'roles', 'No se pudo cargar el catálogo de roles', undefined, signal);
}

export function listIamPermissions(signal?: AbortSignal): Promise<IamPermission[]> {
  return iamRequest('GET', 'permissions', 'No se pudo cargar el catálogo de permisos', undefined, signal);
}
