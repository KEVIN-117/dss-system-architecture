import { AdminPermissionsPage } from '../components/AdminPermissionsPage';
import { ADMIN_PERMISSIONS, AdminPortalLayout } from '../components/AdminPortalLayout';

export default function PermissionsRoute() {
  return (
    <AdminPortalLayout access={ADMIN_PERMISSIONS.roles}>
      <AdminPermissionsPage />
    </AdminPortalLayout>
  );
}
