import type { DSSRole } from '@dss-monorepo/auth-models';

import {
  hasPermission,
  hasRequiredPermissions,
  type DSSPermission,
  type PermissionSet,
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

/** What the authenticated user holds: portal roles and token permissions (IAM-014). */
export interface CanSubject {
  roles: readonly DSSRole[];
  permissions: PermissionSet;
}

/**
 * Evaluates the shared Can contract. Role checks are for portal personas: positive
 * ones honor the portal hierarchy, negative ones use exact membership. Permission
 * checks read the permissions of the token, never a role-to-permission map.
 */
export function canAccess(
  subject: CanSubject,
  check: CanCheck,
): boolean {
  const userRoles = subject.roles;
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
    const allowed = hasPermission(subject.permissions, check.permission);
    return negative ? !allowed : allowed;
  }

  if (check.permissions === undefined || check.permissions.length === 0) {
    return false;
  }
  const allowed = hasRequiredPermissions(subject.permissions, check.permissions, match);
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
