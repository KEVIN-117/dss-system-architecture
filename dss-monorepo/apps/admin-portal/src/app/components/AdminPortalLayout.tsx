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
import {
  Can,
  hasRequiredPermissions,
  type DSSPermission,
} from '@dss-monorepo/rbac';

/**
 * Permissions that open each administration area (IAM-014). They come from the token, so who sees what
 * is managed from the admin portal itself, not from code or from the SUPERADMIN role.
 */
export const ADMIN_PERMISSIONS = {
  users: ['iam:users:read'],
  olap: ['olap:admin'],
  ml: ['prediction:train'],
} as const satisfies Record<string, readonly DSSPermission[]>;

/** Any administration permission opens the overview. */
export const ANY_ADMIN_PERMISSION: readonly DSSPermission[] = [
  ...ADMIN_PERMISSIONS.users,
  ...ADMIN_PERMISSIONS.olap,
  ...ADMIN_PERMISSIONS.ml,
];

export function AdminPortalLayout({
  children,
  access = ANY_ADMIN_PERMISSION,
}: {
  children: ReactNode;
  /**
   * `authenticated` lets the service decide (DW pages, whose operators may still hold the legacy
   * DW_* roles); otherwise any of the listed permissions opens the page.
   */
  access?: 'authenticated' | readonly DSSPermission[];
}) {
  const { user, permissions, logout } = useAuth();
  const pathname = usePathname() ?? '';
  const [navigationReady, setNavigationReady] = useState(false);
  useEffect(() => setNavigationReady(true), []);
  const granted = navigationReady && user ? permissions : [];
  const canUsers = hasRequiredPermissions(granted, ADMIN_PERMISSIONS.users);
  const canOlap = hasRequiredPermissions(granted, ADMIN_PERMISSIONS.olap);
  const canMl = hasRequiredPermissions(granted, ADMIN_PERMISSIONS.ml);
  const canOverview = hasRequiredPermissions(granted, ANY_ADMIN_PERMISSION);
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
  const group = (
    visible: boolean,
    title: string,
    items: NavigationItem[],
  ): NavigationGroup[] => (visible ? [{ title, items }] : []);
  const navGroups: NavigationGroup[] = [
    ...group(canOverview, 'Plataforma', [
      navigationItem('Resumen general', '/', <LayoutDashboard aria-hidden="true" />),
    ]),
    ...group(canUsers, 'Servicio de autenticación', [
      navigationItem('Usuarios', '/users', <Users aria-hidden="true" />),
    ]),
    ...group(canOlap, 'Servicio OLAP', [
      navigationItem('Conexiones', '/datasources', <Cable aria-hidden="true" />),
      navigationItem('Esquemas y cubos', '/schemas', <Database aria-hidden="true" />),
    ]),
    // DW pages stay visible to every authenticated user: dw-control-service decides, and during the
    // coexistence operators may still hold the legacy DW_* roles instead of the dw:* permissions.
    ...group(true, 'Servicio de control del almacén de datos', [
      navigationItem('Cierres académicos', '/academic-closures', <CalendarClock aria-hidden="true" />),
      navigationItem('Ejecuciones ETL', '/etl-executions', <Activity aria-hidden="true" />),
    ]),
    ...group(canMl, 'Servicio de aprendizaje automático', [
      navigationItem('Operaciones ML', '/ml-operations', <BrainCircuit aria-hidden="true" />),
      navigationItem('Validación de modelos', '/ml-models', <BarChart3 aria-hidden="true" />),
      navigationItem('Modelos activos', '/ml-registry', <ServerCog aria-hidden="true" />),
    ]),
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
        <Can
          permissions={access}
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
        </Can>
      )}
    </ProtectedRoute>
  );
}

