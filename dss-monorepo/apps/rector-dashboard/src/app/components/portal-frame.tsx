'use client';
import { usePathname, useRouter } from 'next/navigation';
import Image from 'next/image';
import {
  useAuth,
  ProtectedRoute,
  LandingLoginRedirect,
} from '@dss-monorepo/auth';
import {
  AccessDenied,
  DashboardTemplate,
  Loader,
  type NavigationGroup,
} from '@dss-monorepo/design-system/portal';
import { RoleGuard } from '@dss-monorepo/rbac';
import { LayoutDashboard, Database, BrainCircuit, TrendingUp } from 'lucide-react';
import type { ReactNode } from 'react';
import {
  OlapSidebarProvider,
  useOlapSidebar,
} from '@dss-monorepo/academic-analytics/olap-sidebar';
import { analyticsNavigation } from '@dss-monorepo/academic-analytics/panel/navigation';
import {
  AcademicScopeHeader,
  AcademicScopeProvider,
} from '@dss-monorepo/academic-analytics/panel/academic-scope';

export function PortalFrame({ children }: { children: ReactNode }) {
  return (
    <OlapSidebarProvider>
      <AcademicScopeProvider roleLabel="Rectoría">
        <PortalFrameContent>{children}</PortalFrameContent>
      </AcademicScopeProvider>
    </OlapSidebarProvider>
  );
}

function PortalFrameContent({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? '';
  const router = useRouter();
  const { user, logout, hasPermission } = useAuth();
  const { setTarget, expanded, setExpanded } = useOlapSidebar();
  const links = [
    {
      title: 'Resumen',
      href: '/',
      icon: <LayoutDashboard aria-hidden="true" />,
    },
    {
      title: 'Predicciones',
      href: '/predictions',
      icon: <BrainCircuit aria-hidden="true" />,
    },
    // PRED-108: program forecasts, for holders of prediction:forecast:read.
    ...(hasPermission('prediction:forecast:read')
      ? [
          {
            title: 'Pronósticos',
            href: '/predictions/pronosticos',
            icon: <TrendingUp aria-hidden="true" />,
          },
        ]
      : []),
  ];
  const navGroups: NavigationGroup[] = [
    {
      title: 'Analítica académica',
      items: links.map((item) => ({
        ...item,
        isActive: pathname === item.href,
      })),
    },
    ...analyticsNavigation(pathname, 'global'),
    {
      title: 'Exploración OLAP',
      expanded,
      onExpandedChange: setExpanded,
      items: [
        {
          title: 'Espacio de análisis OLAP',
          href: '/analisis-olap',
          icon: <Database aria-hidden="true" />,
          isActive: pathname === '/analisis-olap',
        },
      ],
      content:
        pathname === '/analisis-olap' ? <div ref={setTarget} /> : undefined,
    },
  ];
  return (
    <ProtectedRoute
      loadingFallback={<Loader />}
      unauthenticatedFallback={
        <LandingLoginRedirect
          landingUrl={process.env.NEXT_PUBLIC_LANDING_URL}
        />
      }
    >
      <RoleGuard
        rolesAllowed={['RECTOR']}
        fallback={
          <AccessDenied
            portalName="Rectoría"
            logoutHref={process.env.NEXT_PUBLIC_BFF_URL + '/api/auth/logout'}
          />
        }
      >
        <DashboardTemplate
          sidebarTitle="UATF-DSA"
          sidebarSubtitle="Rectoría"
          sidebarLogo={
            <Image
              src="/dsa-logo.png"
              alt=""
              width={38}
              height={38}
              className="size-9 object-contain"
            />
          }
          navGroups={navGroups}
          surfaceMaterial="frosted"
          headerContext={<AcademicScopeHeader badge="never" />}
          user={
            user
              ? {
                  name: [user.firstName, user.lastName]
                    .filter(Boolean)
                    .join(' '),
                  email: user.email,
                }
              : undefined
          }
          onDisconnect={logout}
          onNavigate={(href) => navigatePortal(href, router.push)}
        >
          {children}
        </DashboardTemplate>
      </RoleGuard>
    </ProtectedRoute>
  );
}

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

export function PortalBoundary({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? '';
  if (pathname === '/login' || pathname.startsWith('/auth/')) return children;
  return <PortalFrame>{children}</PortalFrame>;
}
