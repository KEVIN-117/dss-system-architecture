'use client';

import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import {
  Activity,
  BrainCircuit,
  Cable,
  CalendarClock,
  Database,
  LayoutDashboard,
  Users,
} from 'lucide-react';
import { ProtectedRoute, useAuth } from '@dss-monorepo/auth';
import {
  AccessDenied,
  DashboardTemplate,
  Loader,
  type NavigationGroup,
  type NavigationItem,
} from '@dss-monorepo/design-system';
import { RoleGuard } from '@dss-monorepo/rbac';

export function AdminPortalLayout({
  children,
  access = 'superadmin',
}: {
  children: ReactNode;
  access?: 'superadmin' | 'authenticated';
}) {
  const { user, logout } = useAuth();
  const pathname = usePathname() ?? '';
  const isSuperAdmin = user?.roles.includes('SUPERADMIN') ?? false;
  const navigationItem = (
    title: string,
    href: string,
    icon: ReactNode,
  ): NavigationItem => ({
    title,
    href,
    icon,
    isActive:
      href === '/'
        ? pathname === href
        : pathname === href || pathname.startsWith(`${href}/`),
  });
  const navGroups: NavigationGroup[] = [
    ...(isSuperAdmin
      ? [
          {
            title: 'Plataforma',
            items: [
              navigationItem(
                'Resumen general',
                '/',
                <LayoutDashboard aria-hidden="true" />,
              ),
            ],
          },
          {
            title: 'Auth Service',
            items: [
              navigationItem(
                'Usuarios',
                '/users',
                <Users aria-hidden="true" />,
              ),
            ],
          },
          {
            title: 'OLAP Service',
            items: [
              navigationItem(
                'Conexiones',
                '/datasources',
                <Cable aria-hidden="true" />,
              ),
              navigationItem(
                'Esquemas y cubos',
                '/schemas',
                <Database aria-hidden="true" />,
              ),
            ],
          },
        ]
      : []),
    {
      title: 'DW Control Service',
      items: [
        navigationItem(
          'Cierres académicos',
          '/academic-closures',
          <CalendarClock aria-hidden="true" />,
        ),
        navigationItem(
          'Ejecuciones ETL',
          '/etl-executions',
          <Activity aria-hidden="true" />,
        ),
      ],
    },
    ...(isSuperAdmin
      ? [
          {
            title: 'ML Service',
            items: [
              navigationItem(
                'Operaciones ML',
                '/ml-operations',
                <BrainCircuit aria-hidden="true" />,
              ),
            ],
          },
        ]
      : []),
  ];
  const portal = (
    <DashboardTemplate
      sidebarTitle="Administración DSS"
      navGroups={navGroups}
      surfaceMaterial="frosted"
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
      <ProtectedRoute
        loadingFallback={<Loader text="Verificando sesión…" fullScreen={false} className="min-h-[60vh]" />}
        unauthenticatedFallback={<LoginRequired />}
      >
        {access === 'authenticated' ? (
          children
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
            {children}
          </RoleGuard>
        )}
      </ProtectedRoute>
    </DashboardTemplate>
  );
  return portal;
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
