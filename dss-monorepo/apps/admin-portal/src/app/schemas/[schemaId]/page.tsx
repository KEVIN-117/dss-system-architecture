import { AdminPortalLayout } from '../../components/AdminPortalLayout';
import { AdminSchemaDetailPage } from '../../components/AdminSchemaDetailPage';

interface SchemaDetailRouteProps {
  params: Promise<{ schemaId: string }>;
}

export default async function SchemaDetailRoute({
  params,
}: SchemaDetailRouteProps) {
  const { schemaId } = await params;
  return (
    <AdminPortalLayout>
      <AdminSchemaDetailPage schemaId={schemaId} />
    </AdminPortalLayout>
  );
}
