import { AdminLoadManagerPage } from '../components/AdminLoadManagerPage';
import { ADMIN_PERMISSIONS, AdminPortalLayout } from '../components/AdminPortalLayout';

export default function LoadManagerRoute() {
  return (
    <AdminPortalLayout access={ADMIN_PERMISSIONS.etl}>
      <AdminLoadManagerPage />
    </AdminPortalLayout>
  );
}
