'use client';

import { useCallback, useMemo } from 'react';

import { useAuth } from '@dss-monorepo/auth';
import type { DSSRole } from '@dss-monorepo/auth-models';

import {
  getHighestRole,
  hasAllRoles,
  hasAnyRole,
  hasRequiredRoles,
  hasRole,
  type RoleMatch,
} from './permissions';

/**
 * Returns role checks for presentation. An omitted or empty requirement does
 * not grant access, preventing an accidental unprotected UI path.
 */
export function usePermission(
  requiredRoles?: readonly DSSRole[],
  match: RoleMatch = 'any',
) {
  const { user, isAuthenticated, isLoading } = useAuth();
  const userRoles = useMemo(() => user?.roles ?? [], [user]);

  const checkRole = useCallback(
    (role: DSSRole) => hasRole(userRoles, role),
    [userRoles],
  );
  const checkAnyRole = useCallback(
    (roles: readonly DSSRole[]) => hasAnyRole(userRoles, roles),
    [userRoles],
  );
  const checkAllRoles = useCallback(
    (roles: readonly DSSRole[]) => hasAllRoles(userRoles, roles),
    [userRoles],
  );

  return useMemo(
    () => ({
      isLoading,
      isAuthenticated,
      userRoles,
      highestRole: getHighestRole(userRoles),
      hasAccess:
        isAuthenticated &&
        hasRequiredRoles(userRoles, requiredRoles ?? [], match),
      checkRole,
      checkAnyRole,
      checkAllRoles,
    }),
    [
      checkAllRoles,
      checkAnyRole,
      checkRole,
      isAuthenticated,
      isLoading,
      match,
      requiredRoles,
      userRoles,
    ],
  );
}
