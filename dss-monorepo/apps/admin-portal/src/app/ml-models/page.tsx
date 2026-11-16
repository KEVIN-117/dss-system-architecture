import { AdminModelValidationPage } from '../components/AdminModelValidationPage';
import { AdminPortalLayout } from '../components/AdminPortalLayout';

export default function MlModelsRoute() {
  return (
    <AdminPortalLayout>
      <AdminModelValidationPage />
    </AdminPortalLayout>
  );
}
