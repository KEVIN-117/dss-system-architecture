import { AdminSchemasPage } from '../components/AdminSchemasPage';
import { ADMIN_PERMISSIONS, AdminPortalLayout } from '../components/AdminPortalLayout';

export default function SchemasRoute() {
  return (
    <AdminPortalLayout access={ADMIN_PERMISSIONS.olap}>
      <AdminSchemasPage />
    </AdminPortalLayout>
  );
}
