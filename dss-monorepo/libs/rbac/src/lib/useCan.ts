'use client';

import { useMemo } from 'react';

import { useAuth } from '@dss-monorepo/auth';

import { canAccess, type CanCheck } from './can-access';
import { resolvePermissions, type DSSPermission } from './permission-map';

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
