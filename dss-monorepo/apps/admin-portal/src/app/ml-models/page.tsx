import { AdminModelValidationPage } from '../components/AdminModelValidationPage';
import { ADMIN_PERMISSIONS, AdminPortalLayout } from '../components/AdminPortalLayout';

export default function MlModelsRoute() {
  return (
    <AdminPortalLayout access={ADMIN_PERMISSIONS.ml}>
      <AdminModelValidationPage />
    </AdminPortalLayout>
  );
}
