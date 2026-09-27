'use client';

import type { ReactNode } from 'react';

import type { DSSRole } from '@dss-monorepo/auth-models';

import { Can } from './Can';
import type { RoleMatch } from './permissions';

export interface RoleGuardProps {
  /** Roles that may render the protected content. */
  rolesAllowed: readonly DSSRole[];
  children: ReactNode;
  fallback?: ReactNode;
  loadingFallback?: ReactNode;
  match?: RoleMatch;
}

/**
 * Compatibility API for the original RBAC contract. New code should use
 * <Can role="…" /> or <Can roles={[…]} /> directly.
 */
export function RoleGuard({
  rolesAllowed,
  children,
  fallback = null,
  loadingFallback = null,
  match = 'any',
}: RoleGuardProps) {
  return (
    <Can
      roles={rolesAllowed}
      match={match}
      fallback={fallback}
      loadingFallback={loadingFallback}
    >
      {children}
    </Can>
  );
}
