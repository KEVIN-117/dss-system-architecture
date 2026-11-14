'use client';
import { usePathname, useRouter } from 'next/navigation';
import Image from 'next/image';
import { useAuth, ProtectedRoute } from '@dss-monorepo/auth';
import {
  AccessDenied,
  DashboardTemplate,
  Loader,
  type NavigationGroup,
} from '@dss-monorepo/design-system/portal';
import { RoleGuard } from '@dss-monorepo/rbac';
import {
  LayoutDashboard,
  ChartColumn,
  GraduationCap,
  Database,
  UsersRound,
  BrainCircuit,
  ClipboardCheck,
  UserCheck,
  Calculator,
  Repeat,
  TrendingDown,
  Venus,
  Library,
  Building2,
  MapPin,
  School,
  DoorOpen,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { OlapSidebarProvider, useOlapSidebar } from '@dss-monorepo/academic-analytics/olap-sidebar';

export function PortalFrame({ children }: { children: ReactNode }) {
  return <OlapSidebarProvider><PortalFrameContent>{children}</PortalFrameContent></OlapSidebarProvider>;
}

function PortalFrameContent({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? '';
  const router = useRouter();
  const { user, logout } = useAuth();
  const { setTarget, expanded, setExpanded } = useOlapSidebar();
  const links = [
    {
      title: 'Resumen',
      href: '/',
      icon: <LayoutDashboard aria-hidden="true" />,
    },
    {
      title: 'Permanencia',
      href: '/reportes/permanencia',
      icon: <UsersRound aria-hidden="true" />,
    },
    {
      title: 'Predicciones',
      href: '/predictions',
      icon: <BrainCircuit aria-hidden="true" />,
    },
  ];
  const performanceLinks = [
    { title: 'Resumen', href: '/reportes/rendimiento', icon: <ChartColumn aria-hidden="true" /> },
    { title: 'Evaluación de materias', href: '/reportes/rendimiento/materias', icon: <ClipboardCheck aria-hidden="true" /> },
    { title: 'Evaluación de estudiantes', href: '/reportes/rendimiento/estudiantes', icon: <UserCheck aria-hidden="true" /> },
    { title: 'Promedio de notas (PN)', href: '/reportes/rendimiento/promedio-notas', icon: <Calculator aria-hidden="true" /> },
    { title: 'Repitencia (IRE e IRM)', href: '/reportes/rendimiento/repitencia', icon: <Repeat aria-hidden="true" /> },
    { title: 'Retención y deserción', href: '/reportes/rendimiento/retencion', icon: <TrendingDown aria-hidden="true" /> },
  ];
  const admissionLinks = [
    { title: 'Resumen', href: '/reportes/admision', icon: <GraduationCap aria-hidden="true" /> },
    { title: 'Por sexo', href: '/reportes/admision/sexo', icon: <Venus aria-hidden="true" /> },
    { title: 'Área de conocimiento', href: '/reportes/admision/area-conocimiento', icon: <Library aria-hidden="true" /> },
    { title: 'Facultad y carrera', href: '/reportes/admision/facultades', icon: <Building2 aria-hidden="true" /> },
    { title: 'Central y sedes', href: '/reportes/admision/sedes', icon: <MapPin aria-hidden="true" /> },
    { title: 'Procedencia y nacimiento', href: '/reportes/admision/procedencia', icon: <MapPin aria-hidden="true" /> },
    { title: 'Tipo de colegio', href: '/reportes/admision/tipo-colegio', icon: <School aria-hidden="true" /> },
    { title: 'Modalidad de ingreso', href: '/reportes/admision/modalidad', icon: <DoorOpen aria-hidden="true" /> },
  ];
  const navGroups: NavigationGroup[] = [
    {
      title: 'Analítica académica',
      items: links.map((item) => ({
        ...item,
        isActive: pathname === item.href,
      })),
    },
    {
      title: 'Admisión académica',
      items: admissionLinks.map((item) => ({
        ...item,
        isActive: pathname === item.href,
      })),
    },
    {
      title: 'Rendimiento académico',
      items: performanceLinks.map((item) => ({
        ...item,
        isActive: pathname === item.href,
      })),
    },
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
