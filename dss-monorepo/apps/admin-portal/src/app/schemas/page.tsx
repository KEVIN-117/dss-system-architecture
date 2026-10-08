import { AdminSchemasPage } from '../components/AdminSchemasPage';
import { AdminPortalLayout } from '../components/AdminPortalLayout';

export default function SchemasRoute() {
  return (
    <AdminPortalLayout>
      <AdminSchemasPage />
    </AdminPortalLayout>
  );
}
