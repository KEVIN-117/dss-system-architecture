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
  Input,
  Loader,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@dss-monorepo/design-system';
import {
  GraduationCap,
  KeyRound,
  KeySquare,
  MailCheck,
  Power,
  Search,
  ShieldCheck,
  UserRound,
  X,
  type LucideIcon,
} from 'lucide-react';
import type {
  AcademicContext,
  AdminUserDirectoryEntry,
} from '../data-access/auth-admin';
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

export type UserManagementTab =
  | 'account'
  | 'roles'
  | 'permissions'
  | 'contexts';

interface UserManagementSheetProps {
  user: AdminUserDirectoryEntry | null;
  /** `iam:users:write`: without it the sheet is read-only. */
  canWrite: boolean;
  initialTab?: UserManagementTab;
  onClose: () => void;
  /** The user changed in auth-service; the directory should reload it. */
  onChanged: (change: Partial<AdminUserDirectoryEntry>) => void;
}

const TABS: { value: UserManagementTab; label: string; icon: LucideIcon }[] = [
  { value: 'account', label: 'Cuenta', icon: UserRound },
  { value: 'roles', label: 'Roles', icon: ShieldCheck },
  { value: 'permissions', label: 'Permisos', icon: KeySquare },
  { value: 'contexts', label: 'Contextos', icon: GraduationCap },
];

/** Content width shared by the header, the tabs and the panels of the bottom sheet. */
const CONTAINER = 'mx-auto w-full max-w-6xl px-4 sm:px-6';

function initials(user: AdminUserDirectoryEntry): string {
  const parts = personName(user).trim().split(/\s+/).filter(Boolean);
  const letters =
    parts.length > 1
      ? parts[0][0] + parts[parts.length - 1][0]
      : (parts[0] ?? user.username).slice(0, 2);
  return letters.toUpperCase();
}

/**
 * Account, roles, permissions and academic contexts of one user (IAM-016), as a bottom sheet: the identity and the
 * tabs stay fixed at the top, only the active panel scrolls, and the panels use the full width.
 */
export function UserManagementSheet({
  user,
  canWrite,
  initialTab = 'account',
  onClose,
  onChanged,
}: UserManagementSheetProps) {
  const [tab, setTab] = React.useState<UserManagementTab>(initialTab);
  React.useEffect(() => {
    if (user) setTab(initialTab);
  }, [initialTab, user]);

  return (
    <Sheet open={user !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="bottom"
        showCloseButton={false}
        className="flex max-h-[88vh] min-h-[60vh] w-full flex-col gap-0 overflow-hidden rounded-t-2xl p-0"
      >
        <div
          aria-hidden="true"
          className="mx-auto mt-2.5 h-1.5 w-12 shrink-0 rounded-full bg-muted-foreground/30"
        />
        <SheetHeader className="shrink-0 border-b border-border p-0 pb-3 pt-2">
          <div className={`${CONTAINER} flex items-start gap-3`}>
            {user && (
              <span
                aria-hidden="true"
                className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary"
              >
                {initials(user)}
              </span>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <SheetTitle className="truncate">
                  {user ? personName(user) : 'Gestionar usuario'}
                </SheetTitle>
                {user && (
                  <Badge variant={user.isActive ? 'secondary' : 'outline'}>
                    {user.isActive ? 'Activo' : 'Inactivo'}
                  </Badge>
                )}
              </div>
              <SheetDescription className="truncate">
                {user
                  ? `Gestionar usuario · @${user.username} · ${user.email || 'sin correo'}`
                  : 'Usuario seleccionado'}
              </SheetDescription>
              {user && !canWrite && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Vista de solo lectura: tu cuenta no tiene el permiso
                  iam:users:write.
                </p>
              )}
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Cerrar"
              onClick={onClose}
            >
              <X aria-hidden="true" className="size-4" />
            </Button>
          </div>
        </SheetHeader>
        {user && (
          <Tabs
            value={tab}
            onValueChange={(value) => setTab(value as UserManagementTab)}
            className="flex min-h-0 flex-1 flex-col gap-0 my-auto"
          >
            {/* Underlined tabs sitting on the divider; only this row scrolls sideways on narrow screens. */}
            <div className="shrink-0 overflow-x-auto overflow-y-hidden border-b border-border scrollbar-none">
              <div className={CONTAINER}>
                <TabsList
                  aria-label="Secciones del usuario"
                  className="flex justify-center h-11 gap-1 rounded-none border-0 bg-transparent p-0 backdrop-blur-none"
                >
                  {TABS.map(({ value, label, icon: Icon }) => (
                    <TabsTrigger
                      key={value}
                      value={value}
                      className="h-full gap-1.5 rounded-none border-b-2 border-transparent px-3 text-muted-foreground hover:text-foreground data-[state=active]:bg-transparent data-[state=active]:shadow-none [&_svg]:size-4"
                    >
                      <Icon aria-hidden="true" />
                      {label}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              <TabsContent value="account" className={`${CONTAINER} mt-0 py-5`}>
                <AccountPanel
                  user={user}
                  canWrite={canWrite}
                  onChanged={onChanged}
                />
              </TabsContent>
              <TabsContent value="roles" className="mt-0 h-full">
                <AssignmentsPanel
                  key={`roles-${user.id}`}
                  kind="roles"
                  userId={user.id}
                  canWrite={canWrite}
                  onSaved={(assignments) =>
                    onChanged({
                      roles: assignments.effective.map((role) => role.name),
                    })
                  }
                />
              </TabsContent>
              <TabsContent value="permissions" className="mt-0 h-full">
                <AssignmentsPanel
                  key={`permissions-${user.id}`}
                  kind="permissions"
                  userId={user.id}
                  canWrite={canWrite}
                />
              </TabsContent>
              <TabsContent
                value="contexts"
                className={`${CONTAINER} mt-0 py-5`}
              >
                <AcademicContextsPanel
                  user={user}
                  canWrite={canWrite}
                  onSaved={(academicContexts: AcademicContext[]) =>
                    onChanged({ academicContexts })
                  }
                />
              </TabsContent>
            </div>
          </Tabs>
        )}
      </SheetContent>
    </Sheet>
  );
}

// ---- account ----------------------------------------------------------------------------------------------

function AccountPanel({
  user,
  canWrite,
  onChanged,
}: {
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

  const run = async (
    label: string,
    action: () => Promise<void>,
    done: string,
  ) => {
    setBusy(label);
    setError(null);
    setMessage(null);
    try {
      await action();
      setMessage(done);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'No se pudo completar la operación.',
      );
    } finally {
      setBusy(null);
    }
  };

  // The confirmation closes either way, so the outcome (or the rule auth-service applied) is visible.
  const toggle = async () => {
    await run(
      'status',
      async () => {
        const updated = await setIamUserEnabled(user.id, !user.isActive);
        onChanged({ isActive: updated.enabled });
      },
      user.isActive
        ? 'Usuario desactivado. Ya no puede iniciar sesión.'
        : 'Usuario activado.',
    );
    setConfirming(false);
  };

  const email = (actions: IamRequiredAction[], done: string) =>
    run(actions.join(), () => sendIamActionsEmail(user.id, actions), done);

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
      <section
        aria-labelledby="account-data"
        className="rounded-xl border border-border bg-card p-4"
      >
        <h3 id="account-data" className="mb-3 text-sm font-medium">
          Datos de la cuenta
        </h3>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2.5 text-sm">
          <dt className="text-muted-foreground">Estado</dt>
          <dd>{user.isActive ? 'Puede iniciar sesión' : 'Sin acceso'}</dd>
          <dt className="text-muted-foreground">Usuario</dt>
          <dd className="break-all">@{user.username}</dd>
          <dt className="text-muted-foreground">Correo</dt>
          <dd className="break-all">{user.email || '—'}</dd>
        </dl>
      </section>

      <section aria-labelledby="account-actions" className="space-y-3">
        <h3 id="account-actions" className="text-sm font-medium">
          Acciones
        </h3>
        {canWrite ? (
          <div className="grid gap-3 sm:grid-cols-3">
            <ActionTile
              description={
                user.isActive
                  ? 'Bloquea el inicio de sesión; conserva roles y contextos.'
                  : 'Permite volver a iniciar sesión con sus roles actuales.'
              }
            >
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
            </ActionTile>
            <ActionTile description="Envía el enlace para verificar el correo y crear la contraseña.">
              <Button
                type="button"
                variant="outline"
                className="w-full justify-start"
                loading={busy === 'VERIFY_EMAIL,UPDATE_PASSWORD'}
                disabled={busy !== null || !user.email}
                onClick={() =>
                  void email(
                    ['VERIFY_EMAIL', 'UPDATE_PASSWORD'],
                    'Invitación reenviada por correo.',
                  )
                }
              >
                <MailCheck aria-hidden="true" className="size-4" />
                Reenviar invitación
              </Button>
            </ActionTile>
            <ActionTile description="Envía el enlace para elegir una contraseña nueva.">
              <Button
                type="button"
                variant="outline"
                className="w-full justify-start"
                loading={busy === 'UPDATE_PASSWORD'}
                disabled={busy !== null || !user.email}
                onClick={() =>
                  void email(
                    ['UPDATE_PASSWORD'],
                    'Se envió el correo para restablecer la contraseña.',
                  )
                }
              >
                <KeyRound aria-hidden="true" className="size-4" />
                Restablecer contraseña
              </Button>
            </ActionTile>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Sin acciones disponibles en modo de solo lectura.
          </p>
        )}
        {canWrite && !user.email && (
          <p className="text-xs text-muted-foreground">
            El usuario no tiene correo: no se le pueden enviar enlaces.
          </p>
        )}
        {error && (
          <p
            role="alert"
            className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
          >
            {error}
          </p>
        )}
        {message && (
          <p
            role="status"
            className="rounded-md border bg-muted/30 p-3 text-sm"
          >
            {message}
          </p>
        )}
      </section>

      <Dialog
        open={confirming}
        onOpenChange={(open) => busy === null && setConfirming(open)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {user.isActive
                ? '¿Desactivar este usuario?'
                : '¿Activar este usuario?'}
            </DialogTitle>
            <DialogDescription>
              {user.isActive
                ? `${personName(user)} no podrá iniciar sesión hasta que se vuelva a activar. Sus roles y contextos se conservan.`
                : `${personName(user)} podrá volver a iniciar sesión con sus roles actuales.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setConfirming(false)}
              disabled={busy !== null}
            >
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

function ActionTile({
  description,
  children,
}: {
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border bg-card p-3">
      {children}
      <p className="text-xs leading-snug text-muted-foreground">
        {description}
      </p>
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
    search: 'Buscar roles',
    saved:
      'Roles actualizados. El cambio llega al usuario en su próximo inicio de sesión o renovación del token.',
    save: 'Guardar roles',
  },
  permissions: {
    title: 'Permisos sueltos',
    hint: 'Permisos asignados directamente, además de los que dan sus roles. Úsalos para excepciones; lo habitual es asignar un rol.',
    effective: 'Permisos efectivos',
    search: 'Buscar permisos',
    saved:
      'Permisos actualizados. El cambio llega al usuario en su próximo inicio de sesión o renovación del token.',
    save: 'Guardar permisos',
  },
} as const;

/** Permissions are `servicio:recurso:acción`: grouping by the first segment keeps a long catalog scannable. */
function groupCatalog(
  items: CatalogItem[],
  kind: 'roles' | 'permissions',
): { key: string; items: CatalogItem[] }[] {
  if (kind === 'roles') return [{ key: '', items }];
  const groups = new Map<string, CatalogItem[]>();
  for (const item of items) {
    const key = item.name.includes(':') ? item.name.split(':')[0] : 'otros';
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, list]) => ({ key, items: list }));
}

function AssignmentsPanel({
  kind,
  userId,
  canWrite,
  onSaved,
}: {
  kind: 'roles' | 'permissions';
  userId: string;
  canWrite: boolean;
  onSaved?: (assignments: IamAssignments) => void;
}) {
  const copy = COPY[kind];
  const [catalog, setCatalog] = React.useState<CatalogItem[] | null>(null);
  const [assignments, setAssignments] = React.useState<IamAssignments | null>(
    null,
  );
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [query, setQuery] = React.useState('');
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [message, setMessage] = React.useState<string | null>(null);

  const load = React.useCallback(
    async (signal?: AbortSignal) => {
      setLoadError(null);
      try {
        const [items, current] = await Promise.all(
          kind === 'roles'
            ? [listIamRoles(signal), getIamUserRoles(userId, signal)]
            : [
                listIamPermissions(signal),
                getIamUserPermissions(userId, signal),
              ],
        );
        setCatalog(items);
        setAssignments(current);
        setSelected(new Set(current.direct.map((item) => item.name)));
      } catch (cause) {
        if (signal?.aborted) return;
        setLoadError(
          cause instanceof Error
            ? cause.message
            : 'No se pudo cargar la información.',
        );
      }
    },
    [kind, userId],
  );

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
      const saved =
        kind === 'roles'
          ? await replaceIamUserRoles(userId, names)
          : await replaceIamUserPermissions(userId, names);
      setAssignments(saved);
      setSelected(new Set(saved.direct.map((item) => item.name)));
      onSaved?.(saved);
      setMessage(copy.saved);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'No se pudieron guardar los cambios.',
      );
    } finally {
      setSaving(false);
    }
  };

  if (loadError) {
    return (
      <div className={`${CONTAINER} py-5`}>
        <div
          role="alert"
          className="space-y-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
        >
          <p>{loadError}</p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => void load()}
          >
            Reintentar
          </Button>
        </div>
      </div>
    );
  }
  if (!catalog || !assignments) {
    return <Loader text="Cargando…" fullScreen={false} className="min-h-40" />;
  }

  const direct = new Set(assignments.direct.map((item) => item.name));
  const inherited = assignments.effective.filter(
    (item) => !direct.has(item.name),
  );
  const added = [...selected].filter((name) => !direct.has(name)).length;
  const removed = [...direct].filter((name) => !selected.has(name)).length;
  const dirty = added > 0 || removed > 0;
  const needle = query.trim().toLowerCase();
  const visible = needle
    ? catalog.filter(
        (item) =>
          item.name.toLowerCase().includes(needle) ||
          item.description?.toLowerCase().includes(needle),
      )
    : catalog;
  const groups = groupCatalog(visible, kind);

  return (
    <div className="flex min-h-full flex-col">
      <div
        className={`${CONTAINER} grid flex-1 gap-6 py-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]`}
      >
        <fieldset className="min-w-0 space-y-3" disabled={!canWrite || saving}>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="min-w-0">
              <legend className="text-sm font-medium">{copy.title}</legend>
              <p className="text-xs text-muted-foreground">{copy.hint}</p>
            </div>
            {catalog.length > 6 && (
              <div className="relative w-full sm:w-64">
                <Search
                  aria-hidden="true"
                  className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
                />
                <Input
                  type="search"
                  aria-label={copy.search}
                  placeholder={`${copy.search}…`}
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  className="pl-8"
                />
              </div>
            )}
          </div>
          {catalog.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              El catálogo está vacío.
            </p>
          ) : visible.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nada coincide con «{query.trim()}».
            </p>
          ) : (
            <ul className="space-y-4" aria-label={copy.title}>
              {groups.map((group) => (
                <li key={group.key || 'all'} className="space-y-2">
                  {group.key && (
                    <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                      {group.key}
                    </p>
                  )}
                  <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                    {group.items.map((item) => (
                      <li
                        key={item.name}
                        className={`rounded-lg border p-2.5 transition-colors ${
                          selected.has(item.name)
                            ? 'border-primary/50 bg-primary/5'
                            : 'border-border'
                        }`}
                      >
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
                            })
                          }
                          label={
                            <span className="font-mono text-xs break-all">
                              {item.name}
                            </span>
                          }
                          description={item.description ?? undefined}
                        />
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          )}
        </fieldset>

        <section
          aria-label={copy.effective}
          className="h-fit space-y-2 rounded-xl border border-border bg-muted/20 p-4 lg:sticky lg:top-0"
        >
          <h3 className="text-sm font-medium">
            {copy.effective}{' '}
            <span className="font-normal text-muted-foreground">
              ({assignments.effective.length})
            </span>
          </h3>
          {assignments.effective.length === 0 ? (
            <p className="text-sm text-muted-foreground">Ninguno.</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {assignments.effective.map((item) => (
                <Badge
                  key={item.name}
                  variant={direct.has(item.name) ? 'secondary' : 'outline'}
                >
                  {item.name}
                  {!direct.has(item.name) && (
                    <span className="sr-only"> (heredado)</span>
                  )}
                </Badge>
              ))}
            </div>
          )}
          {inherited.length > 0 && (
            <p className="text-xs text-muted-foreground">
              Los que aparecen solo con borde se heredan de un rol y no se
              quitan desde aquí.
            </p>
          )}
        </section>
      </div>

      {(canWrite || error || message) && (
        <div className="sticky bottom-0 border-t border-border bg-popover/95 py-3 backdrop-blur">
          <div
            className={`${CONTAINER} flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between`}
          >
            <div className="min-w-0 flex-1 text-sm">
              {error ? (
                <p role="alert" className="text-destructive">
                  {error}
                </p>
              ) : message ? (
                <p role="status">{message}</p>
              ) : (
                <p className="text-muted-foreground">
                  {dirty
                    ? `Cambios sin guardar: ${added} por asignar, ${removed} por quitar.`
                    : `${direct.size} asignados directamente.`}
                </p>
              )}
            </div>
            {canWrite && (
              <div className="flex shrink-0 justify-end gap-2">
                {dirty && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={saving}
                    onClick={() => setSelected(new Set(direct))}
                  >
                    Descartar
                  </Button>
                )}
                <Button
                  type="button"
                  size="sm"
                  loading={saving}
                  disabled={saving || !dirty}
                  onClick={() => void save()}
                >
                  {copy.save}
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
