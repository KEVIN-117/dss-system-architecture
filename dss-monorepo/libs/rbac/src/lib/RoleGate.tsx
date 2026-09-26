'use client';

import type { ReactNode } from 'react';

import type { DSSRole } from '@dss-monorepo/auth-models';

import { Can } from './Can';
import type { RoleMatch } from './permissions';

export interface RoleGateProps {
  /** At least one role required to render the protected content. */
  roles: readonly DSSRole[];
  children: ReactNode;
  fallback?: ReactNode;
  loadingFallback?: ReactNode;
  match?: RoleMatch;
}

/**
 * @deprecated Use <Can role="…" /> or <Can roles={[…]} />. It remains as a
 * compatibility adapter for existing callers.
 */
export function RoleGate({
  roles,
  children,
  fallback = null,
  loadingFallback = null,
  match = 'any',
}: RoleGateProps) {
  return (
    <Can
      roles={roles}
      match={match}
      fallback={fallback}
      loadingFallback={loadingFallback}
    >
      {children}
    </Can>
  );
}
