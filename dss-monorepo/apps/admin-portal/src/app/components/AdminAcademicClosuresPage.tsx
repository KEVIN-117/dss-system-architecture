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
  Textarea,
} from '@dss-monorepo/design-system';
import {
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  Eye,
  History,
  Plus,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  X,
} from 'lucide-react';

import {
  closeAcademicPeriod,
  createAcademicClosure,
  getAcademicClosure,
  getDwClosureCapabilities,
  listAcademicClosureEvents,
  listAcademicClosures,
  reopenAcademicPeriod,
  type AcademicClosure,
  type AcademicClosureEvent,
  type ClosureStatus,
  type DwClosureCapabilities,
} from '../data-access/dw-control';

const PAGE_SIZE = 20;
const STATUSES: ClosureStatus[] = [
  'PENDIENTE',
  'CERRADO',
  'REABIERTO',
  'PROCESADO',
];

type ActionMode = 'close' | 'reopen';

function formatDate(value: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? '—'
    : new Intl.DateTimeFormat('es-BO', {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(date);
}

function periodLabel(periodo: number): string {
  return `Periodo ${periodo}`;
}

function statusVariant(
  status: ClosureStatus,
): React.ComponentProps<typeof Badge>['variant'] {
  if (status === 'CERRADO' || status === 'PROCESADO') return 'secondary';
  if (status === 'PENDIENTE') return 'outline';
  return 'default';
}

export function AdminAcademicClosuresPage() {
  const [items, setItems] = React.useState<AcademicClosure[]>([]);
  const [capabilities, setCapabilities] =
    React.useState<DwClosureCapabilities | null>(null);
  const [capabilitiesLoading, setCapabilitiesLoading] = React.useState(true);
  const [capabilitiesError, setCapabilitiesError] = React.useState<
    string | null
  >(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [page, setPage] = React.useState(0);
  const [totalElements, setTotalElements] = React.useState(0);
  const [totalPages, setTotalPages] = React.useState(0);
  const [gestionInput, setGestionInput] = React.useState('');
  const [periodoInput, setPeriodoInput] = React.useState('');
  const [statusInput, setStatusInput] = React.useState('');
  const [filters, setFilters] = React.useState<{
    gestion?: number;
    periodo?: number;
    status?: ClosureStatus;
  }>({});
  const [createOpen, setCreateOpen] = React.useState(false);
  const [createGestion, setCreateGestion] = React.useState(
    String(new Date().getFullYear()),
  );
  const [createPeriodo, setCreatePeriodo] = React.useState('');
  const [createReason, setCreateReason] = React.useState('');
  const [creating, setCreating] = React.useState(false);
  const [createError, setCreateError] = React.useState<string | null>(null);
  const [action, setAction] = React.useState<{
    mode: ActionMode;
    closure: AcademicClosure;
  } | null>(null);
  const [actionReason, setActionReason] = React.useState('');
  const [effectiveAt, setEffectiveAt] = React.useState('');
  const [acting, setActing] = React.useState(false);
  const [actionError, setActionError] = React.useState<string | null>(null);
  const [detail, setDetail] = React.useState<AcademicClosure | null>(null);
  const [events, setEvents] = React.useState<AcademicClosureEvent[]>([]);
  const [eventsPage, setEventsPage] = React.useState(0);
  const [eventsTotalPages, setEventsTotalPages] = React.useState(0);
  const [detailLoading, setDetailLoading] = React.useState(false);
  const [detailError, setDetailError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);

  const loadCapabilities = React.useCallback(async (signal?: AbortSignal) => {
    setCapabilitiesLoading(true);
    setCapabilitiesError(null);
    try {
      setCapabilities(await getDwClosureCapabilities(signal));
    } catch (cause) {
      if (signal?.aborted) return;
      setCapabilities(null);
      setCapabilitiesError(
        cause instanceof Error
          ? cause.message
          : 'No se pudieron verificar los permisos.',
      );
    } finally {
      if (!signal?.aborted) setCapabilitiesLoading(false);
    }
  }, []);

  const loadClosures = React.useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      setError(null);
      try {
        const result = await listAcademicClosures(
          { ...filters, page, size: PAGE_SIZE },
          signal,
        );
        setItems(result.items);
        setTotalElements(result.totalElements);
        setTotalPages(result.totalPages);
      } catch (cause) {
        if (signal?.aborted) return;
        setError(
          cause instanceof Error
            ? cause.message
            : 'No se pudieron cargar los cierres.',
        );
        setItems([]);
        setTotalElements(0);
        setTotalPages(0);
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [filters, page],
  );

  React.useEffect(() => {
    const controller = new AbortController();
    void loadCapabilities(controller.signal);
    return () => controller.abort();
  }, [loadCapabilities]);

  React.useEffect(() => {
    if (!capabilities?.canReadClosures) {
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    void loadClosures(controller.signal);
    return () => controller.abort();
  }, [capabilities?.canReadClosures, loadClosures]);

  const refresh = () => {
    setNotice(null);
    void loadClosures();
  };

  const applyFilters = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const gestion = gestionInput.trim() ? Number(gestionInput) : undefined;
    const periodo = periodoInput ? Number(periodoInput) : undefined;
    if (
      (gestion !== undefined &&
        (!Number.isInteger(gestion) || gestion < 2000 || gestion > 32767)) ||
      (periodo !== undefined &&
        (!Number.isInteger(periodo) || periodo < 1 || periodo > 32767))
    ) {
      setError('Revisa la gestión y el periodo seleccionados.');
      return;
    }
    setPage(0);
    setFilters({
      ...(gestion === undefined ? {} : { gestion }),
      ...(periodo === undefined ? {} : { periodo }),
      ...(statusInput ? { status: statusInput as ClosureStatus } : {}),
    });
    setNotice(null);
  };

  const clearFilters = () => {
    setGestionInput('');
    setPeriodoInput('');
    setStatusInput('');
    setFilters({});
    setPage(0);
    setError(null);
    setNotice(null);
  };

  const openDetail = async (closure: AcademicClosure, eventPage = 0) => {
    setDetail(closure);
    setEventsPage(eventPage);
    setDetailLoading(true);
    setDetailError(null);
    try {
      const [current, history] = await Promise.all([
        getAcademicClosure(closure.closureId),
        listAcademicClosureEvents(closure.closureId, eventPage),
      ]);
      setDetail(current);
      setEvents(history.items);
      setEventsTotalPages(history.totalPages);
    } catch (cause) {
      setDetailError(
        cause instanceof Error
          ? cause.message
          : 'No se pudo cargar el detalle.',
      );
      setEvents([]);
      setEventsTotalPages(0);
    } finally {
      setDetailLoading(false);
    }
  };

  const submitCreate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const gestion = Number(createGestion);
    const periodo = Number(createPeriodo);
    const reason = createReason.trim();
    if (!Number.isInteger(gestion) || gestion < 2000 || gestion > 32767) {
      setCreateError('Ingresa una gestión válida.');
      return;
    }
    if (!Number.isInteger(periodo) || periodo < 1 || periodo > 32767) {
      setCreateError('Selecciona un periodo académico válido.');
      return;
    }
    if (reason.length < 3 || reason.length > 500) {
      setCreateError('El motivo debe tener entre 3 y 500 caracteres.');
      return;
    }
    setCreating(true);
    setCreateError(null);
    try {
      await createAcademicClosure({ gestion, periodo, reason });
      setCreateOpen(false);
      setCreateReason('');
      setCreatePeriodo('');
      setPage(0);
      setFilters({ gestion });
      setGestionInput(String(gestion));
      setPeriodoInput('');
      setStatusInput('');
      setNotice(`Corte ${gestion} · ${periodLabel(periodo)} creado.`);
    } catch (cause) {
      setCreateError(
        cause instanceof Error ? cause.message : 'No se pudo crear el corte.',
      );
    } finally {
      setCreating(false);
    }
  };

  const submitAction = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!action) return;
    const reason = actionReason.trim();
    if (reason.length < 3 || reason.length > 500) {
      setActionError('El motivo debe tener entre 3 y 500 caracteres.');
      return;
    }
    if (action.mode === 'close' && !effectiveAt) {
      setActionError('Indica la fecha y hora efectiva del cierre.');
      return;
    }
    setActing(true);
    setActionError(null);
    try {
      if (action.mode === 'close') {
        await closeAcademicPeriod(action.closure.closureId, {
          effectiveAt: new Date(effectiveAt).toISOString(),
          reason,
        });
      } else {
        await reopenAcademicPeriod(action.closure.closureId, { reason });
      }
      setAction(null);
      setActionReason('');
      setEffectiveAt('');
      setNotice(
        action.mode === 'close'
          ? 'El cierre académico fue autorizado.'
          : 'El cierre académico fue reabierto.',
      );
      await loadClosures();
      if (detail?.closureId === action.closure.closureId)
        await openDetail(action.closure, eventsPage);
    } catch (cause) {
      setActionError(
        cause instanceof Error
          ? cause.message
          : 'No se pudo actualizar el cierre.',
      );
    } finally {
      setActing(false);
    }
  };

  const startAction = (mode: ActionMode, closure: AcademicClosure) => {
    setAction({ mode, closure });
    setActionReason('');
    setActionError(null);
    setEffectiveAt(new Date().toISOString().slice(0, 16));
  };

  const start = totalElements === 0 ? 0 : page * PAGE_SIZE + 1;
  const end = Math.min((page + 1) * PAGE_SIZE, totalElements);
  const hasFilters = Boolean(
    filters.gestion || filters.periodo || filters.status,
  );

  if (capabilitiesLoading) {
    return (
      <p
        className="py-12 text-center text-sm text-muted-foreground"
        role="status"
      >
        Verificando permisos de cierres…
      </p>
    );
  }
  if (capabilitiesError) {
    return (
      <section
        className="mx-auto max-w-3xl space-y-4"
        aria-labelledby="closures-title"
      >
        <h1 id="closures-title" className="text-2xl font-semibold">
          Cierres académicos
        </h1>
        <div
          role="alert"
          className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive"
        >
          No se pudieron verificar tus permisos: {capabilitiesError}
        </div>
        <Button variant="outline" onClick={() => void loadCapabilities()}>
          <RefreshCw aria-hidden="true" className="size-4" />
          Reintentar
        </Button>
      </section>
    );
  }
  if (!capabilities?.canReadClosures) {
    return (
      <section
        className="mx-auto max-w-3xl space-y-3"
        aria-labelledby="closures-title"
      >
        <h1 id="closures-title" className="text-2xl font-semibold">
          Cierres académicos
        </h1>
        <div
          className="rounded-lg border border-border bg-card p-5"
          role="status"
        >
          <p className="font-medium">
            No tienes permiso para consultar cierres académicos.
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Solicita el rol DW_CLOSURE_READ al administrador de Keycloak.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-6" aria-labelledby="closures-title">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <p className="text-sm font-medium text-muted-foreground">
            Administración · Data Warehouse
          </p>
          <h1
            id="closures-title"
            className="text-2xl font-semibold tracking-tight"
          >
            Cierres académicos
          </h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Gestiona cortes del calendario académico y consulta quién autorizó
            cada transición.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={refresh} disabled={loading}>
            <RefreshCw
              aria-hidden="true"
              className={`size-4 ${loading ? 'animate-spin' : ''}`}
            />
            Actualizar
          </Button>
          {capabilities.canManageClosures && (
            <Button
              onClick={() => {
                setCreateError(null);
                setCreateOpen(true);
              }}
            >
              <Plus aria-hidden="true" className="size-4" />
              Crear corte
            </Button>
          )}
        </div>
      </header>

      {notice && (
        <div
          className="flex items-start justify-between gap-3 rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm"
          role="status"
        >
          <span className="flex items-center gap-2">
            <CircleCheck aria-hidden="true" className="size-4 text-primary" />
            {notice}
          </span>
          <button
            type="button"
            aria-label="Cerrar aviso"
            className="rounded-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onClick={() => setNotice(null)}
          >
            <X aria-hidden="true" className="size-4" />
          </button>
        </div>
      )}

      <form
        onSubmit={applyFilters}
        className="grid gap-3 rounded-xl border border-border bg-card p-4 sm:grid-cols-2 lg:grid-cols-[minmax(9rem,1fr)_minmax(9rem,1fr)_minmax(10rem,1fr)_auto_auto] lg:items-end"
        aria-label="Filtros de cierres"
      >
        <div className="space-y-1.5">
          <label
            htmlFor="closure-filter-gestion"
            className="text-sm font-medium"
          >
            Gestión
          </label>
          <Input
            id="closure-filter-gestion"
            inputMode="numeric"
            type="number"
            min="2000"
            max="32767"
            value={gestionInput}
            onChange={(event) => setGestionInput(event.target.value)}
            placeholder="Ej. 2026"
          />
        </div>
        <div className="space-y-1.5">
          <label
            htmlFor="closure-filter-period"
            className="text-sm font-medium"
          >
            Periodo
          </label>
          <Input
            id="closure-filter-period"
            type="number"
            min="1"
            max="32767"
            value={periodoInput}
            onChange={(event) => setPeriodoInput(event.target.value)}
            placeholder="Todos"
          />
        </div>
        <div className="space-y-1.5">
          <label
            htmlFor="closure-filter-status"
            className="text-sm font-medium"
          >
            Estado
          </label>
          <Select
            id="closure-filter-status"
            value={statusInput}
            onChange={(event) => setStatusInput(event.target.value)}
          >
            <option value="">Todos</option>
            {STATUSES.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </Select>
        </div>
        <Button type="submit" variant="secondary">
          Aplicar filtros
        </Button>
        {hasFilters && (
          <Button type="button" variant="ghost" onClick={clearFilters}>
            Limpiar
          </Button>
        )}
      </form>

      {error && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive"
        >
          <span className="flex items-center gap-2">
            <CircleAlert aria-hidden="true" className="size-4 shrink-0" />
            {error}
          </span>
          <Button size="sm" variant="outline" onClick={refresh}>
            Reintentar
          </Button>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <CalendarClock
              aria-hidden="true"
              className="size-4 text-muted-foreground"
            />
            Calendario de cierres
          </div>
          <p className="text-xs text-muted-foreground">
            {loading
              ? 'Actualizando…'
              : `${totalElements} ${totalElements === 1 ? 'registro' : 'registros'}`}
          </p>
        </div>
        <div className="overflow-x-auto">
          <Table aria-busy={loading}>
            <TableHeader>
              <TableRow>
                <TableHead>Gestión / periodo</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Fecha efectiva</TableHead>
                <TableHead>Autorizado por</TableHead>
                <TableHead>Actualizado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading &&
                Array.from({ length: 4 }, (_, index) => (
                  <TableRow key={`loading-${index}`}>
                    <TableCell colSpan={6}>
                      <span className="block h-5 animate-pulse rounded bg-muted" />
                    </TableCell>
                  </TableRow>
                ))}
              {!loading &&
                !error &&
                items.map((closure) => (
                  <TableRow key={closure.closureId}>
                    <TableCell>
                      <span className="block font-medium">
                        {closure.gestion} · {periodLabel(closure.periodo)}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        Corte #{closure.closureId}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(closure.status)}>
                        {closure.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatDate(closure.effectiveAt)}</TableCell>
                    <TableCell
                      className="max-w-48 truncate"
                      title={closure.authorizedBySubject ?? undefined}
                    >
                      {closure.authorizedBySubject ?? '—'}
                    </TableCell>
                    <TableCell>{formatDate(closure.updatedAt)}</TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          aria-label={`Ver detalle del corte ${closure.gestion} periodo ${closure.periodo}`}
                          onClick={() => void openDetail(closure)}
                        >
                          <Eye aria-hidden="true" className="size-4" />
                          <span className="sr-only">Ver detalle</span>
                        </Button>
                        {capabilities.canManageClosures &&
                          closure.status !== 'PROCESADO' &&
                          (closure.status === 'CERRADO' ? (
                            <Button
                              size="sm"
                              variant="outline"
                              aria-label={`Reabrir corte ${closure.gestion} periodo ${closure.periodo}`}
                              onClick={() => startAction('reopen', closure)}
                            >
                              <RotateCcw
                                aria-hidden="true"
                                className="size-4"
                              />
                              Reabrir
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              aria-label={`Autorizar cierre ${closure.gestion} periodo ${closure.periodo}`}
                              onClick={() => startAction('close', closure)}
                            >
                              <ShieldCheck
                                aria-hidden="true"
                                className="size-4"
                              />
                              Cerrar
                            </Button>
                          ))}
                        {closure.status === 'PROCESADO' && (
                          <span className="pr-2 text-xs text-muted-foreground">
                            Informativo
                          </span>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              {!loading && !error && items.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-12 text-center">
                    <div className="mx-auto flex max-w-md flex-col items-center gap-2">
                      <CalendarClock
                        aria-hidden="true"
                        className="size-8 text-muted-foreground"
                      />
                      <p className="font-medium">
                        {hasFilters
                          ? 'No hay cierres con esos filtros'
                          : 'Aún no hay cortes académicos'}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {hasFilters
                          ? 'Cambia o limpia los filtros para ver otros periodos.'
                          : 'Crea un corte para iniciar el calendario de autorización.'}
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        <nav
          aria-label="Paginación de cierres académicos"
          className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3"
        >
          <p className="text-sm text-muted-foreground">
            Mostrando {start}–{end} de {totalElements}
          </p>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              Página {totalPages === 0 ? 0 : page + 1} de {totalPages}
            </span>
            <Button
              size="sm"
              variant="outline"
              aria-label="Página anterior"
              disabled={loading || page === 0}
              onClick={() => setPage((current) => Math.max(0, current - 1))}
            >
              <ChevronLeft aria-hidden="true" className="size-4" />
              Anterior
            </Button>
            <Button
              size="sm"
              variant="outline"
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
        open={detail !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDetail(null);
            setDetailError(null);
          }
        }}
      >
        <SheetContent
          side="right"
          showCloseButton
          className="w-full overflow-y-auto sm:max-w-xl"
        >
          <SheetHeader className="border-b border-border px-6 pt-6">
            <SheetTitle>Detalle del cierre</SheetTitle>
            <SheetDescription>
              {detail
                ? `${detail.gestion} · ${periodLabel(detail.periodo)} · Corte #${detail.closureId}`
                : 'Detalle e historial de auditoría.'}
            </SheetDescription>
          </SheetHeader>
          {detail && (
            <div className="space-y-6 px-6 pb-4">
              {detailLoading && (
                <p className="text-sm text-muted-foreground" role="status">
                  Cargando detalle e historial…
                </p>
              )}
              {detailError && (
                <p
                  role="alert"
                  className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
                >
                  {detailError}
                </p>
              )}
              {!detailError && (
                <>
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-4 rounded-lg border border-border bg-muted/20 p-4 text-sm">
                    <div>
                      <dt className="text-muted-foreground">Estado actual</dt>
                      <dd className="mt-1">
                        <Badge variant={statusVariant(detail.status)}>
                          {detail.status}
                        </Badge>
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Versión</dt>
                      <dd className="mt-1 font-medium">{detail.version}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Fecha efectiva</dt>
                      <dd className="mt-1 font-medium">
                        {formatDate(detail.effectiveAt)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Procesado</dt>
                      <dd className="mt-1 font-medium">
                        {formatDate(detail.processedAt)}
                      </dd>
                    </div>
                    <div className="col-span-2">
                      <dt className="text-muted-foreground">
                        Motivo de creación
                      </dt>
                      <dd className="mt-1 whitespace-pre-wrap">
                        {detail.closureReason || '—'}
                      </dd>
                    </div>
                    <div className="col-span-2">
                      <dt className="text-muted-foreground">Creado por</dt>
                      <dd className="mt-1 break-all font-medium">
                        {detail.createdBySubject}
                      </dd>
                    </div>
                    <div className="col-span-2">
                      <dt className="text-muted-foreground">Autorizado por</dt>
                      <dd className="mt-1 break-all font-medium">
                        {detail.authorizedBySubject ?? '—'}
                      </dd>
                    </div>
                    {detail.processedRunId && (
                      <div className="col-span-2">
                        <dt className="text-muted-foreground">Ejecución ETL</dt>
                        <dd className="mt-1 break-all font-medium">
                          {detail.processedRunId}
                        </dd>
                      </div>
                    )}
                  </dl>
                  <section
                    aria-labelledby="closure-history-title"
                    className="space-y-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <h2
                        id="closure-history-title"
                        className="flex items-center gap-2 font-medium"
                      >
                        <History aria-hidden="true" className="size-4" />
                        Historial de auditoría
                      </h2>
                      <span className="text-xs text-muted-foreground">
                        {events.length} eventos
                      </span>
                    </div>
                    {events.length === 0 ? (
                      <p className="rounded-lg border border-border p-4 text-sm text-muted-foreground">
                        Aún no hay eventos registrados.
                      </p>
                    ) : (
                      <ol className="space-y-3">
                        {events.map((entry) => (
                          <li
                            key={entry.eventId}
                            className="relative rounded-lg border border-border p-4"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <Badge variant="outline">
                                {entry.fromStatus ?? 'INICIO'} →{' '}
                                {entry.toStatus}
                              </Badge>
                              <time className="text-xs text-muted-foreground">
                                {formatDate(entry.occurredAt)}
                              </time>
                            </div>
                            <p className="mt-2 text-sm">{entry.reason}</p>
                            <p className="mt-2 break-all text-xs text-muted-foreground">
                              Actor: {entry.actorSubject}
                            </p>
                            {entry.runId && (
                              <p className="mt-1 break-all text-xs text-muted-foreground">
                                Ejecución: {entry.runId}
                              </p>
                            )}
                          </li>
                        ))}
                      </ol>
                    )}
                    {eventsTotalPages > 1 && (
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">
                          Página {eventsPage + 1} de {eventsTotalPages}
                        </span>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            aria-label="Página anterior del historial"
                            disabled={eventsPage === 0 || detailLoading}
                            onClick={() =>
                              void openDetail(detail, eventsPage - 1)
                            }
                          >
                            <ChevronLeft
                              aria-hidden="true"
                              className="size-4"
                            />
                            Anterior
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            aria-label="Página siguiente del historial"
                            disabled={
                              eventsPage + 1 >= eventsTotalPages ||
                              detailLoading
                            }
                            onClick={() =>
                              void openDetail(detail, eventsPage + 1)
                            }
                          >
                            Siguiente
                            <ChevronRight
                              aria-hidden="true"
                              className="size-4"
                            />
                          </Button>
                        </div>
                      </div>
                    )}
                  </section>
                  {capabilities.canManageClosures &&
                    detail.status !== 'PROCESADO' && (
                      <div className="flex flex-wrap gap-2 border-t border-border pt-4">
                        {detail.status === 'CERRADO' ? (
                          <Button
                            variant="outline"
                            onClick={() => startAction('reopen', detail)}
                          >
                            <RotateCcw aria-hidden="true" className="size-4" />
                            Reabrir cierre
                          </Button>
                        ) : (
                          <Button
                            variant="outline"
                            onClick={() => startAction('close', detail)}
                          >
                            <ShieldCheck
                              aria-hidden="true"
                              className="size-4"
                            />
                            Autorizar cierre
                          </Button>
                        )}
                      </div>
                    )}
                  {detail.status === 'PROCESADO' && (
                    <p className="flex items-center gap-2 rounded-md bg-muted/30 p-3 text-sm text-muted-foreground">
                      <CircleCheck aria-hidden="true" className="size-4" />
                      El corte fue procesado y se muestra únicamente como
                      referencia.
                    </p>
                  )}
                </>
              )}
            </div>
          )}
          <SheetFooter className="border-t border-border px-6 pb-6">
            <Button variant="outline" onClick={() => setDetail(null)}>
              Cerrar detalle
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <Dialog
        open={createOpen}
        onOpenChange={(open) => {
          if (!creating) setCreateOpen(open);
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Crear corte académico</DialogTitle>
            <DialogDescription>
              Registra el periodo y el motivo. El nuevo corte iniciará en estado
              PENDIENTE.
            </DialogDescription>
          </DialogHeader>
          <form
            id="create-academic-closure"
            onSubmit={(event) => void submitCreate(event)}
            className="space-y-4"
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label
                  htmlFor="create-closure-gestion"
                  className="text-sm font-medium"
                >
                  Gestión <span aria-hidden="true">*</span>
                </label>
                <Input
                  id="create-closure-gestion"
                  required
                  type="number"
                  min="2000"
                  max="32767"
                  value={createGestion}
                  onChange={(event) => setCreateGestion(event.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <label
                  htmlFor="create-closure-period"
                  className="text-sm font-medium"
                >
                  Periodo <span aria-hidden="true">*</span>
                </label>
                <Input
                  id="create-closure-period"
                  required
                  type="number"
                  min="1"
                  max="32767"
                  value={createPeriodo}
                  onChange={(event) => setCreatePeriodo(event.target.value)}
                  placeholder="Ej. 1"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label
                htmlFor="create-closure-reason"
                className="text-sm font-medium"
              >
                Motivo de creación <span aria-hidden="true">*</span>
              </label>
              <Textarea
                id="create-closure-reason"
                required
                minLength={3}
                maxLength={500}
                rows={4}
                value={createReason}
                onChange={(event) => setCreateReason(event.target.value)}
                placeholder="Describe por qué se registra este corte."
              />
              <p className="text-xs text-muted-foreground">
                {createReason.trim().length}/500 caracteres
              </p>
            </div>
            {createError && (
              <p
                role="alert"
                className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
              >
                {createError}
              </p>
            )}
          </form>
          <DialogFooter>
            <Button
              variant="outline"
              type="button"
              disabled={creating}
              onClick={() => setCreateOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              form="create-academic-closure"
              loading={creating}
            >
              Crear corte
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={action !== null}
        onOpenChange={(open) => {
          if (!open && !acting) setAction(null);
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {action?.mode === 'close'
                ? 'Autorizar cierre académico'
                : 'Reabrir cierre académico'}
            </DialogTitle>
            <DialogDescription>
              {action
                ? `${action.closure.gestion} · ${periodLabel(action.closure.periodo)} · Corte #${action.closure.closureId}`
                : 'Confirma el cambio de estado.'}{' '}
              Indica un motivo para dejar constancia en el historial de
              auditoría.
            </DialogDescription>
          </DialogHeader>
          {action?.mode === 'close' && (
            <div className="space-y-1.5">
              <label
                htmlFor="closure-effective-at"
                className="text-sm font-medium"
              >
                Fecha efectiva <span aria-hidden="true">*</span>
              </label>
              <Input
                id="closure-effective-at"
                type="datetime-local"
                required
                value={effectiveAt}
                onChange={(event) => setEffectiveAt(event.target.value)}
              />
            </div>
          )}
          <form
            id="closure-action-form"
            onSubmit={(event) => void submitAction(event)}
            className="space-y-4"
          >
            <div className="space-y-1.5">
              <label
                htmlFor="closure-action-reason"
                className="text-sm font-medium"
              >
                Motivo <span aria-hidden="true">*</span>
              </label>
              <Textarea
                id="closure-action-reason"
                required
                minLength={3}
                maxLength={500}
                rows={4}
                value={actionReason}
                onChange={(event) => setActionReason(event.target.value)}
                placeholder={
                  action?.mode === 'close'
                    ? 'Motivo de la autorización del cierre.'
                    : 'Motivo para reabrir este cierre.'
                }
              />
              <p className="text-xs text-muted-foreground">
                {actionReason.trim().length}/500 caracteres
              </p>
            </div>
            {actionError && (
              <p
                role="alert"
                className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
              >
                {actionError}
              </p>
            )}
          </form>
          <DialogFooter>
            <Button
              variant="outline"
              type="button"
              disabled={acting}
              onClick={() => setAction(null)}
            >
              Cancelar
            </Button>
            <Button type="submit" form="closure-action-form" loading={acting}>
              {action?.mode === 'close'
                ? 'Confirmar cierre'
                : 'Confirmar reapertura'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
