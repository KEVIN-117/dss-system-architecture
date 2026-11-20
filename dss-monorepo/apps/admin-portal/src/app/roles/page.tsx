import { AdminRolesPage } from '../components/AdminRolesPage';
import { ADMIN_PERMISSIONS, AdminPortalLayout } from '../components/AdminPortalLayout';

export default function RolesRoute() {
  return (
    <AdminPortalLayout access={ADMIN_PERMISSIONS.roles}>
      <AdminRolesPage />
    </AdminPortalLayout>
  );
}
