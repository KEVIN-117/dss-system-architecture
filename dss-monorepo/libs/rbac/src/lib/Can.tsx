'use client';

import type { ReactNode } from 'react';

import { useAuth } from '@dss-monorepo/auth';

import { canAccess, type CanCheck } from './can-access';

type CanChildren = ReactNode | ((allowed: boolean) => ReactNode);

export type CanProps = CanCheck & {
  children: CanChildren;
  fallback?: ReactNode;
  loadingFallback?: ReactNode;
};

/**
 * Client-side presentation gate for DSS roles and permissions. APIs must
 * authorize independently through the BFF; this component never grants data
 * access by itself.
 */
export function Can({
  children,
  fallback = null,
  loadingFallback = null,
  ...check
}: CanProps): ReactNode {
  const { user, permissions, isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return loadingFallback;
  }
  if (!isAuthenticated || !user) {
    return fallback;
  }

  const allowed = canAccess({ roles: user.roles, permissions }, check);
  if (typeof children === 'function') {
    return children(allowed);
  }
  return allowed ? children : fallback;
}
