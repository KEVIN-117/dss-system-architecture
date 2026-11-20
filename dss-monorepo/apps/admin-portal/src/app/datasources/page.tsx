import { AdminDatasourcesPage } from '../components/AdminDatasourcesPage';
import { ADMIN_PERMISSIONS, AdminPortalLayout } from '../components/AdminPortalLayout';

export default function DatasourcesRoute() {
  return (
    <AdminPortalLayout access={ADMIN_PERMISSIONS.olap}>
      <AdminDatasourcesPage />
    </AdminPortalLayout>
  );
}
