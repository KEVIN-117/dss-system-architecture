import { AdminEtlExecutionDetailPage } from '../../components/AdminEtlExecutionDetailPage';
import { AdminPortalLayout } from '../../components/AdminPortalLayout';

export default async function EtlExecutionDetailRoute({
  params,
}: {
  params: Promise<{ runId: string }>;
}) {
  const { runId } = await params;
  return (
    <AdminPortalLayout access="authenticated">
      <AdminEtlExecutionDetailPage runId={decodeURIComponent(runId)} />
    </AdminPortalLayout>
  );
}
