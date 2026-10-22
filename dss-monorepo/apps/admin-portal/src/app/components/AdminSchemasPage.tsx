'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  AdminSchemas,
  type AdminSchemaRecord,
} from '@dss-monorepo/design-system';
import {
  deleteOlapSchema,
  listOlapSchemas,
  uploadOlapSchema,
} from '../data-access/olap-admin';

export function AdminSchemasPage() {
  const router = useRouter();
  const [schemas, setSchemas] = React.useState<AdminSchemaRecord[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const refresh = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const records = await listOlapSchemas();
      setSchemas(
        records.map(({ id, name, path, type }) => ({ id, name, path, type })),
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  const upload = async (name: string, xml: string) => {
    await uploadOlapSchema(name, xml);
    await refresh();
  };
  const remove = async (schema: AdminSchemaRecord) => {
    const id = schema.id ?? schema.name;
    await deleteOlapSchema(id);
    await refresh();
  };

  return (
    <AdminSchemas
      schemas={schemas}
      loading={loading}
      error={error}
      onRefresh={() => void refresh()}
      onView={(schema) =>
        router.push(`/schemas/${encodeURIComponent(schema.name)}`)
      }
      onUpload={upload}
      onDelete={remove}
    />
  );
}
