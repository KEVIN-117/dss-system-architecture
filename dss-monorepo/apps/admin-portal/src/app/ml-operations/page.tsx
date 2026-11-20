import { AdminMlOperationsPage } from '../components/AdminMlOperationsPage';
import { ADMIN_PERMISSIONS, AdminPortalLayout } from '../components/AdminPortalLayout';

export default function MlOperationsRoute() {
  return (
    <AdminPortalLayout access={ADMIN_PERMISSIONS.ml}>
      <AdminMlOperationsPage />
    </AdminPortalLayout>
  );
}
