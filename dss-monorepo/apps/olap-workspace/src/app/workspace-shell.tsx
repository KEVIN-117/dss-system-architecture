'use client';

import type { ReactNode } from 'react';
import { AppWindow, Database, LayoutDashboard, Search } from 'lucide-react';
import { ProtectedRoute, useAuth } from '@dss-monorepo/auth';
import { Button, DashboardTemplate } from '@dss-monorepo/design-system';

export function WorkspaceShell({ children }: { children: ReactNode }) {
  const { user, logout, login } = useAuth();

  return (
    <ProtectedRoute unauthenticatedFallback={<LoginRequired onLogin={login} />}>
      <DashboardTemplate
        sidebarTitle="OLAP WORKSPACE"
        navItems={[
          {
            title: 'Inicio',
            href: '/',
            icon: <LayoutDashboard aria-hidden="true" className="size-4" />,
          },
          {
            title: 'Dashboards',
            href: '/dashboards',
            icon: <Database aria-hidden="true" className="size-4" />,
          },
          {
            title: 'Análisis OLAP',
            href: '/analysis',
            icon: <Search aria-hidden="true" className="size-4" />,
          },
          {
            title: 'Apps',
            href: '/apps',
            icon: <AppWindow aria-hidden="true" className="size-4" />,
          },
        ]}
        user={
          user
            ? {
                name: `${user.firstName} ${user.lastName}`.trim(),
                email: user.email,
              }
            : undefined
        }
        onDisconnect={logout}
      >
        {children}
      </DashboardTemplate>
    </ProtectedRoute>
  );
}

function LoginRequired({ onLogin }: { onLogin: () => void }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
      <Database aria-hidden="true" className="size-8 text-primary" />
      <h1 className="text-2xl font-semibold">Inicia sesión para continuar</h1>
      <p className="max-w-md text-sm text-muted-foreground">
        El OLAP Workspace usa la sesión segura del BFF para cargar tus cubos,
        dashboards y aplicaciones.
      </p>
      <Button onClick={onLogin}>Iniciar sesión</Button>
    </main>
  );
}
