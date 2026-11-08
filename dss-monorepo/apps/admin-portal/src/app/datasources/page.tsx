import { AdminDatasourcesPage } from '../components/AdminDatasourcesPage';
import { AdminPortalLayout } from '../components/AdminPortalLayout';

export default function DatasourcesRoute() {
  return (
    <AdminPortalLayout>
      <AdminDatasourcesPage />
    </AdminPortalLayout>
  );
}
