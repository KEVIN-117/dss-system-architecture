'use client';

import * as React from 'react';
import { Pencil, Plus, RefreshCw, Search, Trash2, Users } from 'lucide-react';
import { Badge } from '../../atoms/badge';
import { Button } from '../../atoms/button';
import { Checkbox } from '../../atoms/checkbox';
import { Input } from '../../atoms/input';
import { Skeleton } from '../../atoms/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../molecules/dialog';
import { FormField } from '../../molecules/form-field';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../molecules/table';
import type { AdminUserDraft, AdminUserRecord } from './types';

export interface AdminUsersProps {
  users: AdminUserRecord[];
  loading?: boolean;
  error?: string | null;
  onRefresh?: () => void;
  onCreate: (user: AdminUserDraft) => void | Promise<void>;
  onUpdate: (user: AdminUserDraft) => void | Promise<void>;
  onDelete: (user: AdminUserRecord) => void | Promise<void>;
}

const ROLE_OPTIONS = ['ROLE_USER', 'ROLE_ADMIN'];

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function AdminUsers({
  users,
  loading = false,
  error,
  onRefresh,
  onCreate,
  onUpdate,
  onDelete,
}: AdminUsersProps) {
  const [query, setQuery] = React.useState('');
  const [draft, setDraft] = React.useState<AdminUserDraft | null>(null);
  const [deleting, setDeleting] = React.useState<AdminUserRecord | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [removing, setRemoving] = React.useState(false);
  const [mutationError, setMutationError] = React.useState<string | null>(null);
  const isNew = draft?.id === 0;
  const filteredUsers = users.filter((user) =>
    `${user.username} ${user.email ?? ''} ${user.roles.join(' ')}`
      .toLowerCase()
      .includes(query.trim().toLowerCase()),
  );

  const save = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!draft) return;
    setSaving(true);
    setMutationError(null);
    try {
      if (isNew) await onCreate(draft);
      else await onUpdate(draft);
      setDraft(null);
    } catch (cause) {
      setMutationError(errorMessage(cause));
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!deleting) return;
    setRemoving(true);
    setMutationError(null);
    try {
      await onDelete(deleting);
      setDeleting(null);
    } catch (cause) {
      setMutationError(errorMessage(cause));
    } finally {
      setRemoving(false);
    }
  };

  return (
    <section className="space-y-6" aria-labelledby="admin-users-title">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
            <Users className="size-4" />
            Account directory
          </div>
          <h1
            id="admin-users-title"
            className="text-2xl font-semibold tracking-tight"
          >
            Users
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Manage Saiku directory accounts and their application roles.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={onRefresh}
            disabled={!onRefresh || loading}
          >
            <RefreshCw className="size-4" />
            Refresh
          </Button>
          <Button
            onClick={() => {
              setMutationError(null);
              setDraft({
                id: 0,
                username: '',
                email: '',
                password: '',
                roles: ['ROLE_USER'],
              });
            }}
          >
            <Plus className="size-4" />
            Add user
          </Button>
        </div>
      </header>

      {error && (
        <div
          role="alert"
          className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive"
        >
          <p className="font-medium">Users could not be loaded</p>
          <p className="mt-1 whitespace-pre-wrap">{error}</p>
          <Button
            className="mt-3"
            variant="outline"
            size="sm"
            onClick={onRefresh}
          >
            Try again
          </Button>
        </div>
      )}
      <div className="rounded-xl border border-border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
          <div>
            <h2 className="font-medium">Account directory</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {loading
                ? 'Loading accounts…'
                : `${filteredUsers.length} ${filteredUsers.length === 1 ? 'account' : 'accounts'}`}
            </p>
          </div>
          <div className="w-full sm:w-72">
            <Input
              aria-label="Search users"
              iconLeft={<Search className="size-4" />}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search name, email, or role"
            />
          </div>
        </div>
        {loading ? (
          <div className="space-y-3 p-4" aria-label="Loading users">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Username</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Roles</TableHead>
                <TableHead className="w-32 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.username}</TableCell>
                  <TableCell className="font-sans text-muted-foreground">
                    {user.email || '—'}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1.5">
                      {user.roles.map((role) => (
                        <Badge
                          variant={
                            role === 'ROLE_ADMIN' ? 'default' : 'secondary'
                          }
                          key={role}
                        >
                          {role.replace(/^ROLE_/, '')}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button
                        aria-label={`Edit ${user.username}`}
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => {
                          setMutationError(null);
                          setDraft({ ...user, password: '' });
                        }}
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        aria-label={`Delete ${user.username}`}
                        variant="ghost"
                        size="icon-sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => {
                          setMutationError(null);
                          setDeleting(user);
                        }}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filteredUsers.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="h-32 text-center font-sans text-muted-foreground"
                  >
                    {users.length === 0
                      ? 'No Saiku users yet.'
                      : 'No users match your search.'}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </div>

      <Dialog
        open={draft !== null}
        onOpenChange={(open: boolean) => {
          if (!open && !saving) {
            setDraft(null);
            setMutationError(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {isNew ? 'Add user' : `Edit ${draft?.username}`}
            </DialogTitle>
            <DialogDescription>
              {isNew
                ? 'Create a directory account and choose its Saiku roles.'
                : 'Update the directory contact and role assignments.'}
            </DialogDescription>
          </DialogHeader>
          {draft && (
            <form
              id="admin-user-form"
              onSubmit={(event) => void save(event)}
              className="space-y-4"
            >
              <FormField
                label="Username"
                htmlFor="admin-user-username"
                required
              >
                <Input
                  id="admin-user-username"
                  autoComplete="username"
                  value={draft.username}
                  onChange={(event) =>
                    setDraft({ ...draft, username: event.target.value })
                  }
                  disabled={!isNew}
                  required
                />
              </FormField>
              <FormField label="Email" htmlFor="admin-user-email">
                <Input
                  id="admin-user-email"
                  type="email"
                  autoComplete="email"
                  value={draft.email ?? ''}
                  onChange={(event) =>
                    setDraft({ ...draft, email: event.target.value })
                  }
                />
              </FormField>
              {isNew && (
                <FormField
                  label="Initial password"
                  htmlFor="admin-user-password"
                  description="This directory does not provision sign-in credentials. The account must also be configured in the Saiku authentication store before it can sign in."
                >
                  <Input
                    id="admin-user-password"
                    type="password"
                    autoComplete="new-password"
                    value={draft.password ?? ''}
                    onChange={(event) =>
                      setDraft({ ...draft, password: event.target.value })
                    }
                  />
                </FormField>
              )}
              <fieldset className="space-y-2">
                <legend className="text-sm font-medium">Roles</legend>
                {ROLE_OPTIONS.map((role) => (
                  <label key={role} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={draft.roles.includes(role)}
                      onCheckedChange={(checked: boolean | 'indeterminate') =>
                        setDraft({
                          ...draft,
                          roles: checked
                            ? [...draft.roles, role]
                            : draft.roles.filter((item) => item !== role),
                        })
                      }
                    />
                    {role}
                  </label>
                ))}
              </fieldset>
              {mutationError && (
                <p
                  role="alert"
                  className="whitespace-pre-wrap text-sm text-destructive"
                >
                  {mutationError}
                </p>
              )}
            </form>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDraft(null)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              form="admin-user-form"
              loading={saving}
              disabled={!draft?.username.trim()}
            >
              Save user
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={deleting !== null}
        onOpenChange={(open: boolean) => {
          if (!open && !removing) {
            setDeleting(null);
            setMutationError(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete user?</DialogTitle>
            <DialogDescription>
              This removes <strong>{deleting?.username}</strong> from the Saiku
              directory. The change cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {mutationError && (
            <p
              role="alert"
              className="whitespace-pre-wrap text-sm text-destructive"
            >
              {mutationError}
            </p>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleting(null)}
              disabled={removing}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => void remove()}
              loading={removing}
            >
              Delete user
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
