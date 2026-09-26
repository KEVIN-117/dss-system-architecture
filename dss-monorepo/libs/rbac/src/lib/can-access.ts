import type { DSSRole } from '@dss-monorepo/auth-models';

import {
  hasPermission,
  hasRequiredPermissions,
  type DSSPermission,
} from './permission-map';
import {
  hasRequiredRoles,
  hasRole,
  type RoleMatch,
} from './permissions';

interface CanCheckBase {
  match?: RoleMatch;
  not?: boolean;
}

interface CanRoleCheck extends CanCheckBase {
  role: DSSRole;
  roles?: never;
  permission?: never;
  permissions?: never;
}

interface CanRolesCheck extends CanCheckBase {
  roles: readonly DSSRole[];
  role?: never;
  permission?: never;
  permissions?: never;
}

interface CanPermissionCheck extends CanCheckBase {
  permission: DSSPermission;
  role?: never;
  roles?: never;
  permissions?: never;
}

interface CanPermissionsCheck extends CanCheckBase {
  permissions: readonly DSSPermission[];
  role?: never;
  roles?: never;
  permission?: never;
}

export type CanCheck =
  | CanRoleCheck
  | CanRolesCheck
  | CanPermissionCheck
  | CanPermissionsCheck;

/**
 * Evaluates the shared Can contract. Positive role checks honor hierarchy;
 * negative role checks intentionally use exact membership.
 */
export function canAccess(
  userRoles: readonly DSSRole[],
  check: CanCheck,
): boolean {
  const match = check.match ?? 'any';
  const negative = check.not ?? false;

  if (check.role !== undefined) {
    const allowed = negative
      ? !userRoles.includes(check.role)
      : hasRole(userRoles, check.role);
    return allowed;
  }

  if (check.roles !== undefined) {
    if (check.roles.length === 0) {
      return false;
    }
    const allowed = negative
      ? !hasExactRequiredRoles(userRoles, check.roles, match)
      : hasRequiredRoles(userRoles, check.roles, match);
    return allowed;
  }

  if (check.permission !== undefined) {
    const allowed = hasPermission(userRoles, check.permission);
    return negative ? !allowed : allowed;
  }

  if (check.permissions === undefined || check.permissions.length === 0) {
    return false;
  }
  const allowed = hasRequiredPermissions(userRoles, check.permissions, match);
  return negative ? !allowed : allowed;
}

function hasExactRequiredRoles(
  userRoles: readonly DSSRole[],
  required: readonly DSSRole[],
  match: RoleMatch,
): boolean {
  return match === 'all'
    ? required.every((role) => userRoles.includes(role))
    : required.some((role) => userRoles.includes(role));
}
