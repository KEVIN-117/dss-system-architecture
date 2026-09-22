import type { DSSRole } from '@dss-monorepo/auth-models';

/** Determines whether every required role or any one of them is needed. */
export type RoleMatch = 'all' | 'any';

/**
 * Presentation hierarchy aligned with the Keycloak realm composites.
 * SUPERADMIN is intentionally isolated from academic dashboards: it is a
 * technical administration role, not an academic authority.
 */
export const ROLE_HIERARCHY: Record<DSSRole, readonly DSSRole[]> = {
  SUPERADMIN: ['SUPERADMIN'],
  RECTOR: ['RECTOR', 'DECANO', 'DIRECTOR'],
  DECANO: ['DECANO', 'DIRECTOR'],
  DIRECTOR: ['DIRECTOR'],
};

/** Only for display ordering; authorization always uses the hierarchy above. */
export const ROLE_WEIGHT: Record<DSSRole, number> = {
  SUPERADMIN: 4,
  RECTOR: 3,
  DECANO: 2,
  DIRECTOR: 1,
};

export function hasRole(
  userRoles: readonly DSSRole[],
  required: DSSRole,
): boolean {
  return userRoles.some((role) => ROLE_HIERARCHY[role].includes(required));
}

/** Fails closed when no required role was supplied. */
export function hasAnyRole(
  userRoles: readonly DSSRole[],
  required: readonly DSSRole[],
): boolean {
  return required.length > 0 && required.some((role) => hasRole(userRoles, role));
}

/** Fails closed when no required role was supplied. */
export function hasAllRoles(
  userRoles: readonly DSSRole[],
  required: readonly DSSRole[],
): boolean {
  return required.length > 0 && required.every((role) => hasRole(userRoles, role));
}

export function hasRequiredRoles(
  userRoles: readonly DSSRole[],
  required: readonly DSSRole[],
  match: RoleMatch = 'any',
): boolean {
  return match === 'all'
    ? hasAllRoles(userRoles, required)
    : hasAnyRole(userRoles, required);
}

export function getHighestRole(roles: readonly DSSRole[]): DSSRole | null {
  return roles.reduce<DSSRole | null>((highest, role) => {
    if (highest === null || ROLE_WEIGHT[role] > ROLE_WEIGHT[highest]) {
      return role;
    }
    return highest;
  }, null);
}
