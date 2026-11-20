/**
 * Roles, permissions and the role × permission matrix through the BFF IAM routes (IAM-015/IAM-017).
 * Permissions are client roles of `dss-permissions` named `resource:action`; realm roles group them.
 */
import { iamRequest, type IamPermission, type IamRole } from './iam-users';

export type { IamPermission, IamRole } from './iam-users';

export interface IamPermissionMatrix {
  roles: IamRole[];
  permissions: IamPermission[];
  /** Role name → permission names it groups. */
  grants: Record<string, string[]>;
}

export interface IamRoleDraft {
  name: string;
  description?: string;
  portal?: string;
}

/** Same rules as auth-service (and the BFF validators). */
export const ROLE_NAME_PATTERN = /^[A-Z][A-Z0-9_]{1,49}$/;
export const PORTAL_PATTERN = /^[a-z][a-z0-9-]{0,49}$/;
export const PERMISSION_NAME_PATTERN = /^[a-z][a-z0-9-]*(:[a-z][a-z0-9-]*)+$/;

const role = (name: string) => `roles/${encodeURIComponent(name)}`;
const permission = (name: string) => `permissions/${encodeURIComponent(name)}`;

export function listRoles(signal?: AbortSignal): Promise<IamRole[]> {
  return iamRequest('GET', 'roles', 'No se pudieron cargar los roles', undefined, signal);
}

export function createRole(draft: IamRoleDraft): Promise<IamRole> {
  return iamRequest('POST', 'roles', 'No se pudo crear el rol', {
    name: draft.name.trim(),
    ...(draft.description?.trim() ? { description: draft.description.trim() } : {}),
    ...(draft.portal?.trim() ? { portal: draft.portal.trim() } : {}),
  });
}

/** An empty `portal` removes the portal attribute. */
export function updateRole(name: string, change: { description: string; portal: string }): Promise<IamRole> {
  return iamRequest('PATCH', role(name), 'No se pudo actualizar el rol', {
    description: change.description.trim(),
    portal: change.portal.trim(),
  });
}

/** Without `force`, auth-service refuses (409) to delete a role assigned to users. */
export function deleteRole(name: string, force = false): Promise<void> {
  return iamRequest('DELETE', `${role(name)}${force ? '?force=true' : ''}`, 'No se pudo eliminar el rol');
}

export function listPermissions(signal?: AbortSignal): Promise<IamPermission[]> {
  return iamRequest('GET', 'permissions', 'No se pudieron cargar los permisos', undefined, signal);
}

export function createPermission(name: string, description: string): Promise<IamPermission> {
  return iamRequest('POST', 'permissions', 'No se pudo crear el permiso', {
    name: name.trim(),
    description: description.trim(),
  });
}

export function updatePermission(name: string, description: string): Promise<IamPermission> {
  return iamRequest('PATCH', permission(name), 'No se pudo actualizar el permiso', { description: description.trim() });
}

/** Without `force`, auth-service refuses (409) to delete a permission a role groups or a user holds. */
export function deletePermission(name: string, force = false): Promise<void> {
  return iamRequest('DELETE', `${permission(name)}${force ? '?force=true' : ''}`, 'No se pudo eliminar el permiso');
}

export function getPermissionMatrix(signal?: AbortSignal): Promise<IamPermissionMatrix> {
  return iamRequest('GET', 'permissions/matrix', 'No se pudo cargar la matriz de permisos', undefined, signal);
}

/** Replaces the permissions a role groups; auth-service applies only the difference. */
export function replaceRolePermissions(name: string, permissions: string[]): Promise<IamPermission[]> {
  return iamRequest('PUT', `${role(name)}/permissions`, `No se pudieron guardar los permisos de ${name}`, {
    permissions: [...permissions].sort(),
  });
}

/** Permissions grouped by their resource (`dw:closure:read` → `dw:closure`), each group sorted. */
export function groupByResource(permissions: IamPermission[]): Array<{ resource: string; permissions: IamPermission[] }> {
  const groups = new Map<string, IamPermission[]>();
  for (const item of permissions) {
    const resource = item.resource || item.name.slice(0, item.name.lastIndexOf(':'));
    groups.set(resource, [...(groups.get(resource) ?? []), item]);
  }
  return [...groups.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([resource, items]) => ({
      resource,
      permissions: [...items].sort((left, right) => left.name.localeCompare(right.name)),
    }));
}
