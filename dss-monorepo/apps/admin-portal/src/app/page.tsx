import {
  DashboardTemplate,
  MetricIndicator,
  Button,
  Typography,
} from '@dss-monorepo/design-system';
import { DashboardCharts } from './components/DashboardCharts';

export default function Index() {
  return (
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
  );
}
