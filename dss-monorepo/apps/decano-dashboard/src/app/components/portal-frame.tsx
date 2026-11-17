'use client';

import type { ReactNode } from 'react';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth, ProtectedRoute, LandingLoginRedirect } from '@dss-monorepo/auth';
import {
  AccessDenied,
  DashboardTemplate,
  Loader,
  type NavigationGroup,
} from '@dss-monorepo/design-system/portal';
import { OlapSidebarProvider, useOlapSidebar } from '@dss-monorepo/academic-analytics/olap-sidebar';
import { analyticsNavigation } from '@dss-monorepo/academic-analytics/panel/navigation';
import { RoleGuard } from '@dss-monorepo/rbac';
import { LayoutDashboard, Database } from 'lucide-react';

export function PortalFrame({ children }: { children: ReactNode }) {
  return <OlapSidebarProvider><PortalFrameContent>{children}</PortalFrameContent></OlapSidebarProvider>;
}

function PortalFrameContent({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? '';
  const router = useRouter();
  const { user, logout } = useAuth();
  const { setTarget, expanded, setExpanded } = useOlapSidebar();
  const navGroups: NavigationGroup[] = [
    {
      title: 'General',
      items: [
        {
          title: 'Resumen',
          href: '/',
          icon: <LayoutDashboard aria-hidden="true" />,
          isActive: pathname === '/',
        },
      ],
    },
    ...analyticsNavigation(pathname, 'faculty'),
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
      content: pathname === '/analisis-olap' ? <div ref={setTarget} /> : undefined,
    },
  ];

  return (
    <ProtectedRoute
      loadingFallback={<Loader />}
      unauthenticatedFallback={
        <LandingLoginRedirect landingUrl={process.env.NEXT_PUBLIC_LANDING_URL} />
      }
    >
      <RoleGuard
        rolesAllowed={['DECANO']}
        fallback={
          <AccessDenied
            portalName="Decanato"
            logoutHref={`${process.env.NEXT_PUBLIC_BFF_URL}/api/auth/logout`}
          />
        }
      >
        <DashboardTemplate
          sidebarTitle="UATF-DSA"
          sidebarSubtitle="Decanato"
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
  if (typeof window !== 'undefined' && new URL(href, window.location.href).origin !== window.location.origin) {
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
