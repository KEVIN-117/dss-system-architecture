import { AdminAcademicClosuresPage } from '../components/AdminAcademicClosuresPage';
import { AdminPortalLayout } from '../components/AdminPortalLayout';

export default function AcademicClosuresRoute() {
  return (
    <AdminPortalLayout access="authenticated">
      <AdminAcademicClosuresPage />
    </AdminPortalLayout>
  );
}
