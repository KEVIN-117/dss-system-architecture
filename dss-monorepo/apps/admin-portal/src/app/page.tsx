import { AdminOverviewPage } from './components/AdminOverviewPage';
import { AdminPortalLayout } from './components/AdminPortalLayout';

export default function Index() {
  return (
    <AdminPortalLayout>
      <AdminOverviewPage />
    </AdminPortalLayout>
  );
}
