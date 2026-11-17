import { AdminModelRegistryPage } from '../components/AdminModelRegistryPage';
import { AdminPortalLayout } from '../components/AdminPortalLayout';

export default function MlRegistryRoute() {
  return (
    <AdminPortalLayout>
      <AdminModelRegistryPage />
    </AdminPortalLayout>
  );
}
