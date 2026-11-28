'use client';

import * as React from 'react';
import {
  Badge,
  Button,
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
import {
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Search,
  UserPlus,
  UserRoundCog,
} from 'lucide-react';
import { useHasPermission } from '@dss-monorepo/rbac';
import {
  getAcademicCatalog,
  listAdminUsers,
  type AcademicCatalog,
  type AdminUserDirectoryEntry,
} from '../data-access/auth-admin';
import type { IamUser } from '../data-access/iam-users';
import { CreateUserDialog } from './CreateUserDialog';
import { UserManagementSheet, type UserManagementTab } from './UserManagementSheet';
import { ROLE_PRECEDENCE, personName } from './user-roles';

const PAGE_SIZE = 20;

function contextLabel(
  context: AdminUserDirectoryEntry['academicContexts'][number],
  catalog: AcademicCatalog | null,
): string {
  if (context.facultyId === null) return 'Sin facultad asignada';
  const faculty = catalog?.faculties.find((item) => item.id === context.facultyId);
  const career = context.careerId
    ? catalog?.careers.find((item) => item.id === context.careerId && item.facultyId === context.facultyId)
    : undefined;
  return context.careerId
    ? `${faculty?.name ?? `Facultad ${context.facultyId}`} · ${career?.name ?? `Carrera ${context.careerId}`}`
    : (faculty?.name ?? `Facultad ${context.facultyId}`);
}

/** Every context of the user (IAM-009), one per line. */
function contextSummary(user: AdminUserDirectoryEntry, catalog: AcademicCatalog | null): React.ReactNode {
  if (user.academicContexts.length === 0) return 'Sin contexto asignado';
  return (
    <ul className="space-y-0.5">
      {user.academicContexts.map((context) => (
        <li key={context.id}>{contextLabel(context, catalog)}</li>
      ))}
    </ul>
  );
}

/** The directory row of a user just created in Keycloak, until the next reload. */
function directoryEntry(user: IamUser): AdminUserDirectoryEntry {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    isActive: user.enabled,
    roles: [],
    academicContexts: [],
  };
}

export function AdminUsersPage() {
  const [users, setUsers] = React.useState<AdminUserDirectoryEntry[]>([]);
  const [query, setQuery] = React.useState('');
  const [searchInput, setSearchInput] = React.useState('');
  const [role, setRole] = React.useState('');
  const [active, setActive] = React.useState('');
  const [page, setPage] = React.useState(0);
  const [totalElements, setTotalElements] = React.useState(0);
  const [totalPages, setTotalPages] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const canWrite = useHasPermission('iam:users:write');
  const [managedUser, setManagedUser] = React.useState<AdminUserDirectoryEntry | null>(null);
  const [managedTab, setManagedTab] = React.useState<UserManagementTab>('account');
  const [creating, setCreating] = React.useState(false);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [academicCatalog, setAcademicCatalog] = React.useState<AcademicCatalog | null>(null);

  const loadUsers = React.useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      setError(null);
      try {
        const result = await listAdminUsers(
          {
            q: query,
            role: role || undefined,
            active: active === '' ? undefined : active === 'active',
            page,
            size: PAGE_SIZE,
          },
          signal,
        );
        setUsers(result.content);
        setTotalElements(result.totalElements);
        setTotalPages(result.totalPages);
      } catch (cause) {
        if (signal?.aborted) return;
        setError(
          cause instanceof Error
            ? cause.message
            : 'No se pudo cargar el directorio.',
        );
        setUsers([]);
        setTotalElements(0);
        setTotalPages(0);
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [active, page, query, role],
  );

  React.useEffect(() => {
    const controller = new AbortController();
    void loadUsers(controller.signal);
    return () => controller.abort();
  }, [loadUsers]);

  // Faculty and career names for the context column; the directory works without them.
  React.useEffect(() => {
    const controller = new AbortController();
    getAcademicCatalog(controller.signal).then(setAcademicCatalog).catch(() => undefined);
    return () => controller.abort();
  }, []);

  const manage = (user: AdminUserDirectoryEntry, tab: UserManagementTab = 'account') => {
    setManagedTab(tab);
    setManagedUser(user);
  };

  const applyChange = (change: Partial<AdminUserDirectoryEntry>) => {
    if (!managedUser) return;
    const id = managedUser.id;
    setManagedUser((current) => (current ? { ...current, ...change } : current));
    setUsers((current) => current.map((user) => (user.id === id ? { ...user, ...change } : user)));
  };

  const created = (user: IamUser) => {
    setNotice(user.invitationSent === false
      ? `Usuario @${user.username} creado, pero no se pudo enviar la invitación. Puedes reenviarla desde «Gestionar».`
      : `Usuario @${user.username} creado.${user.invitationSent ? ' Se le envió la invitación por correo.' : ''}`);
    void loadUsers();
    manage(directoryEntry(user), 'roles');
  };

  const submitSearch = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPage(0);
    setQuery(searchInput.trim());
  };

  const start = totalElements === 0 ? 0 : page * PAGE_SIZE + 1;
  const end = Math.min((page + 1) * PAGE_SIZE, totalElements);

  return (
    <section className="space-y-6" aria-labelledby="admin-users-title">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <p className="text-sm font-medium text-muted-foreground">
            Administración · servicio de autenticación
          </p>
          <h1
            id="admin-users-title"
            className="text-2xl font-semibold tracking-tight"
          >
            Usuarios
          </h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Crea e invita usuarios, activa o desactiva sus cuentas y asigna
            roles, permisos y contextos académicos.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => void loadUsers()}
            disabled={loading}
          >
            <RefreshCw aria-hidden="true" className="size-4" />
            Actualizar
          </Button>
          {canWrite && (
            <Button onClick={() => setCreating(true)}>
              <UserPlus aria-hidden="true" className="size-4" />
              Nuevo usuario
            </Button>
          )}
        </div>
      </header>

      {notice && (
        <div role="status" className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted/30 p-3 text-sm">
          <p>{notice}</p>
          <Button variant="ghost" size="sm" onClick={() => setNotice(null)}>Cerrar aviso</Button>
        </div>
      )}

      <div className="rounded-xl border border-border bg-card">
        <form
          onSubmit={submitSearch}
          className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-end"
        >
          <div className="min-w-56 flex-1 space-y-1.5">
            <label htmlFor="admin-user-search" className="text-sm font-medium">
              Buscar usuarios
            </label>
            <Input
              id="admin-user-search"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Nombre, usuario o correo"
              iconLeft={<Search aria-hidden="true" className="size-4" />}
            />
          </div>
          <div className="w-full space-y-1.5 sm:w-44">
            <label htmlFor="admin-user-role" className="text-sm font-medium">
              Rol
            </label>
            <Select
              id="admin-user-role"
              value={role}
              onChange={(event) => {
                setRole(event.target.value);
                setPage(0);
              }}
            >
              <option value="">Todos los roles</option>
              {ROLE_PRECEDENCE.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </Select>
          </div>
          <div className="w-full space-y-1.5 sm:w-40">
            <label htmlFor="admin-user-status" className="text-sm font-medium">
              Estado
            </label>
            <Select
              id="admin-user-status"
              value={active}
              onChange={(event) => {
                setActive(event.target.value);
                setPage(0);
              }}
            >
              <option value="">Todos</option>
              <option value="active">Activo</option>
              <option value="inactive">Inactivo</option>
            </Select>
          </div>
          <Button type="submit" className="sm:mb-0">
            Buscar
          </Button>
        </form>

        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {loading
              ? 'Cargando usuarios…'
              : `${totalElements} ${totalElements === 1 ? 'usuario encontrado' : 'usuarios encontrados'}`}
          </p>
          <p className="text-sm text-muted-foreground">
            Los datos provienen del servicio de autenticación
          </p>
        </div>

        {error && (
          <div
            role="alert"
            className="mx-4 mb-4 rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive"
          >
            <p className="font-medium">No se pudo cargar el directorio</p>
            <p className="mt-1">{error}</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={() => void loadUsers()}
            >
              Reintentar
            </Button>
          </div>
        )}

        <div aria-busy={loading}>
          <Table aria-label="Directorio de usuarios">
            <TableHeader>
              <TableRow>
                <TableHead>Usuario</TableHead>
                <TableHead>Correo electrónico</TableHead>
                <TableHead>Roles</TableHead>
                <TableHead>Contexto académico</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => {
                return (
                  <TableRow key={user.id}>
                    <TableCell className="min-w-48 font-sans">
                      <p className="font-medium text-foreground">
                        {personName(user)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        @{user.username}
                      </p>
                    </TableCell>
                    <TableCell className="min-w-48 font-sans text-muted-foreground">
                      {user.email || '—'}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1.5">
                        {user.roles.length ? (
                          user.roles.map((userRole) => (
                            <Badge key={userRole} variant="outline">
                              {userRole}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-muted-foreground">
                            Sin roles
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="min-w-48 font-sans text-sm">
                      {user.academicScope === 'GLOBAL' || user.academicScope === 'NONE'
                        ? 'No requiere contexto'
                        : contextSummary(user, academicCatalog)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={user.isActive ? 'secondary' : 'outline'}>
                        {user.isActive ? 'Activo' : 'Inactivo'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end">
                        <Button
                          variant="outline"
                          size="sm"
                          aria-label={`Gestionar a ${user.username}`}
                          onClick={() => manage(user)}
                        >
                          <UserRoundCog aria-hidden="true" className="size-4" />
                          {canWrite ? 'Gestionar' : 'Ver detalle'}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {!loading && users.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="h-32 text-center font-sans text-muted-foreground"
                  >
                    {error
                      ? 'Verifica la conexión e inténtalo de nuevo.'
                      : 'No hay usuarios que coincidan con estos filtros.'}
                  </TableCell>
                </TableRow>
              )}
              {loading && users.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="h-24 text-center font-sans text-muted-foreground"
                    role="status"
                  >
                    <Loader text="Cargando usuarios…" fullScreen={false} className="min-h-24" />
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        <nav
          aria-label="Paginación de usuarios"
          className="flex flex-wrap items-center justify-between gap-3 border-t border-border p-4"
        >
          <p className="text-sm text-muted-foreground">
            Mostrando {start}–{end} de {totalElements}
          </p>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              Página {totalPages === 0 ? 0 : page + 1} de {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              aria-label="Página anterior"
              disabled={loading || page === 0}
              onClick={() => setPage((current) => Math.max(0, current - 1))}
            >
              <ChevronLeft aria-hidden="true" className="size-4" />
              Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              aria-label="Página siguiente"
              disabled={loading || page + 1 >= totalPages}
              onClick={() => setPage((current) => current + 1)}
            >
              Siguiente
              <ChevronRight aria-hidden="true" className="size-4" />
            </Button>
          </div>
        </nav>
      </div>

      <UserManagementSheet
        user={managedUser}
        canWrite={canWrite}
        initialTab={managedTab}
        onClose={() => setManagedUser(null)}
        onChanged={applyChange}
      />
      {canWrite && <CreateUserDialog open={creating} onOpenChange={setCreating} onCreated={created} />}
    </section>
  );
}
