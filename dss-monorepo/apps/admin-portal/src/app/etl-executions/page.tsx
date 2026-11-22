import { AdminEtlExecutionsPage } from '../components/AdminEtlExecutionsPage';
import { ADMIN_PERMISSIONS, AdminPortalLayout } from '../components/AdminPortalLayout';

export default function EtlExecutionsRoute() {
  return (
    <AdminPortalLayout access={ADMIN_PERMISSIONS.etl}>
      <AdminEtlExecutionsPage />
    </AdminPortalLayout>
  );
}
