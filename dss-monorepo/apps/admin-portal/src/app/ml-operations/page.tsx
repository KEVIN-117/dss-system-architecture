import { AdminMlOperationsPage } from '../components/AdminMlOperationsPage';
import { AdminPortalLayout } from '../components/AdminPortalLayout';

export default function MlOperationsRoute() {
  return (
    <AdminPortalLayout>
      <AdminMlOperationsPage />
    </AdminPortalLayout>
  );
}
