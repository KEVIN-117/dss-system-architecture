import { MlForecastsPage } from '../components/ml/MlForecastsPage';
import { ADMIN_PERMISSIONS, AdminPortalLayout } from '../components/AdminPortalLayout';

export default function MlForecastsRoute() {
  return (
    <AdminPortalLayout access={ADMIN_PERMISSIONS.ml}>
      <MlForecastsPage />
    </AdminPortalLayout>
  );
}
