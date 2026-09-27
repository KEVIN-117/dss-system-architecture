'use client';

import { useMemo } from 'react';

import { useAuth } from '@dss-monorepo/auth';
import type { DSSRole } from '@dss-monorepo/auth-models';

import { canAccess, type CanCheck } from './can-access';
import { resolvePermissions, type DSSPermission } from './permission-map';
import type { RoleMatch } from './permissions';

/** Returns false while authentication is unavailable or still loading. */
export function useCan(check: CanCheck): boolean {
  const { user, isAuthenticated, isLoading } = useAuth();

  return useMemo(
    () => !isLoading && isAuthenticated && user !== null && canAccess(user.roles, check),
    [check, isAuthenticated, isLoading, user],
  );
}

/** Returns a memoized, read-only view of the authenticated user's permissions. */
export function useMyPermissions(): ReadonlySet<DSSPermission> {
  const { user } = useAuth();

  return useMemo(() => resolvePermissions(user?.roles ?? []), [user]);
}

/** Checks one role or a set of roles through the shared role hierarchy. */
export function useHasRole(
  required: DSSRole | readonly DSSRole[],
  match: RoleMatch = 'any',
): boolean {
  const check = useMemo<CanCheck>(
    () => typeof required === 'string'
      ? { role: required, match }
      : { roles: required, match },
    [match, required],
  );

  return useCan(check);
}

/** Checks one permission or a set of effective DSS permissions. */
export function useHasPermission(
  required: DSSPermission | readonly DSSPermission[],
  match: RoleMatch = 'any',
): boolean {
  const check = useMemo<CanCheck>(
    () => typeof required === 'string'
      ? { permission: required, match }
      : { permissions: required, match },
    [match, required],
  );

  return useCan(check);
}
