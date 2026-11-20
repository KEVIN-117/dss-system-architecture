import { ADMIN_PERMISSIONS, AdminPortalLayout } from '../../components/AdminPortalLayout';
import { AdminSchemaDetailPage } from '../../components/AdminSchemaDetailPage';

interface SchemaDetailRouteProps {
  params: Promise<{ schemaId: string }>;
}

export default async function SchemaDetailRoute({
  params,
}: SchemaDetailRouteProps) {
  const { schemaId } = await params;
  return (
    <AdminPortalLayout access={ADMIN_PERMISSIONS.olap}>
      <AdminSchemaDetailPage schemaId={schemaId} />
    </AdminPortalLayout>
  );
}
