'use client';

import type { ReactNode } from 'react';

import type { DSSRole } from '@dss-monorepo/auth-models';
import { useAuth } from './AuthProvider';

export interface ProtectedRouteProps {
  children: ReactNode;
  /**
   * @deprecated Protect roles with <RoleGuard> or <Can> from
   * @dss-monorepo/rbac. This prop remains temporarily for compatibility.
   */
  requiredRoles?: DSSRole[];
  loadingFallback?: ReactNode;
  /** Rendered only when there is no valid authenticated session. */
  unauthenticatedFallback?: ReactNode;
  /** Rendered when deprecated requiredRoles rejects an authenticated user. */
  forbiddenFallback?: ReactNode;
  /** @deprecated Renamed to unauthenticatedFallback. */
  unauthorizedFallback?: ReactNode;
}

export function ProtectedRoute({
  children,
  requiredRoles,
  loadingFallback = <DefaultLoading />,
  unauthenticatedFallback,
  forbiddenFallback = <DefaultForbidden />,
  unauthorizedFallback,
}: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, user } = useAuth();
  const unauthenticated = unauthenticatedFallback ?? unauthorizedFallback ?? <DefaultUnauthenticated />;

  if (isLoading) return loadingFallback;
  if (!isAuthenticated || !user) return unauthenticated;

  if (requiredRoles?.length) {
    const hasRole = user.roles.some((r) => requiredRoles.includes(r));
    if (!hasRole) return forbiddenFallback;
  }

  return children;
}

function DefaultLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="animate-pulse text-lg">Verificando sesión...</div>
    </div>
  );
}

function DefaultUnauthenticated() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4">
      <h1 className="text-2xl font-bold">Sesión requerida</h1>
      <p className="text-muted-foreground">
        Inicia sesión para acceder a esta sección.
      </p>
    </div>
  );
}

function DefaultForbidden() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4">
      <h1 className="text-2xl font-bold">Acceso no autorizado</h1>
      <p className="text-muted-foreground">
        Tu cuenta no tiene los permisos necesarios para acceder a esta sección.
      </p>
    </div>
  );
}
