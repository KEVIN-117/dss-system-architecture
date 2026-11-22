import { AdminAcademicClosuresPage } from '../components/AdminAcademicClosuresPage';
import { ADMIN_PERMISSIONS, AdminPortalLayout } from '../components/AdminPortalLayout';

export default function AcademicClosuresRoute() {
  return (
    <AdminPortalLayout access={ADMIN_PERMISSIONS.closures}>
      <AdminAcademicClosuresPage />
    </AdminPortalLayout>
  );
}
