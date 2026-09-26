import type { DSSRole } from '@dss-monorepo/auth-models';

import type { RoleMatch } from './permissions';

export const DSS_PERMISSIONS = [
  'analytics:read',
  'analytics:global',
  'analytics:faculty',
  'analytics:career',
  'connectors:read',
  'connectors:write',
  'pipelines:read',
  'pipelines:execute',
  'users:read',
  'users:write',
] as const;

export type DSSPermission = (typeof DSS_PERMISSIONS)[number];

const DIRECTOR_PERMISSIONS = [
  'analytics:read',
  'analytics:career',
] as const satisfies readonly DSSPermission[];

const DECANO_PERMISSIONS = [
  ...DIRECTOR_PERMISSIONS,
  'analytics:faculty',
  'pipelines:read',
] as const satisfies readonly DSSPermission[];

const RECTOR_PERMISSIONS = [
  ...DECANO_PERMISSIONS,
  'analytics:global',
  'connectors:read',
] as const satisfies readonly DSSPermission[];

const SUPERADMIN_PERMISSIONS = [
  'connectors:read',
  'connectors:write',
  'pipelines:read',
  'pipelines:execute',
  'users:read',
  'users:write',
] as const satisfies readonly DSSPermission[];

/**
 * Effective presentation and API permissions for each DSS role. SUPERADMIN is
 * intentionally technical: it does not receive academic analytics access.
 */
export const ROLE_PERMISSIONS: Record<DSSRole, readonly DSSPermission[]> = {
  DIRECTOR: DIRECTOR_PERMISSIONS,
  DECANO: DECANO_PERMISSIONS,
  RECTOR: RECTOR_PERMISSIONS,
  SUPERADMIN: SUPERADMIN_PERMISSIONS,
};

export function resolvePermissions(roles: readonly DSSRole[]): ReadonlySet<DSSPermission> {
  return new Set(roles.flatMap((role) => ROLE_PERMISSIONS[role]));
}

export function hasPermission(
  roles: readonly DSSRole[],
  permission: DSSPermission,
): boolean {
  return resolvePermissions(roles).has(permission);
}

export function hasAnyPermissions(
  roles: readonly DSSRole[],
  required: readonly DSSPermission[],
): boolean {
  if (required.length === 0) {
    return false;
  }
  const permissions = resolvePermissions(roles);
  return required.some((permission) => permissions.has(permission));
}

export function hasAllPermissions(
  roles: readonly DSSRole[],
  required: readonly DSSPermission[],
): boolean {
  if (required.length === 0) {
    return false;
  }
  const permissions = resolvePermissions(roles);
  return required.every((permission) => permissions.has(permission));
}

export function hasRequiredPermissions(
  roles: readonly DSSRole[],
  required: readonly DSSPermission[],
  match: RoleMatch = 'any',
): boolean {
  return match === 'all'
    ? hasAllPermissions(roles, required)
    : hasAnyPermissions(roles, required);
}
