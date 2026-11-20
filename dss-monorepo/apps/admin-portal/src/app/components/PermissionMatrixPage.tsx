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
  Loader,
} from '@dss-monorepo/design-system';
import { RefreshCw, Undo2 } from 'lucide-react';
import { useHasPermission } from '@dss-monorepo/rbac';
import {
  getPermissionMatrix,
  groupByResource,
  replaceRolePermissions,
  type IamPermission,
  type IamRole,
} from '../data-access/iam-access';

type Grants = Record<string, Set<string>>;

export interface RoleChange {
  role: string;
  added: string[];
  removed: string[];
}

/** Roles whose draft differs from what Keycloak has, with what each gains and loses. */
export function pendingChanges(original: Grants, draft: Grants): RoleChange[] {
  return Object.keys(draft)
    .sort((left, right) => left.localeCompare(right))
    .map((role) => {
      const before = original[role] ?? new Set<string>();
      const after = draft[role];
      return {
        role,
        added: [...after].filter((name) => !before.has(name)).sort(),
        removed: [...before].filter((name) => !after.has(name)).sort(),
      };
    })
    .filter((change) => change.added.length > 0 || change.removed.length > 0);
}

const toGrants = (grants: Record<string, string[]>, roles: IamRole[]): Grants =>
  Object.fromEntries(roles.map((role) => [role.name, new Set(grants[role.name] ?? [])]));

const copyGrants = (grants: Grants): Grants =>
  Object.fromEntries(Object.entries(grants).map(([role, names]) => [role, new Set(names)]));

/** SUPERADMIN must keep the IAM permissions; auth-service refuses it too (409). */
const isLocked = (role: string, permission: string) => role === 'SUPERADMIN' && permission.startsWith('iam:');

/**
 * Role × permission matrix (IAM-017). Edits stay local until reviewed: the preview lists what each role
 * gains and loses, and saving replaces the permissions of each changed role, one after the other.
 */
export function PermissionMatrixPage() {
  const canWrite = useHasPermission('iam:roles:write');
  const [roles, setRoles] = React.useState<IamRole[]>([]);
  const [permissions, setPermissions] = React.useState<IamPermission[]>([]);
  const [original, setOriginal] = React.useState<Grants>({});
  const [draft, setDraft] = React.useState<Grants>({});
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [reviewing, setReviewing] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [failures, setFailures] = React.useState<Array<{ role: string; message: string }>>([]);
  const [notice, setNotice] = React.useState<string | null>(null);

  const load = React.useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    try {
      const matrix = await getPermissionMatrix(signal);
      const sortedRoles = [...matrix.roles].sort((left, right) => left.name.localeCompare(right.name));
      const grants = toGrants(matrix.grants, sortedRoles);
      setRoles(sortedRoles);
      setPermissions(matrix.permissions);
      setOriginal(grants);
      setDraft(copyGrants(grants));
    } catch (cause) {
      if (signal?.aborted) return;
      setError(cause instanceof Error ? cause.message : 'No se pudo cargar la matriz de permisos.');
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const changes = React.useMemo(() => pendingChanges(original, draft), [original, draft]);
  const changeCount = changes.reduce((total, change) => total + change.added.length + change.removed.length, 0);
  const groups = groupByResource(permissions);

  const toggle = (role: string, permission: string, granted: boolean) => {
    setDraft((current) => {
      const next = copyGrants(current);
      if (granted) next[role].add(permission);
      else next[role].delete(permission);
      return next;
    });
  };

  const save = async () => {
    setSaving(true);
    setFailures([]);
    const failed: Array<{ role: string; message: string }> = [];
    let saved = 0;
    // One role at a time: a failure leaves the others saved and the failed role still pending.
    for (const change of changes) {
      try {
        const result = await replaceRolePermissions(change.role, [...draft[change.role]]);
        const names = new Set(result.map((item) => item.name));
        setOriginal((current) => ({ ...current, [change.role]: names }));
        setDraft((current) => ({ ...current, [change.role]: new Set(names) }));
        saved += 1;
      } catch (cause) {
        failed.push({
          role: change.role,
          message: cause instanceof Error ? cause.message : `No se pudieron guardar los permisos de ${change.role}.`,
        });
      }
    }
    setSaving(false);
    setFailures(failed);
    if (failed.length === 0) {
      setReviewing(false);
      setNotice(`Se guardaron los permisos de ${saved} ${saved === 1 ? 'rol' : 'roles'}. Los usuarios los verán al renovar su sesión.`);
    }
  };

  return (
    <section className="space-y-6" aria-labelledby="permission-matrix-title">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <p className="text-sm font-medium text-muted-foreground">Administración · servicio de autenticación</p>
          <h1 id="permission-matrix-title" className="text-2xl font-semibold tracking-tight">Matriz de acceso</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Marca qué permisos agrupa cada rol. Los cambios no se aplican hasta que los revises y guardes.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => void load()} disabled={loading || changeCount > 0}>
            <RefreshCw aria-hidden="true" className="size-4" />
            Actualizar
          </Button>
          {canWrite && (
            <>
              <Button
                variant="outline"
                onClick={() => {
                  setDraft(copyGrants(original));
                  setFailures([]);
                }}
                disabled={changeCount === 0 || saving}
              >
                <Undo2 aria-hidden="true" className="size-4" />
                Descartar
              </Button>
              <Button onClick={() => { setFailures([]); setReviewing(true); }} disabled={changeCount === 0}>
                Revisar cambios ({changeCount})
              </Button>
            </>
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
          <p className="font-medium">No se pudo cargar la matriz</p>
          <p className="mt-1">{error}</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => void load()}>Reintentar</Button>
        </div>
      )}
      {loading && roles.length === 0 && (
        <div role="status"><Loader text="Cargando matriz…" fullScreen={false} className="min-h-32" /></div>
      )}

      {roles.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table aria-label="Matriz de roles y permisos" className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-border">
                <th scope="col" className="sticky left-0 z-10 bg-card px-4 py-3 text-left font-medium">Permiso</th>
                {roles.map((role) => (
                  <th key={role.name} scope="col" className="px-3 py-3 text-center font-mono text-xs font-medium">
                    {role.name}
                  </th>
                ))}
              </tr>
            </thead>
            {groups.map((group) => (
              <tbody key={group.resource}>
                <tr className="bg-muted/40">
                  <th scope="rowgroup" colSpan={roles.length + 1} className="px-4 py-2 text-left font-mono text-xs font-semibold">
                    {group.resource}
                  </th>
                </tr>
                {group.permissions.map((permission) => (
                  <tr key={permission.name} className="border-b border-border/60">
                    <th scope="row" className="sticky left-0 z-10 bg-card px-4 py-2 text-left font-normal">
                      <span className="block font-mono text-xs">{permission.name}</span>
                      {permission.description && (
                        <span className="block text-xs text-muted-foreground">{permission.description}</span>
                      )}
                    </th>
                    {roles.map((role) => {
                      const checked = draft[role.name]?.has(permission.name) ?? false;
                      const changed = checked !== (original[role.name]?.has(permission.name) ?? false);
                      const locked = checked && isLocked(role.name, permission.name);
                      return (
                        <td key={role.name} className={`px-3 py-2 text-center ${changed ? 'bg-amber-500/15' : ''}`}>
                          <input
                            type="checkbox"
                            className="size-4 accent-primary"
                            aria-label={`${role.name} · ${permission.name}`}
                            checked={checked}
                            disabled={!canWrite || saving || locked}
                            title={locked ? 'SUPERADMIN debe conservar los permisos iam:*.' : undefined}
                            onChange={(event) => toggle(role.name, permission.name, event.target.checked)}
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            ))}
          </table>
        </div>
      )}

      <Dialog open={reviewing} onOpenChange={(open) => !open && !saving && setReviewing(false)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Revisar cambios</DialogTitle>
            <DialogDescription>
              Se reemplazan los permisos de {changes.length} {changes.length === 1 ? 'rol' : 'roles'}. Quienes
              tienen esos roles verán el cambio al renovar su sesión.
            </DialogDescription>
          </DialogHeader>
          <ul className="max-h-80 space-y-3 overflow-y-auto" aria-label="Cambios pendientes">
            {changes.map((change) => (
              <li key={change.role} className="rounded-lg border border-border p-3">
                <p className="font-mono text-sm font-semibold">{change.role}</p>
                <ul className="mt-2 space-y-1 text-sm">
                  {change.added.map((name) => (
                    <li key={`+${name}`} className="flex items-center gap-2">
                      <Badge variant="outline" className="text-emerald-700 dark:text-emerald-400">Agrega</Badge>
                      <span className="font-mono text-xs">{name}</span>
                    </li>
                  ))}
                  {change.removed.map((name) => (
                    <li key={`-${name}`} className="flex items-center gap-2">
                      <Badge variant="outline" className="text-destructive">Quita</Badge>
                      <span className="font-mono text-xs">{name}</span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
          {failures.length > 0 && (
            <div role="alert" className="space-y-1 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              <p className="font-medium">Algunos roles no se guardaron; siguen pendientes:</p>
              <ul className="list-disc pl-5">
                {failures.map((failure) => (
                  <li key={failure.role}><span className="font-mono">{failure.role}</span>: {failure.message}</li>
                ))}
              </ul>
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setReviewing(false)} disabled={saving}>Seguir editando</Button>
            <Button type="button" loading={saving} disabled={saving || changes.length === 0} onClick={() => void save()}>
              Guardar cambios
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
