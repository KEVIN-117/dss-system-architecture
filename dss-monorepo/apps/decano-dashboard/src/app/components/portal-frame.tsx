'use client';

import type { ReactNode } from 'react';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth, ProtectedRoute } from '@dss-monorepo/auth';
import {
  AccessDenied,
  DashboardTemplate,
  Loader,
  type NavigationGroup,
} from '@dss-monorepo/design-system';
import { RoleGuard } from '@dss-monorepo/rbac';
import {
  ArrowDownUp,
  ChartColumn,
  GraduationCap,
  LayoutDashboard,
  ListFilter,
  UsersRound,
} from 'lucide-react';

export function PortalFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? '';
  const router = useRouter();
  const { user, logout } = useAuth();
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
    {
      title: 'Rendimiento',
      items: [
        {
          title: 'Resultados por gestión',
          href: '/reportes/rendimiento',
          icon: <ChartColumn aria-hidden="true" />,
          isActive: pathname === '/reportes/rendimiento',
        },
        {
          title: 'Regularidad y continuidad',
          href: '/reportes/rendimiento/regularidad',
          icon: <ArrowDownUp aria-hidden="true" />,
          isActive: pathname === '/reportes/rendimiento/regularidad',
        },
      ],
    },
    {
      title: 'Admisión',
      items: [
        {
          title: 'Postulantes y resultados',
          href: '/reportes/admision',
          icon: <GraduationCap aria-hidden="true" />,
          isActive: pathname === '/reportes/admision',
        },
        {
          title: 'Distribución',
          href: '/reportes/admision/distribucion',
          icon: <ListFilter aria-hidden="true" />,
          isActive: pathname === '/reportes/admision/distribucion',
        },
      ],
    },
    {
      title: 'Permanencia',
      items: [
        {
          title: 'Retención y deserción',
          href: '/reportes/permanencia',
          icon: <UsersRound aria-hidden="true" />,
          isActive: pathname === '/reportes/permanencia',
        },
      ],
    },
  ];

  return (
    <ProtectedRoute
      loadingFallback={<Loader />}
      unauthenticatedFallback={
        <main className="grid min-h-screen place-content-center gap-4 bg-background p-8 text-foreground">
          <h1 className="text-2xl font-semibold">Sesión requerida</h1>
          <p>Inicia sesión para consultar los indicadores de tu facultad.</p>
          <a
            className="text-primary underline underline-offset-4"
            href="/login"
          >
            Iniciar sesión
          </a>
        </main>
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
          onNavigate={router.push}
        >
          {children}
        </DashboardTemplate>
      </RoleGuard>
    </ProtectedRoute>
  );
}

export function PortalBoundary({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? '';
  if (pathname === '/login' || pathname.startsWith('/auth/')) return children;
  return <PortalFrame>{children}</PortalFrame>;
}
