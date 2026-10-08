import {
  Button,
  MetricIndicator,
  Typography,
} from '@dss-monorepo/design-system';
import { DashboardCharts } from './components/DashboardCharts';
import { AdminPortalLayout } from './components/AdminPortalLayout';

export default function Index() {
  return (
    <AdminPortalLayout>
      <div className="mx-auto w-full max-w-7xl">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="mb-2 text-sm text-muted-foreground">
              Platform operations
            </p>
            <Typography variant="h2" className="border-none font-bold">
              System overview
            </Typography>
          </div>
          <Button variant="outline">Run diagnostics</Button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricIndicator
            title="Core load"
            value="89%"
            trend="up"
            trendValue="+14%"
            isCritical
          />
          <MetricIndicator
            title="Active sessions"
            value="1,024"
            trend="up"
            trendValue="+12"
          />
          <MetricIndicator
            title="Intrusion attempts"
            value="0"
            trend="neutral"
            trendValue="0"
          />
          <MetricIndicator
            title="Query latency"
            value="4ms"
            trend="down"
            trendValue="-1ms"
          />
        </div>
        <DashboardCharts />
      </div>
    </AdminPortalLayout>
  );
}
