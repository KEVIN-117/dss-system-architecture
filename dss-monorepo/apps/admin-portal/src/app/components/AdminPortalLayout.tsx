'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import {
  Activity,
  BarChart3,
  BrainCircuit,
  Cable,
  CalendarClock,
  Database,
  LayoutDashboard,
  ServerCog,
  Users,
} from 'lucide-react';
import { LandingLoginRedirect, ProtectedRoute, useAuth } from '@dss-monorepo/auth';
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
  const [navigationReady, setNavigationReady] = useState(false);
  useEffect(() => setNavigationReady(true), []);
  const isSuperAdmin =
    navigationReady && (user?.roles.includes('SUPERADMIN') ?? false);
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
            title: 'Servicio de autenticación',
            items: [
              navigationItem(
                'Usuarios',
                '/users',
                <Users aria-hidden="true" />,
              ),
            ],
          },
          {
            title: 'Servicio OLAP',
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
      title: 'Servicio de control del almacén de datos',
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
            title: 'Servicio de aprendizaje automático',
            items: [
              navigationItem(
                'Operaciones ML',
                '/ml-operations',
                <BrainCircuit aria-hidden="true" />,
              ),
              navigationItem(
                'Validación de modelos',
                '/ml-models',
                <BarChart3 aria-hidden="true" />,
              ),
              navigationItem(
                'Modelos activos',
                '/ml-registry',
                <ServerCog aria-hidden="true" />,
              ),
            ],
          },
        ]
      : []),
  ];
  return (
    <ProtectedRoute
      loadingFallback={<Loader text="Verificando sesión…" fullScreen={false} className="min-h-[60vh]" />}
      unauthenticatedFallback={
        <LandingLoginRedirect landingUrl={process.env.NEXT_PUBLIC_LANDING_URL} />
      }
    >
      {access === 'authenticated' ? (
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
          {children}
        </DashboardTemplate>
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
            {children}
          </DashboardTemplate>
        </RoleGuard>
      )}
    </ProtectedRoute>
  );
}

