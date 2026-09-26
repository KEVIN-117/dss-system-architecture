import {
  DashboardTemplate,
  MetricIndicator,
  Button,
  Typography,
} from '@dss-monorepo/design-system';
import { ProtectedRoute } from '@dss-monorepo/auth';
import { DashboardCharts } from './components/DashboardCharts';

export default function Index() {
  return (
    <ProtectedRoute requiredRoles={['SUPERADMIN']} unauthorizedFallback={<LoginRequired />}>
      <DashboardTemplate
        sidebarTitle="DSS ADMIN"
        navItems={[
          { title: 'System Overview', href: '#' },
          { title: 'Network Security', href: '#' },
          { title: 'Access Logs', href: '#' },
          { title: 'Node Cluster', href: '#' },
        ]}
        user={{
          name: 'Root Operator',
          email: 'admin@uatf.edu.bo',
        }}
      >
        <div className="flex items-center justify-between mb-8">
          <Typography variant="h2" className="border-none font-bold">
            MAINFRAME STATUS
          </Typography>
          <Button
            variant="outline"
            className="border-primary text-primary hover:bg-primary/20"
          >
            Run Diagnostics
          </Button>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <MetricIndicator
            title="CORE LOAD"
            value="89%"
            trend="up"
            trendValue="+14%"
            isCritical
          />
          <MetricIndicator
            title="ACTIVE SESSIONS"
            value="1,024"
            trend="up"
            trendValue="+12"
          />
          <MetricIndicator
            title="INTRUSION ATTEMPTS"
            value="0"
            trend="neutral"
            trendValue="0"
          />
          <MetricIndicator
            title="QUERY LATENCY"
            value="4ms"
            trend="down"
            trendValue="-1ms"
          />
        </div>
        <DashboardCharts />
      </DashboardTemplate>
    </ProtectedRoute>
  );
}

function LoginRequired() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8">
      <h1 className="text-2xl font-bold">Sesión requerida</h1>
      <p>Inicia sesión para acceder al portal de administración.</p>
      <a className="text-primary underline" href="/login">Iniciar sesión</a>
    </main>
  );
}
