import { DashboardViewer } from '../../../components/dashboard-viewer';

/** Dashboard endpoint for embedding in third-party pages through an iframe. */
export default async function EmbeddedDashboardPage({
  params,
}: {
  params: Promise<{ path: string[] }>;
}) {
  const { path } = await params;
  return <DashboardViewer dashboardPath={path.join('/')} />;
}
