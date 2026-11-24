import { MlStudioPage } from '../components/ml/studio/MlStudioPage';
import { ADMIN_PERMISSIONS, AdminPortalLayout } from '../components/AdminPortalLayout';

export default function MlStudioRoute() {
  return (
    <AdminPortalLayout access={ADMIN_PERMISSIONS.ml}>
      <MlStudioPage />
    </AdminPortalLayout>
  );
}
