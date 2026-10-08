import { AdminUsersPage } from '../components/AdminUsersPage';
import { AdminPortalLayout } from '../components/AdminPortalLayout';

export default function UsersRoute() {
  return (
    <AdminPortalLayout>
      <AdminUsersPage />
    </AdminPortalLayout>
  );
}
