'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  AppWindow,
  ArrowLeft,
  Code2,
  Database,
  LayoutDashboard,
  LogOut,
  Search,
} from 'lucide-react';
import { ProtectedRoute, useAuth } from '@dss-monorepo/auth';
import { AccessDenied, Button, ThemeToggle } from '@dss-monorepo/design-system';
import { getHighestRole, RoleGuard } from '@dss-monorepo/rbac';
import { getBffBaseUrl } from '../lib/auth-config';

const portalUrls = {
  SUPERADMIN: process.env.NEXT_PUBLIC_ADMIN_PORTAL_URL,
  RECTOR: process.env.NEXT_PUBLIC_RECTOR_DASHBOARD_URL,
  DECANO: process.env.NEXT_PUBLIC_DECANO_DASHBOARD_URL,
  DIRECTOR: process.env.NEXT_PUBLIC_DIRECTOR_DASHBOARD_URL,
} as const;

function getPortalUrl(
  roles: NonNullable<ReturnType<typeof useAuth>['user']>['roles'],
): string | null {
  const role = getHighestRole(roles);
  const configured = role ? portalUrls[role] : undefined;
  if (!configured) return null;
  try {
    const url = new URL(configured);
    return url.protocol === 'http:' || url.protocol === 'https:'
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

export function WorkspaceShell({ children }: { children: ReactNode }) {
  const { user, logout, login } = useAuth();
  const pathname = usePathname() ?? '';
  const portalUrl = getPortalUrl(user?.roles ?? []);
  const highestRole = getHighestRole(user?.roles ?? []);
  const isAcademicAnalyst = highestRole !== null && highestRole !== 'SUPERADMIN';
  const navItems = isAcademicAnalyst
    ? [
        {
          title: 'Análisis OLAP',
          href: '/analysis',
          icon: <Search aria-hidden="true" className="size-4" />,
        },
      ]
    : [
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
          title: 'MDX Workbench',
          href: '/workbench',
          icon: <Code2 aria-hidden="true" className="size-4" />,
        },
        {
          title: 'Apps',
          href: '/apps',
          icon: <AppWindow aria-hidden="true" className="size-4" />,
        },
      ];

  return (
    <ProtectedRoute unauthenticatedFallback={<LoginRequired onLogin={login} />}>
      <RoleGuard
        rolesAllowed={['RECTOR', 'DECANO', 'DIRECTOR', 'SUPERADMIN']}
        fallback={
          <AccessDenied
            portalName="OLAP Workspace"
            logoutHref={`${getBffBaseUrl()}/api/auth/logout`}
          />
        }
      >
        <div className="flex min-h-screen flex-col bg-background text-foreground">
          <header className="border-b border-border bg-card">
            <div className="flex flex-wrap items-center gap-x-5 gap-y-3 px-4 py-3 sm:px-6">
              <Link
                href={isAcademicAnalyst ? '/analysis' : '/'}
                className="shrink-0 rounded-sm text-sm font-bold tracking-tight focus-visible:outline-2 focus-visible:outline-ring"
              >
                UATF <span className="text-primary">/</span> OLAP
              </Link>
              <nav
                aria-label="Navegación principal"
                className="order-last flex w-full min-w-0 gap-1 overflow-x-auto sm:order-none sm:w-auto sm:flex-1"
              >
                {navItems.map((item) => {
                  const active =
                    item.href === '/'
                      ? pathname === '/'
                      : pathname === item.href ||
                        pathname.startsWith(`${item.href}/`);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      aria-current={active ? 'page' : undefined}
                      className={`inline-flex min-h-9 shrink-0 items-center gap-2 rounded-md px-3 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-ring ${active ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}
                    >
                      {item.icon}
                      {item.title}
                    </Link>
                  );
                })}
              </nav>
              <div className="ml-auto flex items-center gap-2">
                <ThemeToggle />
                <span className="hidden max-w-40 truncate text-sm text-muted-foreground md:block">
                  {user ? `${user.firstName} ${user.lastName}`.trim() : ''}
                </span>
                {portalUrl && (
                  <a
                    href={portalUrl}
                    className="inline-flex min-h-9 items-center gap-2 rounded-md border border-border px-3 text-sm font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
                  >
                    <ArrowLeft aria-hidden="true" className="size-4" />
                    <span>Volver a mi portal</span>
                  </a>
                )}
                {!portalUrl && (
                  <span className="hidden text-xs text-muted-foreground lg:block" role="status">
                    Portal de regreso no configurado
                  </span>
                )}
                <Button variant="outline" size="sm" onClick={logout}>
                  <LogOut aria-hidden="true" className="size-4" />
                  Cerrar sesión
                </Button>
              </div>
            </div>
          </header>
          <div className="min-w-0 flex-1">{children}</div>
        </div>
      </RoleGuard>
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
