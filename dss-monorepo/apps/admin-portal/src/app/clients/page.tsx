import { AdminClientsPage } from '../components/AdminClientsPage';
import { ADMIN_PERMISSIONS, AdminPortalLayout } from '../components/AdminPortalLayout';

export default function ClientsRoute() {
  return (
    <AdminPortalLayout access={ADMIN_PERMISSIONS.clients}>
      <AdminClientsPage />
    </AdminPortalLayout>
  );
}
