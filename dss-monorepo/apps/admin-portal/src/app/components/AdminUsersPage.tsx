'use client';

import * as React from 'react';
import {
  Badge,
  Button,
  Input,
  Select,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
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
  UserRoundCog,
} from 'lucide-react';
import {
  getAcademicCatalog,
  listAdminUsers,
  replaceAdminUserContexts,
  type AcademicCatalog,
  type AdminUserDirectoryEntry,
  type AcademicContextAssignment,
} from '../data-access/auth-admin';

const PAGE_SIZE = 20;
const ROLE_PRECEDENCE = ['DIRECTOR', 'DECANO', 'RECTOR', 'SUPERADMIN'] as const;

type ContextRole = (typeof ROLE_PRECEDENCE)[number];

function effectiveRole(roles: string[]): ContextRole | null {
  return (
    [...ROLE_PRECEDENCE].reverse().find((role) => roles.includes(role)) ?? null
  );
}

function personName(user: AdminUserDirectoryEntry): string {
  return (
    [user.firstName, user.lastName].filter(Boolean).join(' ').trim() ||
    user.username
  );
}

function contextSummary(
  user: AdminUserDirectoryEntry,
  catalog: AcademicCatalog | null,
): string {
  const context = user.academicContexts[0];
  if (!context) return 'Sin contexto asignado';
  if (context.facultyId === null) return 'Sin facultad asignada';
  const faculty = catalog?.faculties.find(
    (item) => item.id === context.facultyId,
  );
  const career = context.careerId
    ? catalog?.careers.find(
        (item) =>
          item.id === context.careerId && item.facultyId === context.facultyId,
      )
    : undefined;
  return context.careerId
    ? `${faculty?.name ?? `Facultad ${context.facultyId}`} · ${career?.name ?? `Carrera ${context.careerId}`}`
    : (faculty?.name ?? `Facultad ${context.facultyId}`);
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
  const [selectedUser, setSelectedUser] =
    React.useState<AdminUserDirectoryEntry | null>(null);
  const [facultyId, setFacultyId] = React.useState('');
  const [careerId, setCareerId] = React.useState('');
  const [academicCatalog, setAcademicCatalog] =
    React.useState<AcademicCatalog | null>(null);
  const [catalogLoading, setCatalogLoading] = React.useState(false);
  const [catalogError, setCatalogError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | null>(null);
  const [saveMessage, setSaveMessage] = React.useState<string | null>(null);

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

  const openContextEditor = (user: AdminUserDirectoryEntry) => {
    const context = user.academicContexts[0];
    setSelectedUser(user);
    setFacultyId(
      context?.facultyId === null || context?.facultyId === undefined
        ? ''
        : String(context.facultyId),
    );
    setCareerId(context?.careerId ?? '');
    setSaveError(null);
    setSaveMessage(null);
    setCatalogError(null);
    if (!academicCatalog) {
      setCatalogLoading(true);
      void getAcademicCatalog()
        .then(setAcademicCatalog)
        .catch((cause) =>
          setCatalogError(
            cause instanceof Error
              ? cause.message
              : 'No se pudo cargar el catálogo académico.',
          ),
        )
        .finally(() => setCatalogLoading(false));
    }
  };

  const submitSearch = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPage(0);
    setQuery(searchInput.trim());
  };

  const saveContext = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedUser) return;
    const targetRole = effectiveRole(selectedUser.roles);
    const selectedFaculty = academicCatalog?.faculties.find(
      (item) => item.id === Number(facultyId),
    );
    if (!selectedFaculty) {
      setSaveError('Selecciona una facultad del catálogo académico.');
      return;
    }
    const selectedCareer =
      targetRole === 'DIRECTOR'
        ? academicCatalog?.careers.find(
            (item) =>
              item.id === careerId && item.facultyId === selectedFaculty.id,
          )
        : undefined;
    if (targetRole === 'DIRECTOR' && !selectedCareer) {
      setSaveError('Selecciona una carrera de la facultad elegida.');
      return;
    }

    const contexts: AcademicContextAssignment[] = [
      {
        facultyId: selectedFaculty.id,
        careerId: selectedCareer?.id ?? null,
      },
    ];
    setSaving(true);
    setSaveError(null);
    setSaveMessage(null);
    try {
      const updatedContexts = await replaceAdminUserContexts(
        selectedUser.id,
        contexts,
      );
      setUsers((current) =>
        current.map((user) =>
          user.id === selectedUser.id
            ? { ...user, academicContexts: updatedContexts }
            : user,
        ),
      );
      setSelectedUser((current) =>
        current ? { ...current, academicContexts: updatedContexts } : current,
      );
      setSaveMessage('Contexto académico actualizado.');
    } catch (cause) {
      setSaveError(
        cause instanceof Error
          ? cause.message
          : 'No se pudo guardar el contexto.',
      );
    } finally {
      setSaving(false);
    }
  };

  const start = totalElements === 0 ? 0 : page * PAGE_SIZE + 1;
  const end = Math.min((page + 1) * PAGE_SIZE, totalElements);
  const selectedRole = selectedUser ? effectiveRole(selectedUser.roles) : null;
  const canAssignContext =
    selectedRole === 'DECANO' || selectedRole === 'DIRECTOR';
  const availableCareers =
    academicCatalog?.careers.filter(
      (item) => item.facultyId === Number(facultyId),
    ) ?? [];

  return (
    <section className="space-y-6" aria-labelledby="admin-users-title">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <p className="text-sm font-medium text-muted-foreground">
            Administración · Auth Service
          </p>
          <h1
            id="admin-users-title"
            className="text-2xl font-semibold tracking-tight"
          >
            Usuarios
          </h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Consulta las identidades institucionales y asigna el contexto
            académico requerido por su rol.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => void loadUsers()}
          disabled={loading}
        >
          <RefreshCw aria-hidden="true" className="size-4" />
          Actualizar
        </Button>
      </header>

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
            Los datos provienen de Auth Service
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
                const role = effectiveRole(user.roles);
                const eligible = role === 'DECANO' || role === 'DIRECTOR';
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
                      {role === 'RECTOR' || role === 'SUPERADMIN'
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
                          disabled={!eligible}
                          aria-label={`Asignar contexto académico a ${user.username}`}
                          onClick={() => openContextEditor(user)}
                          title={
                            eligible
                              ? undefined
                              : 'El rol no requiere contexto académico'
                          }
                        >
                          <UserRoundCog aria-hidden="true" className="size-4" />
                          Contexto
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
                    Cargando usuarios…
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

      <Sheet
        open={selectedUser !== null}
        onOpenChange={(open) => {
          if (!open && !saving) setSelectedUser(null);
        }}
      >
        <SheetContent
          side="right"
          showCloseButton={false}
          className="w-full overflow-y-auto sm:max-w-md"
        >
          <SheetHeader className="border-b border-border px-6 pt-6">
            <SheetTitle>Contexto académico</SheetTitle>
            <SheetDescription>
              {selectedUser
                ? `Asigna el alcance institucional para ${personName(selectedUser)} (@${selectedUser.username}).`
                : 'Asigna el alcance institucional del usuario.'}
            </SheetDescription>
          </SheetHeader>
          {selectedUser && (
            <form
              id="academic-context-form"
              onSubmit={(event) => void saveContext(event)}
              className="space-y-5 px-6"
            >
              {!canAssignContext ? (
                <div
                  className="rounded-lg border bg-muted/30 p-4 text-sm"
                  role="status"
                >
                  <p className="font-medium">
                    Este rol no utiliza contexto académico.
                  </p>
                  <p className="mt-1 text-muted-foreground">
                    Auth Service requiere que Rector y Superadministrador no
                    tengan contextos asignados.
                  </p>
                </div>
              ) : (
                <>
                  <div className="rounded-lg border bg-muted/30 p-4 text-sm">
                    <p className="font-medium">
                      Alcance requerido: {selectedRole}
                    </p>
                    <p className="mt-1 text-muted-foreground">
                      Elige la unidad académica por nombre. La asignación
                      reemplazará el contexto actual de este usuario.
                    </p>
                  </div>
                  {catalogLoading && (
                    <p role="status" className="text-sm text-muted-foreground">
                      Cargando facultades y carreras…
                    </p>
                  )}
                  {catalogError && (
                    <div
                      role="alert"
                      className="space-y-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
                    >
                      <p>
                        No se pudo cargar el catálogo académico: {catalogError}
                      </p>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setCatalogError(null);
                          setCatalogLoading(true);
                          void getAcademicCatalog()
                            .then(setAcademicCatalog)
                            .catch((cause) =>
                              setCatalogError(
                                cause instanceof Error
                                  ? cause.message
                                  : 'No se pudo cargar el catálogo académico.',
                              ),
                            )
                            .finally(() => setCatalogLoading(false));
                        }}
                      >
                        Reintentar
                      </Button>
                    </div>
                  )}
                  <div className="space-y-1.5">
                    <label
                      htmlFor="context-faculty-id"
                      className="text-sm font-medium"
                    >
                      Facultad <span aria-hidden="true">*</span>
                    </label>
                    <Select
                      id="context-faculty-id"
                      required
                      value={facultyId}
                      disabled={catalogLoading || !academicCatalog}
                      onChange={(event) => {
                        setFacultyId(event.target.value);
                        setCareerId('');
                      }}
                      aria-describedby="faculty-id-hint"
                    >
                      <option value="">Selecciona una facultad</option>
                      {academicCatalog?.faculties.map((faculty) => (
                        <option key={faculty.id} value={faculty.id}>
                          {faculty.name} · ID {faculty.id}
                        </option>
                      ))}
                    </Select>
                    <p
                      id="faculty-id-hint"
                      className="text-xs text-muted-foreground"
                    >
                      Se muestran las facultades activas del catálogo
                      académico de Auth Service.
                    </p>
                  </div>
                  {selectedRole === 'DIRECTOR' && (
                    <div className="space-y-1.5">
                      <label
                        htmlFor="context-career-id"
                        className="text-sm font-medium"
                      >
                        Carrera <span aria-hidden="true">*</span>
                      </label>
                      <Select
                        id="context-career-id"
                        required
                        value={careerId}
                        disabled={
                          !facultyId || catalogLoading || !academicCatalog
                        }
                        onChange={(event) => setCareerId(event.target.value)}
                        aria-describedby="career-id-hint"
                      >
                        <option value="">
                          {facultyId
                            ? 'Selecciona una carrera'
                            : 'Primero selecciona una facultad'}
                        </option>
                        {availableCareers.map((career) => (
                          <option
                            key={`${career.facultyId}-${career.id}`}
                            value={career.id}
                          >
                            {career.name} · {career.id}
                          </option>
                        ))}
                      </Select>
                      <p
                        id="career-id-hint"
                        className="text-xs text-muted-foreground"
                      >
                        La lista se filtra según la facultad seleccionada.
                      </p>
                    </div>
                  )}
                </>
              )}
              {saveError && (
                <p
                  role="alert"
                  className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
                >
                  {saveError}
                </p>
              )}
              {saveMessage && (
                <p
                  role="status"
                  className="rounded-md border border-border bg-muted/30 p-3 text-sm"
                >
                  {saveMessage}
                </p>
              )}
            </form>
          )}
          <SheetFooter className="border-t border-border px-6 pb-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => setSelectedUser(null)}
              disabled={saving}
            >
              Cerrar
            </Button>
            {canAssignContext && (
              <Button
                type="submit"
                form="academic-context-form"
                loading={saving}
                disabled={saving || catalogLoading || !academicCatalog}
              >
                Guardar contexto
              </Button>
            )}
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </section>
  );
}
