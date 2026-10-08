'use client';

import * as React from 'react';
import {
  AdminUsers,
  type AdminUserDraft,
  type AdminUserRecord,
} from '@dss-monorepo/design-system';
import {
  createSaikuUser,
  deleteSaikuUser,
  listSaikuUsers,
  updateSaikuUser,
  type SaikuAdminUser,
} from '../data-access/saiku-admin';

export function AdminUsersPage() {
  const [users, setUsers] = React.useState<AdminUserRecord[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const refresh = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const records = await listSaikuUsers();
      setUsers(
        records.map(({ id, username, email, roles }) => ({
          id,
          username,
          email,
          roles,
        })),
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

  const create = async (draft: AdminUserDraft) => {
    await createSaikuUser(toSaikuUser(draft));
    await refresh();
  };
  const update = async (draft: AdminUserDraft) => {
    await updateSaikuUser(toSaikuUser(draft));
    await refresh();
  };
  const remove = async (user: AdminUserRecord) => {
    await deleteSaikuUser(user.username);
    await refresh();
  };

  return (
    <AdminUsers
      users={users}
      loading={loading}
      error={error}
      onRefresh={() => void refresh()}
      onCreate={create}
      onUpdate={update}
      onDelete={remove}
    />
  );
}

function toSaikuUser(user: AdminUserDraft): SaikuAdminUser {
  return {
    id: user.id,
    username: user.username.trim(),
    email: user.email?.trim() || '',
    password: user.password ?? '',
    roles: user.roles,
  };
}
