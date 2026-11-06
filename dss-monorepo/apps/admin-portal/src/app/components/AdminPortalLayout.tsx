'use client';

import type { ReactNode } from 'react';
import {
  Activity,
  BrainCircuit,
  CalendarClock,
  Database,
  LayoutDashboard,
  Users,
} from 'lucide-react';
import { ProtectedRoute, useAuth } from '@dss-monorepo/auth';
import { AccessDenied, DashboardTemplate } from '@dss-monorepo/design-system';
import { RoleGuard } from '@dss-monorepo/rbac';

export function AdminPortalLayout({
  children,
  access = 'superadmin',
}: {
  children: ReactNode;
  access?: 'superadmin' | 'authenticated';
}) {
  const { user, logout } = useAuth();
  const isSuperAdmin = user?.roles.includes('SUPERADMIN') ?? false;
  const portal = (
    <DashboardTemplate
      sidebarTitle="DSS ADMIN"
      navItems={[
        ...(isSuperAdmin
          ? [
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
              {
                title: 'Operaciones ML',
                href: '/ml-operations',
                icon: <BrainCircuit className="size-4" />,
              },
            ]
          : []),
        {
          title: 'Cierres académicos',
          href: '/academic-closures',
          icon: <CalendarClock className="size-4" />,
        },
        {
          title: 'Ejecuciones ETL',
          href: '/etl-executions',
          icon: <Activity className="size-4" />,
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
  );
  return (
    <ProtectedRoute unauthenticatedFallback={<LoginRequired />}>
      {access === 'authenticated' ? (
        portal
      ) : (
        <RoleGuard
          rolesAllowed={['SUPERADMIN']}
          fallback={
            <AccessDenied
              portalName="de administración"
              logoutHref={`${process.env.NEXT_PUBLIC_BFF_URL}/api/auth/logout`}
            />
          }
        >
          {portal}
        </RoleGuard>
      )}
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
