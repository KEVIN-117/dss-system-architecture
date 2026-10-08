'use client';

import * as React from 'react';
import {
  AdminSchemas,
  type AdminSchemaRecord,
} from '@dss-monorepo/design-system';
import {
  deleteSaikuSchema,
  listSaikuSchemas,
  uploadSaikuSchema,
} from '../data-access/saiku-admin';

export function AdminSchemasPage() {
  const [schemas, setSchemas] = React.useState<AdminSchemaRecord[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const refresh = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const records = await listSaikuSchemas();
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
    await uploadSaikuSchema(name, xml);
    await refresh();
  };
  const remove = async (schema: AdminSchemaRecord) => {
    const id = schema.id ?? schema.name;
    await deleteSaikuSchema(id);
    await refresh();
  };

  return (
    <AdminSchemas
      schemas={schemas}
      loading={loading}
      error={error}
      onRefresh={() => void refresh()}
      onUpload={upload}
      onDelete={remove}
    />
  );
}
