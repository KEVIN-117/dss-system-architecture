import { AdminUsersPage } from '../components/AdminUsersPage';
import { ADMIN_PERMISSIONS, AdminPortalLayout } from '../components/AdminPortalLayout';

export default function UsersRoute() {
  return (
    <AdminPortalLayout access={ADMIN_PERMISSIONS.users}>
      <AdminUsersPage />
    </AdminPortalLayout>
  );
}
