import { AccessDenied } from '@dss-monorepo/design-system';
import { ProtectedRoute } from '@dss-monorepo/auth';
import { RoleGuard } from '@dss-monorepo/rbac';
import { RectorAnalyticsDashboard } from './components/rector-analytics-dashboard';

export default function Index() {
  return (
    <ProtectedRoute unauthenticatedFallback={<LoginRequired />}>
      <RoleGuard rolesAllowed={['RECTOR']} fallback={<AccessDeniedForPortal />}>
        <main className="min-h-screen bg-background text-foreground">
          <RectorAnalyticsDashboard />
        </main>
      </RoleGuard>
    </ProtectedRoute>
  );
}

function LoginRequired() {
  return (
    <main className="grid min-h-screen place-content-center gap-4 bg-background p-8 text-foreground">
      <h1 className="text-2xl font-semibold">Sesión requerida</h1>
      <p className="max-w-prose text-muted-foreground">Inicia sesión para consultar los indicadores institucionales.</p>
      <a className="w-fit text-primary underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" href="/login">Iniciar sesión</a>
    </main>
  );
}

function AccessDeniedForPortal() {
  return (
    <AccessDenied
      portalName="del rector"
      logoutHref={`${process.env.NEXT_PUBLIC_BFF_URL}/api/auth/logout`}
    />
  );
}
