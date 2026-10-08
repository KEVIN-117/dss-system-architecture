'use client';

import type { ReactNode } from 'react';
import { Database, LayoutDashboard, Users } from 'lucide-react';
import { ProtectedRoute, useAuth } from '@dss-monorepo/auth';
import { AccessDenied, DashboardTemplate } from '@dss-monorepo/design-system';
import { RoleGuard } from '@dss-monorepo/rbac';

export function AdminPortalLayout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  return (
    <ProtectedRoute unauthenticatedFallback={<LoginRequired />}>
      <RoleGuard
        rolesAllowed={['SUPERADMIN']}
        fallback={
          <AccessDenied
            portalName="de administración"
            logoutHref={`${process.env.NEXT_PUBLIC_BFF_URL}/api/auth/logout`}
          />
        }
      >
        <DashboardTemplate
          sidebarTitle="DSS ADMIN"
          navItems={[
            {
              title: 'System overview',
              href: '/',
              icon: <LayoutDashboard className="size-4" />,
            },
            {
              title: 'Users',
              href: '/users',
              icon: <Users className="size-4" />,
            },
            {
              title: 'Schemas',
              href: '/schemas',
              icon: <Database className="size-4" />,
            },
          ]}
          user={
            user
              ? {
                  name: `${user.firstName} ${user.lastName}`,
                  email: user.email,
                }
              : undefined
          }
          onDisconnect={logout}
        >
          {children}
        </DashboardTemplate>
      </RoleGuard>
    </ProtectedRoute>
  );
}

function LoginRequired() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="text-2xl font-bold">Sesión requerida</h1>
      <p className="text-muted-foreground">
        Inicia sesión para acceder al portal de administración.
      </p>
      <a className="text-primary underline underline-offset-4" href="/login">
        Iniciar sesión
      </a>
    </main>
  );
}
