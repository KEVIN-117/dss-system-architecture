'use client';

import * as React from 'react';
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Loader,
  Select,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@dss-monorepo/design-system';
import { Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { useHasPermission } from '@dss-monorepo/rbac';
import { DSS_APPS, dssAppById, type IamRolePortal } from '@dss-monorepo/auth-models';
import {
  ROLE_NAME_PATTERN,
  createRole,
  deleteRole,
  listRoles,
  updateRole,
  type IamRole,
} from '../data-access/iam-access';
import { DeleteInUseDialog } from './DeleteInUseDialog';

/** Shown for roles without an application: their holders cannot open any portal (IAM-022). */
export const NO_APP_WARNING = 'Sin aplicación: nadie podrá entrar con este rol';

/** Roles of the realm (IAM-017): create, describe, choose their application (IAM-022) and delete. */
export function AdminRolesPage() {
  const canWrite = useHasPermission('iam:roles:write');
  const [roles, setRoles] = React.useState<IamRole[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [editing, setEditing] = React.useState<IamRole | 'new' | null>(null);
  const [deleting, setDeleting] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);

  const load = React.useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    try {
      const result = await listRoles(signal);
      setRoles([...result].sort((left, right) => left.name.localeCompare(right.name)));
    } catch (cause) {
      if (signal?.aborted) return;
      setError(cause instanceof Error ? cause.message : 'No se pudieron cargar los roles.');
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  return (
    <section className="space-y-6" aria-labelledby="admin-roles-title">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <p className="text-sm font-medium text-muted-foreground">Administración · servicio de autenticación</p>
          <h1 id="admin-roles-title" className="text-2xl font-semibold tracking-tight">Roles</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Un rol agrupa permisos y decide a qué aplicación entra quien lo tiene. Qué permisos tiene cada rol se
            edita en la matriz de acceso.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => void load()} disabled={loading}>
            <RefreshCw aria-hidden="true" className="size-4" />
            Actualizar
          </Button>
          {canWrite && (
            <Button onClick={() => setEditing('new')}>
              <Plus aria-hidden="true" className="size-4" />
              Nuevo rol
            </Button>
          )}
        </div>
      </header>

      {notice && (
        <div role="status" className="flex items-center justify-between gap-2 rounded-lg border bg-muted/30 p-3 text-sm">
          <p>{notice}</p>
          <Button variant="ghost" size="sm" onClick={() => setNotice(null)}>Cerrar aviso</Button>
        </div>
      )}
      {error && (
        <div role="alert" className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          <p className="font-medium">No se pudieron cargar los roles</p>
          <p className="mt-1">{error}</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => void load()}>Reintentar</Button>
        </div>
      )}

      <div className="rounded-xl border border-border bg-card" aria-busy={loading}>
        <Table aria-label="Roles del realm">
          <TableHeader>
            <TableRow>
              <TableHead>Rol</TableHead>
              <TableHead>Descripción</TableHead>
              <TableHead>Aplicación</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {roles.map((role) => (
              <TableRow key={role.name}>
                <TableCell className="font-mono text-sm">
                  <span className="flex flex-wrap items-center gap-2">
                    {role.name}
                    {role.system && <Badge variant="outline">Sistema</Badge>}
                  </span>
                </TableCell>
                <TableCell className="font-sans text-sm text-muted-foreground">{role.description || '—'}</TableCell>
                <TableCell className="font-sans text-sm">
                  {dssAppById(role.portal)?.label ?? (
                    <span className="text-amber-700 dark:text-amber-400">{NO_APP_WARNING}</span>
                  )}
                </TableCell>
                <TableCell>
                  {canWrite && (
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="sm" aria-label={`Editar ${role.name}`} onClick={() => setEditing(role)}>
                        <Pencil aria-hidden="true" className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label={`Eliminar ${role.name}`}
                        disabled={role.system}
                        title={role.system ? 'Los roles del sistema se pueden editar, pero no eliminar.' : undefined}
                        onClick={() => setDeleting(role.name)}
                      >
                        <Trash2 aria-hidden="true" className="size-4" />
                      </Button>
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {!loading && roles.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="h-24 text-center font-sans text-muted-foreground">
                  {error ? 'Verifica la conexión e inténtalo de nuevo.' : 'No hay roles.'}
                </TableCell>
              </TableRow>
            )}
            {loading && roles.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} role="status">
                  <Loader text="Cargando roles…" fullScreen={false} className="min-h-24" />
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {canWrite && (
        <RoleFormDialog
          role={editing}
          onClose={() => setEditing(null)}
          onSaved={(saved, created) => {
            setNotice(created ? `Rol ${saved.name} creado. Asígnale permisos en la matriz de acceso.` : `Rol ${saved.name} actualizado.`);
            void load();
          }}
        />
      )}
      <DeleteInUseDialog
        kind="rol"
        name={deleting}
        onDelete={deleteRole}
        onDeleted={(name) => {
          setNotice(`Rol ${name} eliminado.`);
          setRoles((current) => current.filter((role) => role.name !== name));
        }}
        onClose={() => setDeleting(null)}
      />
    </section>
  );
}

function RoleFormDialog({ role, onClose, onSaved }: {
  role: IamRole | 'new' | null;
  onClose: () => void;
  onSaved: (role: IamRole, created: boolean) => void;
}) {
  const creating = role === 'new';
  const systemRole = role !== null && role !== 'new' && role.system;
  const [name, setName] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [portal, setPortal] = React.useState<IamRolePortal | ''>('');
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (role === null) return;
    setName(role === 'new' ? '' : role.name);
    setDescription(role === 'new' ? '' : role.description ?? '');
    setPortal(role === 'new' ? '' : dssAppById(role.portal)?.id ?? '');
    setError(null);
  }, [role]);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (creating && !ROLE_NAME_PATTERN.test(name.trim())) {
      setError('El nombre usa MAYÚSCULAS, números y guion bajo, empieza con una letra y tiene de 2 a 50 caracteres.');
      return;
    }
    if (creating && !portal) {
      setError('Elige la aplicación a la que entrará quien tenga el rol.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const saved = creating
        ? await createRole({ name, description, portal: portal as IamRolePortal })
        : await updateRole((role as IamRole).name, { description, portal });
      onSaved(saved, creating);
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo guardar el rol.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={role !== null} onOpenChange={(open) => !open && !saving && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{creating ? 'Nuevo rol' : `Editar ${(role as IamRole | null)?.name ?? ''}`}</DialogTitle>
          <DialogDescription>
            {creating ? 'El nombre no se puede cambiar después.' : 'El nombre de un rol no se puede cambiar.'}
          </DialogDescription>
        </DialogHeader>
        <form id="role-form" onSubmit={(event) => void submit(event)} className="space-y-4" noValidate>
          {creating && (
            <div className="space-y-1.5">
              <label htmlFor="role-name" className="text-sm font-medium">Nombre <span aria-hidden="true">*</span></label>
              <Input
                id="role-name"
                required
                value={name}
                onChange={(event) => setName(event.target.value.toUpperCase())}
                placeholder="VICERRECTOR"
                aria-describedby="role-name-hint"
              />
              <p id="role-name-hint" className="text-xs text-muted-foreground">MAYÚSCULAS, números y guion bajo.</p>
            </div>
          )}
          <div className="space-y-1.5">
            <label htmlFor="role-description" className="text-sm font-medium">Descripción</label>
            <Input id="role-description" maxLength={255} value={description} onChange={(event) => setDescription(event.target.value)} />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="role-portal" className="text-sm font-medium">Aplicación <span aria-hidden="true">*</span></label>
            <Select
              id="role-portal"
              required
              value={portal}
              disabled={systemRole}
              onChange={(event) => setPortal(event.target.value as IamRolePortal | '')}
              aria-describedby="role-portal-hint"
            >
              <option value="" disabled={!creating && portal !== ''}>Elige una aplicación</option>
              {DSS_APPS.map((app) => (
                <option key={app.id} value={app.id}>{app.label}</option>
              ))}
            </Select>
            <p id="role-portal-hint" className="text-xs text-muted-foreground">
              {systemRole
                ? 'Los roles del sistema conservan su aplicación.'
                : 'Aplicación a la que entra quien tiene el rol. Cada rol abre una sola.'}
            </p>
            {!creating && !portal && <p className="text-xs text-amber-700 dark:text-amber-400">{NO_APP_WARNING}.</p>}
          </div>
          {error && (
            <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{error}</p>
          )}
        </form>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button type="submit" form="role-form" loading={saving} disabled={saving}>
            {creating ? 'Crear rol' : 'Guardar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
