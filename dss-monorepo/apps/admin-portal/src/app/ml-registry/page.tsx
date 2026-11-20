import { AdminModelRegistryPage } from '../components/AdminModelRegistryPage';
import { ADMIN_PERMISSIONS, AdminPortalLayout } from '../components/AdminPortalLayout';

export default function MlRegistryRoute() {
  return (
    <AdminPortalLayout access={ADMIN_PERMISSIONS.ml}>
      <AdminModelRegistryPage />
    </AdminPortalLayout>
  );
}
