import { AdminAuditPage } from '../components/AdminAuditPage';
import { ADMIN_PERMISSIONS, AdminPortalLayout } from '../components/AdminPortalLayout';

export default function AuditRoute() {
  return (
    <AdminPortalLayout access={ADMIN_PERMISSIONS.audit}>
      <AdminAuditPage />
    </AdminPortalLayout>
  );
}
