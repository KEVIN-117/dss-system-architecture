import { AdminEtlSchedulesPage } from '../components/AdminEtlSchedulesPage';
import { ADMIN_PERMISSIONS, AdminPortalLayout } from '../components/AdminPortalLayout';

export default function EtlSchedulesRoute() {
  return (
    <AdminPortalLayout access={ADMIN_PERMISSIONS.etl}>
      <AdminEtlSchedulesPage />
    </AdminPortalLayout>
  );
}
