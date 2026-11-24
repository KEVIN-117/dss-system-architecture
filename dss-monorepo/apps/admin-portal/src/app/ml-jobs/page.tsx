import { MlJobsPage } from '../components/ml/MlJobsPage';
import { ADMIN_PERMISSIONS, AdminPortalLayout } from '../components/AdminPortalLayout';

export default function MlJobsRoute() {
  return (
    <AdminPortalLayout access={ADMIN_PERMISSIONS.ml}>
      <MlJobsPage />
    </AdminPortalLayout>
  );
}
