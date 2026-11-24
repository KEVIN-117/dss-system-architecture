'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  Activity,
  AppWindow,
  BarChart3,
  BrainCircuit,
  Cable,
  CalendarClock,
  CalendarRange,
  Database,
  Gauge,
  Grid3x3,
  KeyRound,
  LayoutDashboard,
  LineChart,
  ListChecks,
  ScrollText,
  ServerCog,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react';
import {
  LandingLoginRedirect,
  ProtectedRoute,
  useAuth,
} from '@dss-monorepo/auth';
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

import { EtlRunningIndicator } from './etl/EtlRunningIndicator';

/**
 * Permissions that open each administration area (IAM-014). They come from the token, so who sees what
 * is managed from the admin portal itself, not from code or from the SUPERADMIN role.
 */
export const ADMIN_PERMISSIONS = {
  users: ['iam:users:read'],
  roles: ['iam:roles:read'],
  clients: ['iam:clients:read'],
  audit: ['iam:audit:read'],
  closures: ['dw:closure:read', 'dw:closure:manage'],
  etl: ['dw:etl-monitor:read'],
  olap: ['olap:admin'],
  ml: ['prediction:train'],
} as const satisfies Record<string, readonly DSSPermission[]>;

/** Any administration permission opens the overview. */
export const ANY_ADMIN_PERMISSION: readonly DSSPermission[] = [
  ...ADMIN_PERMISSIONS.users,
  ...ADMIN_PERMISSIONS.roles,
  ...ADMIN_PERMISSIONS.clients,
  ...ADMIN_PERMISSIONS.audit,
  ...ADMIN_PERMISSIONS.closures,
  ...ADMIN_PERMISSIONS.etl,
  ...ADMIN_PERMISSIONS.olap,
  ...ADMIN_PERMISSIONS.ml,
];

export function AdminPortalLayout({
  children,
  access = ANY_ADMIN_PERMISSION,
}: {
  children: ReactNode;
  /** Any of the listed permissions opens the page. */
  access?: readonly DSSPermission[];
}) {
  const { user, permissions, logout } = useAuth();
  const pathname = usePathname() ?? '';
  const router = useRouter();
  const [navigationReady, setNavigationReady] = useState(false);
  useEffect(() => setNavigationReady(true), []);
  const granted = navigationReady && user ? permissions : [];
  const canUsers = hasRequiredPermissions(granted, ADMIN_PERMISSIONS.users);
  const canRoles = hasRequiredPermissions(granted, ADMIN_PERMISSIONS.roles);
  const canClients = hasRequiredPermissions(granted, ADMIN_PERMISSIONS.clients);
  const canAudit = hasRequiredPermissions(granted, ADMIN_PERMISSIONS.audit);
  const canClosures = hasRequiredPermissions(
    granted,
    ADMIN_PERMISSIONS.closures,
  );
  const canEtl = hasRequiredPermissions(granted, ADMIN_PERMISSIONS.etl);
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
      navigationItem(
        'Resumen general',
        '/',
        <LayoutDashboard aria-hidden="true" />,
      ),
    ]),
    ...group(
      canUsers || canRoles || canClients || canAudit,
      'Servicio de autenticación',
      [
        ...(canUsers
          ? [navigationItem('Usuarios', '/users', <Users aria-hidden="true" />)]
          : []),
        ...(canRoles
          ? [
              navigationItem(
                'Roles',
                '/roles',
                <ShieldCheck aria-hidden="true" />,
              ),
              navigationItem(
                'Permisos',
                '/permissions',
                <KeyRound aria-hidden="true" />,
              ),
              navigationItem(
                'Matriz de acceso',
                '/access-matrix',
                <Grid3x3 aria-hidden="true" />,
              ),
            ]
          : []),
        ...(canClients
          ? [
              navigationItem(
                'Aplicaciones',
                '/clients',
                <AppWindow aria-hidden="true" />,
              ),
            ]
          : []),
        ...(canAudit
          ? [
              navigationItem(
                'Auditoría',
                '/audit',
                <ScrollText aria-hidden="true" />,
              ),
            ]
          : []),
      ],
    ),
    ...group(canOlap, 'Servicio OLAP', [
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
    ]),
    // dw-control-service: academic closures plus the Load Manager (LM-007), which operates and schedules the ETL from
    // the portal; Hop Web is only for editing workflows.
    ...group(canClosures || canEtl, 'Servicio de control del almacén de datos', [
      ...(canClosures
        ? [
            navigationItem(
              'Cierres académicos',
              '/academic-closures',
              <CalendarClock aria-hidden="true" />,
            ),
          ]
        : []),
      ...(canEtl
        ? [
            navigationItem('Panel ETL', '/etl', <Gauge aria-hidden="true" />),
            navigationItem(
              'Ejecuciones ETL',
              '/etl-executions',
              <Activity aria-hidden="true" />,
            ),
            navigationItem(
              'Programaciones ETL',
              '/etl-schedules',
              <CalendarRange aria-hidden="true" />,
            ),
          ]
        : []),
    ]),
    // PRED-107: ML Studio guides the whole lifecycle; the other pages stay for direct access.
    ...group(canMl, 'Servicio de aprendizaje automático', [
      navigationItem('ML Studio', '/ml-studio', <Sparkles aria-hidden="true" />),
      navigationItem('Jobs ML', '/ml-jobs', <ListChecks aria-hidden="true" />),
      navigationItem(
        'Pronósticos',
        '/ml-forecasts',
        <LineChart aria-hidden="true" />,
      ),
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
    ]),
  ];
  return (
    <ProtectedRoute
      loadingFallback={
        <Loader
          text="Verificando sesión…"
          fullScreen={false}
          className="min-h-screen"
        />
      }
      unauthenticatedFallback={
        <LandingLoginRedirect
          landingUrl={process.env.NEXT_PUBLIC_LANDING_URL}
        />
      }
    >
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
          onNavigate={(href) => navigatePortal(href, router.push)}
          headerContext={<EtlRunningIndicator enabled={canEtl} />}
        >
          {children}
        </DashboardTemplate>
      </Can>
    </ProtectedRoute>
  );
}

/**
 * Sidebar links navigate client-side so the session held by AuthProvider survives the route change.
 * A plain anchor reloads the document, re-fetches the BFF session and blanks the portal behind the loader.
 */
function navigatePortal(href: string, push: (path: string) => void): void {
  if (
    typeof window !== 'undefined' &&
    new URL(href, window.location.href).origin !== window.location.origin
  ) {
    window.location.assign(href);
    return;
  }
  push(href);
}
