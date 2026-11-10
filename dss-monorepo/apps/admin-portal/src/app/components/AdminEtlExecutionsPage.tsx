'use client';

import * as React from 'react';
import {
  Badge,
  Button,
  Input,
  Loader,
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
import { ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';

import {
  getDwClosureCapabilities,
  getEtlExecution,
  listEtlExecutions,
  type DwClosureCapabilities,
  type EtlExecutionDetail,
  type EtlExecutionSummary,
  type ExecutionFilters,
  type ExecutionKind,
  type ExecutionStatus,
} from '../data-access/dw-control';

const PAGE_SIZE = 20;
const STATUSES: ExecutionStatus[] = [
  'SOLICITADA',
  'EN_EJECUCION',
  'PUBLICANDO',
  'EXITOSA',
  'FALLIDA',
  'CANCELADA',
];
const KINDS: ExecutionKind[] = ['HISTORICA', 'CIERRE_ACADEMICO', 'REPROCESO'];

function dateLabel(value: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? '—'
    : new Intl.DateTimeFormat('es-BO', {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(date);
}

function durationLabel(start: string | null, end: string | null): string {
  if (!start) return '—';
  const from = new Date(start).getTime();
  const to = end ? new Date(end).getTime() : Date.now();
  if (!Number.isFinite(from) || !Number.isFinite(to) || to < from) return '—';
  const seconds = Math.floor((to - from) / 1000);
  if (seconds < 60) return `${seconds} s`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes} min ${seconds % 60} s`;
}

function statusVariant(
  status: ExecutionStatus,
): React.ComponentProps<typeof Badge>['variant'] {
  if (status === 'EXITOSA') return 'secondary';
  if (status === 'FALLIDA') return 'destructive';
  if (status === 'CANCELADA') return 'outline';
  return 'default';
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
  const [statusInput, setStatusInput] = React.useState('');
  const [kindInput, setKindInput] = React.useState('');
  const [gestionInput, setGestionInput] = React.useState('');
  const [periodoInput, setPeriodoInput] = React.useState('');
  const [closureInput, setClosureInput] = React.useState('');
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = React.useState<string | null>(null);
  const [selected, setSelected] = React.useState<EtlExecutionDetail | null>(
    null,
  );
  const [detailLoading, setDetailLoading] = React.useState(false);
  const [detailError, setDetailError] = React.useState<string | null>(null);

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

  const loadExecutions = React.useCallback(
    async (nextFilters: ExecutionFilters) => {
      const controller = new AbortController();
      setLoading(true);
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
        setLoading(false);
      }
    },
    [],
  );

  React.useEffect(() => {
    if (capabilities?.canReadEtlExecutions) void loadExecutions(filters);
  }, [capabilities?.canReadEtlExecutions, filters, loadExecutions]);

  function applyFilters(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next: ExecutionFilters = { page: 0, size: PAGE_SIZE };
    if (statusInput) next.status = statusInput as ExecutionStatus;
    if (kindInput) next.executionKind = kindInput as ExecutionKind;
    if (gestionInput && Number.isInteger(Number(gestionInput)))
      next.gestion = Number(gestionInput);
    if (periodoInput && Number.isInteger(Number(periodoInput)))
      next.periodo = Number(periodoInput);
    if (closureInput && Number.isInteger(Number(closureInput)))
      next.closureId = Number(closureInput);
    setFilters(next);
  }

  function goToPage(nextPage: number) {
    const next = { ...filters, page: nextPage };
    setFilters(next);
  }

  async function openDetail(runId: string) {
    setSelected(null);
    setDetailError(null);
    setDetailLoading(true);
    try {
      setSelected(await getEtlExecution(runId));
    } catch (cause) {
      setDetailError(
        cause instanceof Error
          ? cause.message
          : 'No se pudo cargar el detalle.',
      );
    } finally {
      setDetailLoading(false);
    }
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
  if (!capabilities?.canReadEtlExecutions)
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

  return (
    <section className="space-y-6 p-6" aria-labelledby="etl-executions-title">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">
            Administración · Data Warehouse
          </p>
          <h1 id="etl-executions-title" className="mt-1 text-2xl font-semibold">
            Ejecuciones ETL
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Consulta el estado, los pasos y las métricas de las cargas. Esta
            vista es de solo lectura.
          </p>
        </div>
        <Button
          variant="outline"
          disabled={loading}
          onClick={() => void loadExecutions(filters)}
        >
          <RefreshCw aria-hidden="true" className="mr-2 size-4" /> Actualizar
        </Button>
      </header>

      <form
        onSubmit={applyFilters}
        className="grid gap-3 rounded-lg border border-border bg-card p-4 sm:grid-cols-2 xl:grid-cols-6"
      >
        <label className="space-y-1 text-sm font-medium">
          Estado
          <select
            aria-label="Filtrar por estado"
            value={statusInput}
            onChange={(event) => setStatusInput(event.target.value)}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">Todos</option>
            {STATUSES.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm font-medium">
          Tipo
          <select
            aria-label="Filtrar por tipo"
            value={kindInput}
            onChange={(event) => setKindInput(event.target.value)}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">Todos</option>
            {KINDS.map((kind) => (
              <option key={kind} value={kind}>
                {kind}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm font-medium">
          Gestión
          <Input
            aria-label="Filtrar por gestión"
            type="number"
            min="2000"
            value={gestionInput}
            onChange={(event) => setGestionInput(event.target.value)}
            placeholder="Ej. 2026"
          />
        </label>
        <label className="space-y-1 text-sm font-medium">
          Periodo
          <Input
            aria-label="Filtrar por periodo"
            type="number"
            min="1"
            value={periodoInput}
            onChange={(event) => setPeriodoInput(event.target.value)}
            placeholder="Ej. 1"
          />
        </label>
        <label className="space-y-1 text-sm font-medium">
          ID de cierre
          <Input
            aria-label="Filtrar por ID de cierre"
            type="number"
            min="1"
            value={closureInput}
            onChange={(event) => setClosureInput(event.target.value)}
            placeholder="Opcional"
          />
        </label>
        <div className="flex items-end">
          <Button type="submit" className="w-full">
            Aplicar filtros
          </Button>
        </div>
      </form>

      <div className="rounded-lg border border-border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
          <h2 className="font-medium">Historial de ejecuciones</h2>
          <span className="text-sm text-muted-foreground">
            {totalElements} registros
          </span>
        </div>
        {error && (
          <div
            role="alert"
            className="m-4 flex items-center justify-between gap-4 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
          >
            <span>{error}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void loadExecutions(filters)}
            >
              Reintentar
            </Button>
          </div>
        )}
        <div className="overflow-x-auto">
          <Table aria-busy={loading}>
            <TableHeader>
              <TableRow>
                <TableHead>Solicitud</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Gestión / periodo</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Duración</TableHead>
                <TableHead>Solicitado por</TableHead>
                <TableHead className="text-right">Detalle</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="py-10 text-center text-muted-foreground"
                  >
                    <Loader text="Cargando ejecuciones…" fullScreen={false} className="min-h-24" />
                  </TableCell>
                </TableRow>
              )}
              {!loading &&
                !error &&
                items.map((execution) => (
                  <TableRow key={execution.runId}>
                    <TableCell>
                      <span
                        className="font-mono text-xs"
                        title={execution.runId}
                      >
                        {execution.runId.slice(0, 8)}…
                      </span>
                      <div className="text-xs text-muted-foreground">
                        {dateLabel(execution.requestedAt)}
                      </div>
                    </TableCell>
                    <TableCell>
                      {execution.executionKind.replaceAll('_', ' ')}
                    </TableCell>
                    <TableCell>
                      {execution.requestedGestion ?? '—'}
                      {execution.requestedPeriodo
                        ? ` · P${execution.requestedPeriodo}`
                        : ''}
                      {execution.closureId ? (
                        <div className="text-xs text-muted-foreground">
                          Cierre #{execution.closureId}
                        </div>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(execution.status)}>
                        {execution.status.replaceAll('_', ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {durationLabel(execution.startedAt, execution.endedAt)}
                    </TableCell>
                    <TableCell
                      className="max-w-48 truncate"
                      title={execution.requestedBy}
                    >
                      {execution.requestedBy}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => void openDetail(execution.runId)}
                      >
                        Ver detalle
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              {!loading && !error && items.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="py-12 text-center">
                    <p className="font-medium">
                      No hay ejecuciones para mostrar
                    </p>
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
          <span>
            Mostrando {firstRecord}–{lastRecord} de {totalElements}
            {updatedAt ? ` · Actualizado ${dateLabel(updatedAt)}` : ''}
          </span>
          <div className="flex items-center gap-2">
            <span>
              Página {totalPages === 0 ? 0 : page + 1} de {totalPages}
            </span>
            <Button
              aria-label="Página anterior"
              variant="outline"
              size="sm"
              disabled={loading || page <= 0}
              onClick={() => goToPage(page - 1)}
            >
              <ChevronLeft aria-hidden="true" className="size-4" />
            </Button>
            <Button
              aria-label="Página siguiente"
              variant="outline"
              size="sm"
              disabled={loading || page + 1 >= totalPages}
              onClick={() => goToPage(page + 1)}
            >
              <ChevronRight aria-hidden="true" className="size-4" />
            </Button>
          </div>
        </footer>
      </div>

      <Sheet
        open={detailLoading || detailError !== null || selected !== null}
        onOpenChange={(open) => {
          if (!open) {
            setSelected(null);
            setDetailError(null);
          }
        }}
      >
        <SheetContent
          side="right"
          className="w-full overflow-y-auto sm:max-w-2xl"
        >
          <SheetHeader className="border-b border-border">
            <SheetTitle>Detalle de ejecución ETL</SheetTitle>
            <SheetDescription>
              {selected
                ? `Run ${selected.runId}`
                : 'Estado, pasos y resultados de la ejecución.'}
            </SheetDescription>
          </SheetHeader>
          {detailLoading && (
            <Loader text="Cargando detalle…" fullScreen={false} className="m-6" />
          )}
          {detailError && (
            <p
              role="alert"
              className="m-6 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
            >
              {detailError}
            </p>
          )}
          {selected && (
            <div className="space-y-6 p-6">
              <section className="grid gap-3 sm:grid-cols-2">
                <Info label="Estado">
                  <Badge variant={statusVariant(selected.status)}>
                    {selected.status.replaceAll('_', ' ')}
                  </Badge>
                </Info>
                <Info label="Tipo">
                  {selected.executionKind.replaceAll('_', ' ')}
                </Info>
                <Info label="Gestión / periodo">
                  {selected.requestedGestion ?? '—'}
                  {selected.requestedPeriodo
                    ? ` · P${selected.requestedPeriodo}`
                    : ''}
                </Info>
                <Info label="Cierre asociado">
                  {selected.closureId
                    ? `Cierre #${selected.closureId}`
                    : 'No aplica'}
                </Info>
                <Info label="Solicitado por">{selected.requestedBy}</Info>
                <Info label="Solicitado">
                  {dateLabel(selected.requestedAt)}
                </Info>
                <Info label="Inicio">{dateLabel(selected.startedAt)}</Info>
                <Info label="Fin">{dateLabel(selected.endedAt)}</Info>
                <Info label="Duración">
                  {durationLabel(selected.startedAt, selected.endedAt)}
                </Info>
              </section>
              <section>
                <h3 className="mb-2 font-semibold">Pasos</h3>
                {selected.steps.length ? (
                  <ol className="space-y-2">
                    {[...selected.steps]
                      .sort((a, b) => a.stepOrder - b.stepOrder)
                      .map((step) => (
                        <li
                          key={`${step.stepOrder}-${step.stepCode}`}
                          className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border p-3"
                        >
                          <div>
                            <p className="font-medium">
                              {step.stepCode.replaceAll('_', ' ')}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {step.phase.replaceAll('_', ' ')} ·{' '}
                              {dateLabel(step.startedAt)} –{' '}
                              {dateLabel(step.endedAt)}
                            </p>
                          </div>
                          <Badge
                            variant={
                              step.status === 'FALLIDO'
                                ? 'destructive'
                                : step.status === 'EXITOSO'
                                  ? 'secondary'
                                  : 'outline'
                            }
                          >
                            {step.status.replaceAll('_', ' ')}
                          </Badge>
                        </li>
                      ))}
                  </ol>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No hay pasos registrados.
                  </p>
                )}
              </section>
              <section>
                <h3 className="mb-2 font-semibold">Métricas</h3>
                {selected.metrics.length ? (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {selected.metrics.map((metric) => (
                      <Info
                        key={`${metric.name}-${metric.measuredAt}`}
                        label={metric.name}
                      >
                        {metric.value} {metric.unit}
                      </Info>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No hay métricas disponibles.
                  </p>
                )}
              </section>
              <section>
                <h3 className="mb-2 font-semibold">Incidencias</h3>
                {selected.errors.length ? (
                  <ul className="space-y-2">
                    {selected.errors.map((entry, index) => (
                      <li
                        key={`${entry.code}-${entry.occurredAt}-${index}`}
                        className="rounded-md border border-border p-3"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge
                            variant={
                              entry.severity === 'ERROR' ||
                              entry.severity === 'CRITICAL'
                                ? 'destructive'
                                : 'outline'
                            }
                          >
                            {entry.severity}
                          </Badge>
                          <span className="font-mono text-xs">
                            {entry.code}
                          </span>
                          {entry.stepCode && (
                            <span className="text-xs text-muted-foreground">
                              · {entry.stepCode}
                            </span>
                          )}
                        </div>
                        <p className="mt-2 text-sm">{entry.message}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {dateLabel(entry.occurredAt)}
                        </p>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No se registraron incidencias.
                  </p>
                )}
              </section>
              <p className="rounded-md bg-muted/40 p-3 text-xs text-muted-foreground">
                Los mensajes de incidencia son los textos sanitizados publicados
                por el servicio de control.
              </p>
            </div>
          )}
          <SheetFooter className="border-t border-border">
            <Button
              variant="outline"
              onClick={() => {
                setSelected(null);
                setDetailError(null);
              }}
            >
              Cerrar
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </section>
  );
}

function Info({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0 rounded-md border border-border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="mt-1 break-words text-sm font-medium">{children}</div>
    </div>
  );
}
