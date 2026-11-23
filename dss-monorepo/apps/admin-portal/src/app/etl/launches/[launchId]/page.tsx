import { AdminEtlLaunchDetailPage } from '../../../components/AdminEtlLaunchDetailPage';
import { ADMIN_PERMISSIONS, AdminPortalLayout } from '../../../components/AdminPortalLayout';

export default async function EtlLaunchRoute({
  params,
}: {
  params: Promise<{ launchId: string }>;
}) {
  const { launchId } = await params;
  return (
    <AdminPortalLayout access={ADMIN_PERMISSIONS.etl}>
      <AdminEtlLaunchDetailPage launchId={launchId} />
    </AdminPortalLayout>
  );
}
