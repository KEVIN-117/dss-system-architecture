'use client';

import type { ReactNode } from 'react';

import type { DSSRole } from '@dss-monorepo/auth-models';
import { useAuth } from './AuthProvider';

export interface ProtectedRouteProps {
  children: ReactNode;
  requiredRoles?: DSSRole[];
  loadingFallback?: ReactNode;
  unauthorizedFallback?: ReactNode;
}

export function ProtectedRoute({
  children,
  requiredRoles,
  loadingFallback = <DefaultLoading />,
  unauthorizedFallback = <DefaultUnauthorized />,
}: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, user } = useAuth();

  if (isLoading) return loadingFallback;
  if (!isAuthenticated || !user) return unauthorizedFallback;

  if (requiredRoles?.length) {
    const hasRole = user.roles.some((r) => requiredRoles.includes(r));
    if (!hasRole) return unauthorizedFallback;
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

function DefaultUnauthorized() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4">
      <h1 className="text-2xl font-bold">Acceso Denegado</h1>
      <p className="text-muted-foreground">
        No tienes los permisos necesarios para acceder a esta sección.
      </p>
    </div>
  );
}
