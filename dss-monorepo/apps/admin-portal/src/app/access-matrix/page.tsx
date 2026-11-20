import { PermissionMatrixPage } from '../components/PermissionMatrixPage';
import { ADMIN_PERMISSIONS, AdminPortalLayout } from '../components/AdminPortalLayout';

export default function AccessMatrixRoute() {
  return (
    <AdminPortalLayout access={ADMIN_PERMISSIONS.roles}>
      <PermissionMatrixPage />
    </AdminPortalLayout>
  );
}
