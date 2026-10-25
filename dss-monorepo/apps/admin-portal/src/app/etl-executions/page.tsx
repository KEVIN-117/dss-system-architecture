import { AdminEtlExecutionsPage } from '../components/AdminEtlExecutionsPage';
import { AdminPortalLayout } from '../components/AdminPortalLayout';

export default function EtlExecutionsRoute() {
  return (
    <AdminPortalLayout access="authenticated">
      <AdminEtlExecutionsPage />
    </AdminPortalLayout>
  );
}
