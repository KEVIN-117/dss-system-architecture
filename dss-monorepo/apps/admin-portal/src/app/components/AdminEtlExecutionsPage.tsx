'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  Button,
  Input,
  Loader,
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@dss-monorepo/design-system';
import {
  Activity,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  CircleX,
  Database,
  RefreshCw,
  SlidersHorizontal,
  X,
} from 'lucide-react';

import {
  getDwClosureCapabilities,
  listEtlExecutions,
  type DwClosureCapabilities,
  type EtlExecutionSummary,
  type ExecutionFilters,
  type ExecutionKind,
  type ExecutionStatus,
} from '../data-access/dw-control';
import {
  ACTIVE_STATUSES,
  KIND_LABEL,
  STATUS_META,
  dateLabel,
  durationLabel,
  formatNumber,
  relativeLabel,
} from './etl/etl-format';
import {
  AutoRefreshSwitch,
  CopyButton,
  KpiCard,
  StatusPill,
  useNow,
} from './etl/EtlUi';

const PAGE_SIZE = 20;
const AUTO_REFRESH_SECONDS = 15;
const KINDS: ExecutionKind[] = ['HISTORICA', 'CIERRE_ACADEMICO', 'REPROCESO'];

type StatusTab = 'ALL' | ExecutionStatus;

const TABS: { id: StatusTab; label: string }[] = [
  { id: 'ALL', label: 'Todas' },
  { id: 'EN_EJECUCION', label: 'En ejecución' },
  { id: 'FALLIDA', label: 'Fallidas' },
  { id: 'EXITOSA', label: 'Exitosas' },
  { id: 'CANCELADA', label: 'Canceladas' },
];

type Counts = {
  total: number;
  active: number;
  running: number;
  failed: number;
  succeeded: number;
  cancelled: number;
};

async function countByStatus(
  status: ExecutionStatus | undefined,
  signal: AbortSignal,
): Promise<number> {
  const page = await listEtlExecutions(
    { page: 0, size: 1, ...(status ? { status } : {}) },
    signal,
  );
  return page.totalElements;
}

export function AdminEtlExecutionsPage() {
  const [capabilities, setCapabilities] =
    React.useState<DwClosureCapabilities | null>(null);
  const [capabilityError, setCapabilityError] = React.useState<string | null>(
    null,
  );
  const [capabilityLoading, setCapabilityLoading] = React.useState(true);
  const [items, setItems] = React.useState<EtlExecutionSummary[]>([]);
  const [page, setPage] = React.useState(0);
  const [totalElements, setTotalElements] = React.useState(0);
  const [totalPages, setTotalPages] = React.useState(0);
  const [filters, setFilters] = React.useState<ExecutionFilters>({
    page: 0,
    size: PAGE_SIZE,
  });
  const [tab, setTab] = React.useState<StatusTab>('ALL');
  const [showAdvanced, setShowAdvanced] = React.useState(false);
  const [kindInput, setKindInput] = React.useState('');
  const [gestionInput, setGestionInput] = React.useState('');
  const [periodoInput, setPeriodoInput] = React.useState('');
  const [closureInput, setClosureInput] = React.useState('');
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = React.useState<string | null>(null);
  const [counts, setCounts] = React.useState<Counts | null>(null);
  const [autoRefresh, setAutoRefresh] = React.useState(true);

  React.useEffect(() => {
    const controller = new AbortController();
    setCapabilityLoading(true);
    getDwClosureCapabilities(controller.signal)
      .then(setCapabilities)
      .catch((cause: unknown) => {
        if (!controller.signal.aborted)
          setCapabilityError(
            cause instanceof Error
              ? cause.message
              : 'No se pudo verificar el acceso.',
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setCapabilityLoading(false);
      });
    return () => controller.abort();
  }, []);

  const loadCounts = React.useCallback(async () => {
    const controller = new AbortController();
    try {
      const [total, requested, running, publishing, failed, succeeded, cancelled] =
        await Promise.all([
          countByStatus(undefined, controller.signal),
          countByStatus('SOLICITADA', controller.signal),
          countByStatus('EN_EJECUCION', controller.signal),
          countByStatus('PUBLICANDO', controller.signal),
          countByStatus('FALLIDA', controller.signal),
          countByStatus('EXITOSA', controller.signal),
          countByStatus('CANCELADA', controller.signal),
        ]);
      setCounts({
        total,
        active: requested + running + publishing,
        running,
        failed,
        succeeded,
        cancelled,
      });
    } catch {
      // Los indicadores son complementarios: la tabla informa del error.
      setCounts(null);
    }
  }, []);

  const loadExecutions = React.useCallback(
    async (nextFilters: ExecutionFilters, quiet = false) => {
      const controller = new AbortController();
      if (!quiet) setLoading(true);
      setError(null);
      try {
        const result = await listEtlExecutions(nextFilters, controller.signal);
        setItems(result.items);
        setPage(result.page);
        setTotalElements(result.totalElements);
        setTotalPages(result.totalPages);
        setUpdatedAt(new Date().toISOString());
      } catch (cause) {
        setError(
          cause instanceof Error
            ? cause.message
            : 'No se pudieron cargar las ejecuciones.',
        );
      } finally {
        if (!quiet) setLoading(false);
      }
    },
    [],
  );

  const canRead = capabilities?.canReadEtlExecutions === true;

  React.useEffect(() => {
    if (canRead) void loadExecutions(filters);
  }, [canRead, filters, loadExecutions]);

  React.useEffect(() => {
    if (canRead) void loadCounts();
  }, [canRead, loadCounts]);

  const hasActive =
    (counts?.active ?? 0) > 0 ||
    items.some((item) => ACTIVE_STATUSES.includes(item.status));

  React.useEffect(() => {
    if (!canRead || !autoRefresh || !hasActive) return;
    const id = window.setInterval(() => {
      void loadExecutions(filters, true);
      void loadCounts();
    }, AUTO_REFRESH_SECONDS * 1000);
    return () => window.clearInterval(id);
  }, [canRead, autoRefresh, hasActive, filters, loadExecutions, loadCounts]);

  const now = useNow(hasActive);

  function buildFilters(nextTab: StatusTab): ExecutionFilters {
    const next: ExecutionFilters = { page: 0, size: PAGE_SIZE };
    if (nextTab !== 'ALL') next.status = nextTab;
    if (kindInput) next.executionKind = kindInput as ExecutionKind;
    if (gestionInput && Number.isInteger(Number(gestionInput)))
      next.gestion = Number(gestionInput);
    if (periodoInput && Number.isInteger(Number(periodoInput)))
      next.periodo = Number(periodoInput);
    if (closureInput && Number.isInteger(Number(closureInput)))
      next.closureId = Number(closureInput);
    return next;
  }

  function selectTab(nextTab: StatusTab) {
    setTab(nextTab);
    setFilters(buildFilters(nextTab));
  }

  function applyFilters(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFilters(buildFilters(tab));
  }

  function clearFilters() {
    setKindInput('');
    setGestionInput('');
    setPeriodoInput('');
    setClosureInput('');
    const next: ExecutionFilters = { page: 0, size: PAGE_SIZE };
    if (tab !== 'ALL') next.status = tab;
    setFilters(next);
  }

  function refresh() {
    void loadExecutions(filters);
    void loadCounts();
  }

  if (capabilityLoading)
    return (
      <section aria-busy="true" className="p-6 text-sm text-muted-foreground">
        Verificando acceso a ejecuciones ETL…
      </section>
    );
  if (capabilityError)
    return (
      <section
        role="alert"
        className="m-6 rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive"
      >
        {capabilityError}
      </section>
    );
  if (!canRead)
    return (
      <section className="m-6 rounded-md border border-border bg-card p-6">
        <h1 className="text-lg font-semibold">Acceso restringido</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Tu cuenta no tiene permiso para consultar ejecuciones ETL.
        </p>
      </section>
    );

  const firstRecord = totalElements === 0 ? 0 : page * PAGE_SIZE + 1;
  const lastRecord = Math.min((page + 1) * PAGE_SIZE, totalElements);
  const advancedCount = [kindInput, gestionInput, periodoInput, closureInput].filter(
    Boolean,
  ).length;
  const tabCount = (id: StatusTab): number | undefined => {
    if (!counts) return undefined;
    if (id === 'ALL') return counts.total;
    if (id === 'EN_EJECUCION') return counts.running;
    if (id === 'FALLIDA') return counts.failed;
    if (id === 'EXITOSA') return counts.succeeded;
    if (id === 'CANCELADA') return counts.cancelled;
    return undefined;
  };
  const finished = counts ? counts.succeeded + counts.failed : 0;
  const successRate =
    counts && finished > 0
      ? Math.round((counts.succeeded / finished) * 100)
      : null;

  return (
    <section className="space-y-6 p-4 md:p-6" aria-labelledby="etl-executions-title">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">
            Administración · Data Warehouse
          </p>
          <h1 id="etl-executions-title" className="mt-1 text-2xl font-semibold">
            Ejecuciones ETL
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Monitorea las cargas del Data Warehouse: estado, avance por fases,
            métricas e incidencias. Vista de solo lectura.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          {hasActive && (
            <AutoRefreshSwitch
              checked={autoRefresh}
              onChange={setAutoRefresh}
              seconds={AUTO_REFRESH_SECONDS}
            />
          )}
          <Button variant="outline" disabled={loading} onClick={refresh}>
            <RefreshCw
              aria-hidden="true"
              className={`mr-2 size-4 ${loading ? 'motion-safe:animate-spin' : ''}`}
            />
            Actualizar
          </Button>
        </div>
      </header>

      {/* Indicadores */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Ejecuciones registradas"
          value={counts ? formatNumber(counts.total) : '—'}
          hint="Historial completo"
          icon={Database}
        />
        <KpiCard
          label="En curso"
          value={counts ? formatNumber(counts.active) : '—'}
          hint={counts?.active ? 'Solicitadas, en ejecución o publicando' : 'Ninguna carga activa'}
          icon={Activity}
          tone={counts?.active ? 'running' : 'neutral'}
        />
        <KpiCard
          label="Fallidas"
          value={counts ? formatNumber(counts.failed) : '—'}
          hint={counts?.failed ? 'Revisa sus incidencias' : 'Sin fallos registrados'}
          icon={CircleX}
          tone={counts?.failed ? 'danger' : 'neutral'}
        />
        <KpiCard
          label="Tasa de éxito"
          value={successRate === null ? '—' : `${successRate}%`}
          hint={counts ? `${formatNumber(counts.succeeded)} exitosas de ${formatNumber(finished)} finalizadas` : undefined}
          icon={CircleCheck}
          tone="success"
        >
          {successRate !== null && (
            <div
              role="progressbar"
              aria-label="Tasa de éxito"
              aria-valuenow={successRate}
              aria-valuemin={0}
              aria-valuemax={100}
              className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted"
            >
              <div className="h-full rounded-full bg-success" style={{ width: `${successRate}%` }} />
            </div>
          )}
        </KpiCard>
      </div>

      <div className="rounded-xl border border-border bg-card">
        {/* Pestañas de estado + filtros */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-3">
          <div role="group" aria-label="Filtrar por estado" className="flex flex-wrap gap-1">
            {TABS.map((t) => {
              const count = tabCount(t.id);
              const active = tab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => selectTab(t.id)}
                  className={`inline-flex h-9 items-center gap-2 rounded-lg px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                    active
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`}
                >
                  {t.label}
                  {count !== undefined && (
                    <span
                      className={`rounded-full px-1.5 text-xs tabular-nums ${
                        active ? 'bg-primary-foreground/20' : 'bg-muted'
                      }`}
                    >
                      {formatNumber(count)}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <Button
            variant="outline"
            size="sm"
            aria-expanded={showAdvanced}
            aria-controls="etl-advanced-filters"
            onClick={() => setShowAdvanced((v) => !v)}
          >
            <SlidersHorizontal aria-hidden="true" className="mr-1.5 size-4" />
            Más filtros
            {advancedCount > 0 && (
              <span className="ml-1.5 rounded-full bg-primary px-1.5 text-xs text-primary-foreground">
                {advancedCount}
              </span>
            )}
          </Button>
        </div>

        <form
          id="etl-advanced-filters"
          hidden={!showAdvanced}
          onSubmit={applyFilters}
          className="grid gap-3 border-b border-border p-4 sm:grid-cols-2 xl:grid-cols-5"
        >
          <label className="space-y-1.5 text-sm font-medium">
            <span>Tipo de ejecución</span>
            <select
              value={kindInput}
              onChange={(event) => setKindInput(event.target.value)}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="">Todos</option>
              {KINDS.map((kind) => (
                <option key={kind} value={kind}>
                  {KIND_LABEL[kind]}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1.5 text-sm font-medium">
            <span>Gestión</span>
            <Input
              type="number"
              inputMode="numeric"
              min="2000"
              value={gestionInput}
              onChange={(event) => setGestionInput(event.target.value)}
              placeholder="Ej. 2026"
            />
          </label>
          <label className="space-y-1.5 text-sm font-medium">
            <span>Periodo</span>
            <Input
              type="number"
              inputMode="numeric"
              min="1"
              value={periodoInput}
              onChange={(event) => setPeriodoInput(event.target.value)}
              placeholder="Ej. 1"
            />
          </label>
          <label className="space-y-1.5 text-sm font-medium">
            <span>ID de cierre</span>
            <Input
              type="number"
              inputMode="numeric"
              min="1"
              value={closureInput}
              onChange={(event) => setClosureInput(event.target.value)}
              placeholder="Opcional"
            />
          </label>
          <div className="flex items-end gap-2">
            <Button type="submit" className="flex-1">
              Aplicar filtros
            </Button>
            <Button type="button" variant="ghost" onClick={clearFilters} aria-label="Limpiar filtros">
              <X aria-hidden="true" className="size-4" />
            </Button>
          </div>
        </form>

        {error && (
          <div
            role="alert"
            className="m-4 flex items-center justify-between gap-4 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
          >
            <span>{error}</span>
            <Button variant="outline" size="sm" onClick={refresh}>
              Reintentar
            </Button>
          </div>
        )}

        <div className="overflow-x-auto">
          <Table aria-busy={loading} className="[&_td]:font-sans">
            <TableCaption className="sr-only">
              Historial de ejecuciones ETL, {formatNumber(totalElements)} registros
            </TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead scope="col">Ejecución</TableHead>
                <TableHead scope="col">Estado</TableHead>
                <TableHead scope="col">Gestión / periodo</TableHead>
                <TableHead scope="col">Inicio</TableHead>
                <TableHead scope="col">Duración</TableHead>
                <TableHead scope="col">Solicitado por</TableHead>
                <TableHead scope="col" className="text-right">
                  <span className="sr-only">Acciones</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && (
                <TableRow>
                  <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                    <Loader text="Cargando ejecuciones…" fullScreen={false} className="min-h-24" />
                  </TableCell>
                </TableRow>
              )}
              {!loading &&
                !error &&
                items.map((execution) => {
                  const meta = STATUS_META[execution.status];
                  const href = `/etl-executions/${encodeURIComponent(execution.runId)}`;
                  return (
                    <TableRow key={execution.runId} className="group">
                      <TableCell>
                        <div className="font-medium">
                          {KIND_LABEL[execution.executionKind]}
                        </div>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <span className="font-mono" title={execution.runId}>
                            {execution.runId.slice(0, 8)}…
                          </span>
                          <CopyButton
                            value={execution.runId}
                            label={`Copiar ID de ejecución ${execution.runId}`}
                            className="opacity-70 group-hover:opacity-100"
                          />
                        </div>
                      </TableCell>
                      <TableCell>
                        <StatusPill tone={meta.tone} label={meta.label} size="sm" />
                      </TableCell>
                      <TableCell>
                        <span className="tabular-nums">
                          {execution.requestedGestion ?? '—'}
                          {execution.requestedPeriodo
                            ? ` · P${execution.requestedPeriodo}`
                            : ''}
                        </span>
                        {execution.closureId ? (
                          <div className="text-xs text-muted-foreground">
                            Cierre #{execution.closureId}
                          </div>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        <time
                          dateTime={execution.startedAt ?? execution.requestedAt}
                          title={dateLabel(execution.startedAt ?? execution.requestedAt)}
                        >
                          {relativeLabel(execution.startedAt ?? execution.requestedAt, now)}
                        </time>
                        <div className="text-xs text-muted-foreground">
                          {dateLabel(execution.startedAt ?? execution.requestedAt)}
                        </div>
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {durationLabel(execution.startedAt, execution.endedAt, now)}
                        {ACTIVE_STATUSES.includes(execution.status) && execution.startedAt && (
                          <div className="text-xs text-muted-foreground">y contando</div>
                        )}
                      </TableCell>
                      <TableCell className="max-w-48 truncate" title={execution.requestedBy}>
                        {execution.requestedBy}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button asChild variant="outline" size="sm">
                          <Link
                            href={href}
                            aria-label={`Ver detalle de la ejecución ${execution.runId.slice(0, 8)}`}
                          >
                            Ver detalle
                            <ChevronRight aria-hidden="true" className="ml-1 size-3.5" />
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              {!loading && !error && items.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="py-12 text-center">
                    <p className="font-medium">No hay ejecuciones para mostrar</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Ajusta los filtros o vuelve a consultar más tarde.
                    </p>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3 text-sm text-muted-foreground">
          <span aria-live="polite">
            Mostrando {firstRecord}–{lastRecord} de {formatNumber(totalElements)}
            {updatedAt ? ` · Actualizado ${dateLabel(updatedAt)}` : ''}
          </span>
          <nav aria-label="Paginación" className="flex items-center gap-2">
            <span>
              Página {totalPages === 0 ? 0 : page + 1} de {totalPages}
            </span>
            <Button
              aria-label="Página anterior"
              variant="outline"
              size="sm"
              disabled={loading || page <= 0}
              onClick={() => setFilters({ ...filters, page: page - 1 })}
            >
              <ChevronLeft aria-hidden="true" className="size-4" />
            </Button>
            <Button
              aria-label="Página siguiente"
              variant="outline"
              size="sm"
              disabled={loading || page + 1 >= totalPages}
              onClick={() => setFilters({ ...filters, page: page + 1 })}
            >
              <ChevronRight aria-hidden="true" className="size-4" />
            </Button>
          </nav>
        </footer>
      </div>
    </section>
  );
}
