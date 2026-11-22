import { AdminEtlExecutionDetailPage } from '../../components/AdminEtlExecutionDetailPage';
import { ADMIN_PERMISSIONS, AdminPortalLayout } from '../../components/AdminPortalLayout';

export default async function EtlExecutionDetailRoute({
  params,
}: {
  params: Promise<{ runId: string }>;
}) {
  const { runId } = await params;
  return (
    <AdminPortalLayout access={ADMIN_PERMISSIONS.etl}>
      <AdminEtlExecutionDetailPage runId={decodeURIComponent(runId)} />
    </AdminPortalLayout>
  );
}
