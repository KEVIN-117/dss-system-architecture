import { DashboardViewer } from '../../../components/dashboard-viewer';

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ path: string[] }>;
}) {
  const { path } = await params;
  return <DashboardViewer dashboardPath={path.join('/')} />;
}
