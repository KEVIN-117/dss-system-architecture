'use client';

import * as React from 'react';
import {
  Badge,
  Button,
  Checkbox,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Loader,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@dss-monorepo/design-system';
import { KeyRound, MailCheck, Power } from 'lucide-react';
import type { AcademicContext, AdminUserDirectoryEntry } from '../data-access/auth-admin';
import {
  getIamUserPermissions,
  getIamUserRoles,
  listIamPermissions,
  listIamRoles,
  replaceIamUserPermissions,
  replaceIamUserRoles,
  sendIamActionsEmail,
  setIamUserEnabled,
  type IamAssignments,
  type IamRequiredAction,
} from '../data-access/iam-users';
import { AcademicContextsPanel } from './AcademicContextsPanel';
import { personName } from './user-roles';

export type UserManagementTab = 'account' | 'roles' | 'permissions' | 'contexts';

interface UserManagementSheetProps {
  user: AdminUserDirectoryEntry | null;
  /** `iam:users:write`: without it the sheet is read-only. */
  canWrite: boolean;
  initialTab?: UserManagementTab;
  onClose: () => void;
  /** The user changed in auth-service; the directory should reload it. */
  onChanged: (change: Partial<AdminUserDirectoryEntry>) => void;
}

/** Account, roles, permissions and academic contexts of one user (IAM-016). */
export function UserManagementSheet({ user, canWrite, initialTab = 'account', onClose, onChanged }: UserManagementSheetProps) {
  const [tab, setTab] = React.useState<UserManagementTab>(initialTab);
  React.useEffect(() => {
    if (user) setTab(initialTab);
  }, [initialTab, user]);

  return (
    <Sheet open={user !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" showCloseButton={false} className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader className="border-b border-border px-6 pt-6">
          <SheetTitle>Gestionar usuario</SheetTitle>
          <SheetDescription>
            {user ? `${personName(user)} (@${user.username}) · ${user.email || 'sin correo'}` : 'Usuario seleccionado'}
          </SheetDescription>
          {user && !canWrite && (
            <p className="text-xs text-muted-foreground">
              Vista de solo lectura: tu cuenta no tiene el permiso iam:users:write.
            </p>
          )}
        </SheetHeader>
        {user && (
          <Tabs value={tab} onValueChange={(value) => setTab(value as UserManagementTab)} className="px-6">
            <TabsList aria-label="Secciones del usuario" className="w-full justify-start overflow-x-auto">
              <TabsTrigger value="account">Cuenta</TabsTrigger>
              <TabsTrigger value="roles">Roles</TabsTrigger>
              <TabsTrigger value="permissions">Permisos</TabsTrigger>
              <TabsTrigger value="contexts">Contextos</TabsTrigger>
            </TabsList>
            <TabsContent value="account" className="pt-4">
              <AccountPanel user={user} canWrite={canWrite} onChanged={onChanged} />
            </TabsContent>
            <TabsContent value="roles" className="pt-4">
              <AssignmentsPanel
                key={`roles-${user.id}`}
                kind="roles"
                userId={user.id}
                canWrite={canWrite}
                onSaved={(assignments) => onChanged({ roles: assignments.effective.map((role) => role.name) })}
              />
            </TabsContent>
            <TabsContent value="permissions" className="pt-4">
              <AssignmentsPanel key={`permissions-${user.id}`} kind="permissions" userId={user.id} canWrite={canWrite} />
            </TabsContent>
            <TabsContent value="contexts" className="pt-4">
              <AcademicContextsPanel
                user={user}
                canWrite={canWrite}
                onSaved={(academicContexts: AcademicContext[]) => onChanged({ academicContexts })}
              />
            </TabsContent>
          </Tabs>
        )}
        <SheetFooter className="border-t border-border px-6 pb-6">
          <Button type="button" variant="outline" onClick={onClose}>Cerrar</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

// ---- account ----------------------------------------------------------------------------------------------

function AccountPanel({ user, canWrite, onChanged }: {
  user: AdminUserDirectoryEntry;
  canWrite: boolean;
  onChanged: (change: Partial<AdminUserDirectoryEntry>) => void;
}) {
  const [confirming, setConfirming] = React.useState(false);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [message, setMessage] = React.useState<string | null>(null);

  React.useEffect(() => {
    setError(null);
    setMessage(null);
  }, [user.id]);

  const run = async (label: string, action: () => Promise<void>, done: string) => {
    setBusy(label);
    setError(null);
    setMessage(null);
    try {
      await action();
      setMessage(done);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo completar la operación.');
    } finally {
      setBusy(null);
    }
  };

  // The confirmation closes either way, so the outcome (or the rule auth-service applied) is visible.
  const toggle = async () => {
    await run('status', async () => {
      const updated = await setIamUserEnabled(user.id, !user.isActive);
      onChanged({ isActive: updated.enabled });
    }, user.isActive ? 'Usuario desactivado. Ya no puede iniciar sesión.' : 'Usuario activado.');
    setConfirming(false);
  };

  const email = (actions: IamRequiredAction[], done: string) =>
    run(actions.join(), () => sendIamActionsEmail(user.id, actions), done);

  return (
    <div className="space-y-4">
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
        <dt className="text-muted-foreground">Estado</dt>
        <dd>
          <Badge variant={user.isActive ? 'secondary' : 'outline'}>{user.isActive ? 'Activo' : 'Inactivo'}</Badge>
        </dd>
        <dt className="text-muted-foreground">Usuario</dt>
        <dd>@{user.username}</dd>
        <dt className="text-muted-foreground">Correo</dt>
        <dd>{user.email || '—'}</dd>
      </dl>
      {canWrite && (
        <div className="space-y-2">
          <Button
            type="button"
            variant={user.isActive ? 'outline' : 'default'}
            className="w-full justify-start"
            disabled={busy !== null}
            onClick={() => setConfirming(true)}
          >
            <Power aria-hidden="true" className="size-4" />
            {user.isActive ? 'Desactivar usuario' : 'Activar usuario'}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="w-full justify-start"
            loading={busy === 'VERIFY_EMAIL,UPDATE_PASSWORD'}
            disabled={busy !== null || !user.email}
            onClick={() => void email(['VERIFY_EMAIL', 'UPDATE_PASSWORD'], 'Invitación reenviada por correo.')}
          >
            <MailCheck aria-hidden="true" className="size-4" />
            Reenviar invitación
          </Button>
          <Button
            type="button"
            variant="outline"
            className="w-full justify-start"
            loading={busy === 'UPDATE_PASSWORD'}
            disabled={busy !== null || !user.email}
            onClick={() => void email(['UPDATE_PASSWORD'], 'Se envió el correo para restablecer la contraseña.')}
          >
            <KeyRound aria-hidden="true" className="size-4" />
            Restablecer contraseña
          </Button>
          {!user.email && (
            <p className="text-xs text-muted-foreground">El usuario no tiene correo: no se le pueden enviar enlaces.</p>
          )}
        </div>
      )}
      {error && <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
      {message && <p role="status" className="rounded-md border bg-muted/30 p-3 text-sm">{message}</p>}

      <Dialog open={confirming} onOpenChange={(open) => busy === null && setConfirming(open)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{user.isActive ? '¿Desactivar este usuario?' : '¿Activar este usuario?'}</DialogTitle>
            <DialogDescription>
              {user.isActive
                ? `${personName(user)} no podrá iniciar sesión hasta que se vuelva a activar. Sus roles y contextos se conservan.`
                : `${personName(user)} podrá volver a iniciar sesión con sus roles actuales.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setConfirming(false)} disabled={busy !== null}>
              Cancelar
            </Button>
            <Button
              type="button"
              variant={user.isActive ? 'destructive' : 'default'}
              loading={busy === 'status'}
              disabled={busy !== null}
              onClick={() => void toggle()}
            >
              {user.isActive ? 'Desactivar' : 'Activar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---- roles and permissions --------------------------------------------------------------------------------

interface CatalogItem {
  name: string;
  description: string | null;
}

const COPY = {
  roles: {
    title: 'Roles',
    hint: 'Marca los roles asignados directamente. Los efectivos incluyen los que llegan a través de otros roles.',
    effective: 'Roles efectivos',
    saved: 'Roles actualizados. El cambio llega al usuario en su próximo inicio de sesión o renovación del token.',
    save: 'Guardar roles',
  },
  permissions: {
    title: 'Permisos sueltos',
    hint: 'Permisos asignados directamente, además de los que dan sus roles. Úsalos para excepciones; lo habitual es asignar un rol.',
    effective: 'Permisos efectivos',
    saved: 'Permisos actualizados. El cambio llega al usuario en su próximo inicio de sesión o renovación del token.',
    save: 'Guardar permisos',
  },
} as const;

function AssignmentsPanel({ kind, userId, canWrite, onSaved }: {
  kind: 'roles' | 'permissions';
  userId: string;
  canWrite: boolean;
  onSaved?: (assignments: IamAssignments) => void;
}) {
  const copy = COPY[kind];
  const [catalog, setCatalog] = React.useState<CatalogItem[] | null>(null);
  const [assignments, setAssignments] = React.useState<IamAssignments | null>(null);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [message, setMessage] = React.useState<string | null>(null);

  const load = React.useCallback(async (signal?: AbortSignal) => {
    setLoadError(null);
    try {
      const [items, current] = await Promise.all(kind === 'roles'
        ? [listIamRoles(signal), getIamUserRoles(userId, signal)]
        : [listIamPermissions(signal), getIamUserPermissions(userId, signal)]);
      setCatalog(items);
      setAssignments(current);
      setSelected(new Set(current.direct.map((item) => item.name)));
    } catch (cause) {
      if (signal?.aborted) return;
      setLoadError(cause instanceof Error ? cause.message : 'No se pudo cargar la información.');
    }
  }, [kind, userId]);

  React.useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const save = async () => {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const names = [...selected].sort();
      const saved = kind === 'roles'
        ? await replaceIamUserRoles(userId, names)
        : await replaceIamUserPermissions(userId, names);
      setAssignments(saved);
      setSelected(new Set(saved.direct.map((item) => item.name)));
      onSaved?.(saved);
      setMessage(copy.saved);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudieron guardar los cambios.');
    } finally {
      setSaving(false);
    }
  };

  if (loadError) {
    return (
      <div role="alert" className="space-y-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
        <p>{loadError}</p>
        <Button type="button" size="sm" variant="outline" onClick={() => void load()}>Reintentar</Button>
      </div>
    );
  }
  if (!catalog || !assignments) {
    return <Loader text="Cargando…" fullScreen={false} className="min-h-32" />;
  }

  const direct = new Set(assignments.direct.map((item) => item.name));
  const inherited = assignments.effective.filter((item) => !direct.has(item.name));
  const dirty = selected.size !== direct.size || [...selected].some((name) => !direct.has(name));

  return (
    <div className="space-y-4">
      <fieldset className="space-y-3" disabled={!canWrite || saving}>
        <legend className="text-sm font-medium">{copy.title}</legend>
        <p className="text-xs text-muted-foreground">{copy.hint}</p>
        {catalog.length === 0 ? (
          <p className="text-sm text-muted-foreground">El catálogo está vacío.</p>
        ) : (
          <ul className="max-h-72 space-y-2 overflow-y-auto pr-1" aria-label={copy.title}>
            {catalog.map((item) => (
              <li key={item.name}>
                <Checkbox
                  id={`${kind}-${item.name}`}
                  checked={selected.has(item.name)}
                  disabled={!canWrite || saving}
                  onCheckedChange={(checked) =>
                    setSelected((current) => {
                      const next = new Set(current);
                      if (checked === true) next.add(item.name);
                      else next.delete(item.name);
                      return next;
                    })}
                  label={<span className="font-mono text-xs">{item.name}</span>}
                  description={item.description ?? undefined}
                />
              </li>
            ))}
          </ul>
        )}
      </fieldset>
      <section aria-label={copy.effective} className="space-y-2">
        <h3 className="text-sm font-medium">{copy.effective}</h3>
        {assignments.effective.length === 0 ? (
          <p className="text-sm text-muted-foreground">Ninguno.</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {assignments.effective.map((item) => (
              <Badge key={item.name} variant={direct.has(item.name) ? 'secondary' : 'outline'}>
                {item.name}
                {!direct.has(item.name) && <span className="sr-only"> (heredado)</span>}
              </Badge>
            ))}
          </div>
        )}
        {inherited.length > 0 && (
          <p className="text-xs text-muted-foreground">
            Los que aparecen solo con borde se heredan de un rol y no se quitan desde aquí.
          </p>
        )}
      </section>
      {error && <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
      {message && <p role="status" className="rounded-md border bg-muted/30 p-3 text-sm">{message}</p>}
      {canWrite && (
        <div className="flex justify-end">
          <Button type="button" size="sm" loading={saving} disabled={saving || !dirty} onClick={() => void save()}>
            {copy.save}
          </Button>
        </div>
      )}
    </div>
  );
}
