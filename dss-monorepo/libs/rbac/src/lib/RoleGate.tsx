'use client';

import type { ReactNode } from 'react';

import { useAuth } from '@dss-monorepo/auth';
import type { DSSRole } from '@dss-monorepo/auth-models';

import { hasRequiredRoles, type RoleMatch } from './permissions';

export interface RoleGateProps {
  /** At least one role required to render the protected content. */
  roles: readonly DSSRole[];
  children: ReactNode;
  fallback?: ReactNode;
  loadingFallback?: ReactNode;
  match?: RoleMatch;
}

/**
 * Client-side presentation gate. APIs must enforce the same authorization on
 * the server; hiding a React subtree is never an authorization boundary.
 */
export function RoleGate({
  roles,
  children,
  fallback = null,
  loadingFallback = null,
  match = 'any',
}: RoleGateProps) {
  const { user, isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return loadingFallback;
  }
  if (
    !isAuthenticated ||
    !user ||
    !hasRequiredRoles(user.roles, roles, match)
  ) {
    return fallback;
  }
  return children;
}
