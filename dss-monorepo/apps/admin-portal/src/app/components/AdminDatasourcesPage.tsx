'use client';

import * as React from 'react';
import {
  AdminDatasources,
  type AdminDatasourceDraft,
  type AdminDatasourceRecord,
} from '@dss-monorepo/design-system';
import {
  createOlapDatasource,
  deleteOlapDatasource,
  listOlapDatasources,
  refreshOlapDatasource,
  updateOlapDatasource,
  type OlapAdminDatasource,
} from '../data-access/olap-admin';

function toConnectorDatasource(
  datasource: AdminDatasourceDraft,
): OlapAdminDatasource {
  return {
    id: datasource.id,
    name: datasource.name,
    connectiontype: datasource.connectiontype,
    location: datasource.location,
    driver: datasource.driver,
    schemaName: datasource.schemaName,
    username: datasource.username,
    password: datasource.password,
    ossieYaml: datasource.ossieYaml,
  };
}

export function AdminDatasourcesPage() {
  const [datasources, setDatasources] = React.useState<AdminDatasourceRecord[]>(
    [],
  );
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const refresh = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await listOlapDatasources();
      setDatasources(
        rows.map(
          ({
            id,
            name,
            connectiontype,
            location,
            driver,
            schemaName,
            username,
            ossieYaml,
          }) => ({
            id,
            name,
            connectiontype,
            location,
            driver,
            schemaName,
            username,
            ossieYaml,
          }),
        ),
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

  const create = async (datasource: AdminDatasourceDraft) => {
    await createOlapDatasource(toConnectorDatasource(datasource));
    await refresh();
  };

  const update = async (datasource: AdminDatasourceDraft) => {
    await updateOlapDatasource(toConnectorDatasource(datasource));
    await refresh();
  };

  const remove = async (datasource: AdminDatasourceRecord) => {
    await deleteOlapDatasource(datasource.id);
    await refresh();
  };

  const reconnect = async (datasource: AdminDatasourceRecord) => {
    await refreshOlapDatasource(datasource.name);
    await refresh();
  };

  return (
    <AdminDatasources
      datasources={datasources}
      loading={loading}
      error={error}
      onRefresh={() => void refresh()}
      onCreate={create}
      onUpdate={update}
      onDelete={remove}
      onReconnect={reconnect}
    />
  );
}
