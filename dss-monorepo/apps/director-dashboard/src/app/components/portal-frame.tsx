'use client';
import { usePathname, useRouter } from 'next/navigation';
import Image from 'next/image';
import { useAuth, ProtectedRoute } from '@dss-monorepo/auth';
import {
  AccessDenied,
  DashboardTemplate,
  Loader,
  type NavigationGroup,
} from '@dss-monorepo/design-system';
import { RoleGuard } from '@dss-monorepo/rbac';
import {
  LayoutDashboard,
  ChartColumn,
  GraduationCap,
  UsersRound,
} from 'lucide-react';
import type { ReactNode } from 'react';

export function PortalFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? '';
  const router = useRouter();
  const { user, logout } = useAuth();
  const links = [
    {
      title: 'Resumen',
      href: '/',
      icon: <LayoutDashboard aria-hidden="true" />,
    },
    {
      title: 'Rendimiento',
      href: '/reportes/rendimiento',
      icon: <ChartColumn aria-hidden="true" />,
    },
    {
      title: 'Admisión',
      href: '/reportes/admision',
      icon: <GraduationCap aria-hidden="true" />,
    },
    {
      title: 'Permanencia',
      href: '/reportes/permanencia',
      icon: <UsersRound aria-hidden="true" />,
    },
  ];
  const navGroups: NavigationGroup[] = [
    {
      title: 'Analítica académica',
      items: links.map((item) => ({
        ...item,
        isActive: pathname === item.href,
      })),
    },
  ];
  return (
    <ProtectedRoute
      loadingFallback={<Loader />}
      unauthenticatedFallback={
        <main className="grid min-h-screen place-content-center gap-4 bg-background p-8 text-foreground">
          <h1 className="text-2xl font-semibold">Sesión requerida</h1>
          <p>Inicia sesión para consultar los indicadores académicos.</p>
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
        rolesAllowed={['DIRECTOR']}
        fallback={
          <AccessDenied
            portalName="Dirección de carrera"
            logoutHref={process.env.NEXT_PUBLIC_BFF_URL + '/api/auth/logout'}
          />
        }
      >
        <DashboardTemplate
          sidebarTitle="UATF-DSA"
          sidebarSubtitle="Dirección de carrera"
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
