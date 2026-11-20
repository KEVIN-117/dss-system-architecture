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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@dss-monorepo/design-system';
import { Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { useHasPermission } from '@dss-monorepo/rbac';
import {
  PERMISSION_NAME_PATTERN,
  createPermission,
  deletePermission,
  groupByResource,
  listPermissions,
  updatePermission,
  type IamPermission,
} from '../data-access/iam-access';
import { DeleteInUseDialog } from './DeleteInUseDialog';

/**
 * The permission catalog (`dss-permissions`, IAM-017), grouped by resource. A new permission reaches the
 * tokens of whoever gets it without deploying anything; a service still has to check it to take effect.
 */
export function AdminPermissionsPage() {
  // Permissions are managed with the role permissions (IAM-007): iam:roles:*.
  const canWrite = useHasPermission('iam:roles:write');
  const [permissions, setPermissions] = React.useState<IamPermission[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [editing, setEditing] = React.useState<IamPermission | 'new' | null>(null);
  const [deleting, setDeleting] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);

  const load = React.useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    try {
      setPermissions(await listPermissions(signal));
    } catch (cause) {
      if (signal?.aborted) return;
      setError(cause instanceof Error ? cause.message : 'No se pudieron cargar los permisos.');
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const groups = groupByResource(permissions);

  return (
    <section className="space-y-6" aria-labelledby="admin-permissions-title">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <p className="text-sm font-medium text-muted-foreground">Administración · servicio de autenticación</p>
          <h1 id="admin-permissions-title" className="text-2xl font-semibold tracking-tight">Permisos</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Cada permiso tiene la forma <code>recurso:acción</code>. Llega al token de quien lo recibe sin desplegar
            nada, pero solo tiene efecto cuando un servicio lo exige.
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
              Nuevo permiso
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
          <p className="font-medium">No se pudieron cargar los permisos</p>
          <p className="mt-1">{error}</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => void load()}>Reintentar</Button>
        </div>
      )}
      {loading && permissions.length === 0 && (
        <div role="status"><Loader text="Cargando permisos…" fullScreen={false} className="min-h-32" /></div>
      )}
      {!loading && !error && permissions.length === 0 && (
        <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">No hay permisos en el catálogo.</p>
      )}

      {groups.map((group) => (
        <section key={group.resource} aria-labelledby={`resource-${group.resource}`} className="rounded-xl border border-border bg-card">
          <h2 id={`resource-${group.resource}`} className="border-b border-border px-4 py-3 font-mono text-sm font-semibold">
            {group.resource}
          </h2>
          <Table aria-label={`Permisos de ${group.resource}`}>
            <TableHeader>
              <TableRow>
                <TableHead>Permiso</TableHead>
                <TableHead>Descripción</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {group.permissions.map((permission) => (
                <TableRow key={permission.name}>
                  <TableCell className="font-mono text-sm">
                    <span className="flex flex-wrap items-center gap-2">
                      {permission.name}
                      {permission.system && <Badge variant="outline">Sistema</Badge>}
                    </span>
                  </TableCell>
                  <TableCell className="font-sans text-sm text-muted-foreground">{permission.description || '—'}</TableCell>
                  <TableCell>
                    {canWrite && (
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" aria-label={`Editar ${permission.name}`} onClick={() => setEditing(permission)}>
                          <Pencil aria-hidden="true" className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label={`Eliminar ${permission.name}`}
                          disabled={permission.system}
                          title={permission.system ? 'Los permisos del sistema no se pueden eliminar.' : undefined}
                          onClick={() => setDeleting(permission.name)}
                        >
                          <Trash2 aria-hidden="true" className="size-4" />
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </section>
      ))}

      {canWrite && (
        <PermissionFormDialog
          permission={editing}
          onClose={() => setEditing(null)}
          onSaved={(saved, created) => {
            setNotice(created
              ? `Permiso ${saved.name} creado. Agrégalo a un rol en la matriz de acceso.`
              : `Permiso ${saved.name} actualizado.`);
            void load();
          }}
        />
      )}
      <DeleteInUseDialog
        kind="permiso"
        name={deleting}
        onDelete={deletePermission}
        onDeleted={(name) => {
          setNotice(`Permiso ${name} eliminado.`);
          setPermissions((current) => current.filter((permission) => permission.name !== name));
        }}
        onClose={() => setDeleting(null)}
      />
    </section>
  );
}

function PermissionFormDialog({ permission, onClose, onSaved }: {
  permission: IamPermission | 'new' | null;
  onClose: () => void;
  onSaved: (permission: IamPermission, created: boolean) => void;
}) {
  const creating = permission === 'new';
  const [name, setName] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (permission === null) return;
    setName(permission === 'new' ? '' : permission.name);
    setDescription(permission === 'new' ? '' : permission.description ?? '');
    setError(null);
  }, [permission]);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (creating && (trimmed.length > 100 || !PERMISSION_NAME_PATTERN.test(trimmed))) {
      setError('Usa el formato recurso:acción en minúsculas, por ejemplo reports:export o dw:closure:read.');
      return;
    }
    if (!description.trim()) {
      setError('Describe qué permite el permiso.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const saved = creating
        ? await createPermission(trimmed, description)
        : await updatePermission((permission as IamPermission).name, description);
      onSaved(saved, creating);
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo guardar el permiso.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={permission !== null} onOpenChange={(open) => !open && !saving && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{creating ? 'Nuevo permiso' : `Editar ${(permission as IamPermission | null)?.name ?? ''}`}</DialogTitle>
          <DialogDescription>
            {creating ? 'El nombre no se puede cambiar después.' : 'Solo se puede cambiar la descripción.'}
          </DialogDescription>
        </DialogHeader>
        <form id="permission-form" onSubmit={(event) => void submit(event)} className="space-y-4" noValidate>
          {creating && (
            <div className="space-y-1.5">
              <label htmlFor="permission-name" className="text-sm font-medium">Nombre <span aria-hidden="true">*</span></label>
              <Input
                id="permission-name"
                required
                value={name}
                onChange={(event) => setName(event.target.value.toLowerCase())}
                placeholder="reports:export"
                aria-describedby="permission-name-hint"
              />
              <p id="permission-name-hint" className="text-xs text-muted-foreground">
                recurso:acción en minúsculas; el recurso puede tener varios niveles (dw:closure:read).
              </p>
            </div>
          )}
          <div className="space-y-1.5">
            <label htmlFor="permission-description" className="text-sm font-medium">Descripción <span aria-hidden="true">*</span></label>
            <Input
              id="permission-description"
              required
              maxLength={255}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Exportar reportes institucionales"
            />
          </div>
          {error && (
            <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{error}</p>
          )}
        </form>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button type="submit" form="permission-form" loading={saving} disabled={saving}>
            {creating ? 'Crear permiso' : 'Guardar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
