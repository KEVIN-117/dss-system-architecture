'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Select,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@dss-monorepo/design-system';
import {
  CalendarRange,
  CircleStop,
  Clock,
  ExternalLink,
  Play,
  RefreshCw,
  Server,
  Workflow,
} from 'lucide-react';

import {
  listAcademicClosures,
  listEtlExecutions,
  type AcademicClosure,
  type EtlExecutionSummary,
} from '../data-access/dw-control';
import {
  getEtlStatus,
  getLoadManagerCapabilities,
  getLoadManagerHealth,
  launchEtlProcess,
  listEtlLaunches,
  listEtlProcesses,
  listEtlSchedules,
  stopEtlLaunch,
  type EtlLaunch,
  type EtlProcess,
  type EtlSchedule,
  type LaunchEtlInput,
  type LoadManagerCapabilities,
  type LoadManagerHealth,
} from '../data-access/load-manager';
import { STATUS_META, dateLabel, durationLabel, relativeLabel } from './etl/etl-format';
import { KpiCard, StatusPill, useNow } from './etl/EtlUi';
import {
  LAUNCH_STATUS_META,
  TRIGGER_LABEL,
  launchStart,
  processLabel,
  reprocessCandidates,
  type ReprocessCandidate,
} from './etl/load-manager-format';

const REFRESH_SECONDS = 10;
const RECENT_SIZE = 10;
const HOP_WEB_URL = process.env.NEXT_PUBLIC_HOP_WEB_URL?.trim() || null;

type Overview = {
  health: LoadManagerHealth | null;
  processes: EtlProcess[];
  recent: EtlLaunch[];
  active: EtlLaunch[];
  schedules: EtlSchedule[];
};

function message(cause: unknown, fallback: string): string {
  return cause instanceof Error ? cause.message : fallback;
}

export function AdminLoadManagerPage() {
  const router = useRouter();
  const [capabilities, setCapabilities] = React.useState<LoadManagerCapabilities | null>(null);
  const [accessError, setAccessError] = React.useState<string | null>(null);
  const [overview, setOverview] = React.useState<Overview | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [launchTarget, setLaunchTarget] = React.useState<EtlProcess | null>(null);
  const [stopTarget, setStopTarget] = React.useState<EtlLaunch | null>(null);
  const [stopping, setStopping] = React.useState(false);
  const [notice, setNotice] = React.useState<string | null>(null);

  React.useEffect(() => {
    const controller = new AbortController();
    getLoadManagerCapabilities(controller.signal)
      .then(setCapabilities)
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) setAccessError(message(cause, 'No se pudo verificar el acceso.'));
      });
    return () => controller.abort();
  }, []);

  const canRead = capabilities?.canReadEtlExecutions === true;
  const canExecute = capabilities?.canExecuteEtl === true;

  const load = React.useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    setError(null);
    try {
      const [health, processes, recent, status, schedules] = await Promise.all([
        getLoadManagerHealth().catch(() => null),
        listEtlProcesses(),
        listEtlLaunches({ page: 0, size: RECENT_SIZE }),
        getEtlStatus(),
        listEtlSchedules(),
      ]);
      setOverview({ health, processes, recent: recent.items, active: status.active, schedules });
    } catch (cause) {
      setError(message(cause, 'No se pudo cargar el Load Manager.'));
    } finally {
      if (!quiet) setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (canRead) void load();
  }, [canRead, load]);

  const active = overview?.active ?? [];
  const hasActive = active.length > 0;

  React.useEffect(() => {
    if (!canRead || !hasActive) return;
    const id = window.setInterval(() => void load(true), REFRESH_SECONDS * 1000);
    return () => window.clearInterval(id);
  }, [canRead, hasActive, load]);

  const now = useNow(hasActive);

  async function confirmStop() {
    if (!stopTarget) return;
    setStopping(true);
    try {
      await stopEtlLaunch(stopTarget.id);
      setNotice(`Se pidió detener «${processLabel(stopTarget.processCode, overview?.processes)}».`);
      setStopTarget(null);
      void load(true);
    } catch (cause) {
      setError(message(cause, 'No se pudo detener la ejecución.'));
      setStopTarget(null);
    } finally {
      setStopping(false);
    }
  }

  if (accessError)
    return (
      <section role="alert" className="m-6 rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
        {accessError}
      </section>
    );
  if (!capabilities)
    return (
      <section aria-busy="true" className="p-6 text-sm text-muted-foreground">
        Verificando acceso al Load Manager…
      </section>
    );
  if (!canRead)
    return (
      <section className="m-6 rounded-md border border-border bg-card p-6">
        <h1 className="text-lg font-semibold">Acceso restringido</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Tu cuenta no tiene permiso para consultar el Load Manager.
        </p>
      </section>
    );

  const health = overview?.health ?? null;
  const upcoming = (overview?.schedules ?? [])
    .filter((schedule) => schedule.enabled && schedule.nextFireAt)
    .sort((a, b) => (a.nextFireAt ?? '').localeCompare(b.nextFireAt ?? ''))
    .slice(0, 3);
  const processes = overview?.processes ?? [];

  return (
    <section className="space-y-6 p-4 md:p-6" aria-labelledby="load-manager-title">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">Servicio de control del almacén de datos · Load Manager</p>
          <h1 id="load-manager-title" className="mt-1 text-2xl font-semibold">
            Panel ETL
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Ejecuta, detén y sigue las cargas del Data Warehouse en Hop Server. Las
            cargas automáticas se programan fuera del horario operativo de la DSA.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {HOP_WEB_URL ? (
            <Button variant="ghost" onClick={() => window.open(HOP_WEB_URL, '_blank', 'noopener,noreferrer')}>
              <ExternalLink aria-hidden="true" className="mr-2 size-4" />
              Editar workflows en Hop Web
            </Button>
          ) : null}
          <Button variant="outline" disabled={loading} onClick={() => void load()}>
            <RefreshCw aria-hidden="true" className={`mr-2 size-4 ${loading ? 'motion-safe:animate-spin' : ''}`} />
            Actualizar
          </Button>
        </div>
      </header>

      {error ? (
        <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p role="status" className="rounded-md border border-primary/40 bg-primary/10 p-3 text-sm text-primary">
          {notice}
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Hop Server"
          icon={Server}
          tone={health === null ? 'neutral' : health.hopOnline ? 'success' : 'danger'}
          value={health === null ? '—' : health.hopOnline ? 'En línea' : 'No disponible'}
          hint={health ? `Verificado ${relativeLabel(health.checkedAt)}` : 'Sin datos de salud'}
        />
        <KpiCard
          label="Ejecuciones activas"
          icon={Workflow}
          tone={hasActive ? 'running' : 'neutral'}
          value={active.length}
          hint={hasActive ? `Se actualiza cada ${REFRESH_SECONDS} s` : 'Ninguna en curso'}
        />
        <KpiCard
          label="Programaciones activas"
          icon={CalendarRange}
          value={(overview?.schedules ?? []).filter((schedule) => schedule.enabled).length}
          hint={health?.schedulerEnabled === false ? 'El scheduler está apagado en el servicio' : 'Disparo automático'}
        />
        <KpiCard
          label="Horario operativo DSA"
          icon={Clock}
          value={<span className="text-base font-medium">Sin cargas programadas</span>}
          hint={health?.operatingWindow ?? 'lunes a viernes 08:00–18:00'}
        />
      </div>

      {hasActive ? (
        <section aria-labelledby="active-title" className="space-y-3">
          <h2 id="active-title" className="text-lg font-semibold">En curso</h2>
          <ul className="grid gap-3 lg:grid-cols-2">
            {active.map((launch) => (
              <li key={launch.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/30 bg-card p-4">
                <div className="min-w-0">
                  <Link href={`/etl/launches/${launch.id}`} className="font-medium hover:underline">
                    {processLabel(launch.processCode, processes)}
                  </Link>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {TRIGGER_LABEL[launch.trigger]} · {launch.requestedBy} ·{' '}
                    {durationLabel(launchStart(launch), null, now)}
                    {launch.stopRequestedAt ? ' · detención solicitada' : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusPill size="sm" {...LAUNCH_STATUS_META[launch.status]} />
                  {canExecute ? (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={launch.stopRequestedAt !== null}
                      onClick={() => setStopTarget(launch)}
                    >
                      <CircleStop aria-hidden="true" className="mr-1.5 size-4" />
                      Detener
                    </Button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-labelledby="processes-title" className="space-y-3">
        <h2 id="processes-title" className="text-lg font-semibold">Procesos</h2>
        <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {processes.map((process) => {
            const running = active.some((launch) => launch.processCode === process.code);
            return (
              <li key={process.code} className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
                <div>
                  <p className="font-medium">{process.displayName}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{process.description}</p>
                  <p className="mt-2 break-all font-mono text-xs text-muted-foreground">{process.workflowFile}</p>
                </div>
                <div className="mt-auto flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs text-muted-foreground">
                    {process.schedulable ? 'Ejecución manual o programada' : 'Solo ejecución manual'}
                  </span>
                  {canExecute ? (
                    <Button
                      size="sm"
                      disabled={!process.enabled || running || health?.hopOnline === false}
                      title={running ? 'Ya hay una ejecución activa de este proceso' : undefined}
                      onClick={() => setLaunchTarget(process)}
                    >
                      <Play aria-hidden="true" className="mr-1.5 size-4" />
                      Ejecutar
                    </Button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
        {!canExecute ? (
          <p className="text-xs text-muted-foreground">
            Para ejecutar o detener procesos se requiere el permiso dw:etl:execute.
          </p>
        ) : null}
      </section>

      <div className="grid gap-6 xl:grid-cols-3">
        <section aria-labelledby="recent-title" className="space-y-3 xl:col-span-2">
          <div className="flex items-center justify-between">
            <h2 id="recent-title" className="text-lg font-semibold">Últimos lanzamientos</h2>
            <Link href="/etl-executions" className="text-sm text-primary hover:underline">
              Ver ejecuciones del DW
            </Link>
          </div>
          <div className="overflow-x-auto rounded-xl border border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Proceso</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Origen</TableHead>
                  <TableHead>Solicitado</TableHead>
                  <TableHead>Resultado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(overview?.recent ?? []).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                      {loading ? 'Cargando…' : 'Todavía no hay lanzamientos.'}
                    </TableCell>
                  </TableRow>
                ) : (
                  overview?.recent.map((launch) => (
                    <TableRow key={launch.id}>
                      <TableCell className="font-sans">
                        <Link href={`/etl/launches/${launch.id}`} className="font-medium hover:underline">
                          {processLabel(launch.processCode, processes)}
                        </Link>
                      </TableCell>
                      <TableCell className="font-sans">
                        <StatusPill size="sm" {...LAUNCH_STATUS_META[launch.status]} />
                      </TableCell>
                      <TableCell className="font-sans text-sm">{TRIGGER_LABEL[launch.trigger]}</TableCell>
                      <TableCell className="font-sans whitespace-nowrap text-sm" title={dateLabel(launch.requestedAt)}>
                        {relativeLabel(launch.requestedAt)}
                      </TableCell>
                      <TableCell className="font-sans max-w-xs truncate text-sm text-muted-foreground" title={launch.resultSummary ?? undefined}>
                        {launch.resultSummary ?? '—'}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </section>

        <section aria-labelledby="upcoming-title" className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 id="upcoming-title" className="text-lg font-semibold">Próximas cargas</h2>
            <Link href="/etl-schedules" className="text-sm text-primary hover:underline">
              Programaciones
            </Link>
          </div>
          <ul className="space-y-2">
            {upcoming.length === 0 ? (
              <li className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
                No hay programaciones activas.
              </li>
            ) : (
              upcoming.map((schedule) => (
                <li key={schedule.id} className="rounded-xl border border-border bg-card p-3">
                  <p className="text-sm font-medium">{schedule.name}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {processLabel(schedule.processCode, processes)} · {dateLabel(schedule.nextFireAt)}
                  </p>
                </li>
              ))
            )}
          </ul>
        </section>
      </div>

      <LaunchDialog
        process={launchTarget}
        onClose={() => setLaunchTarget(null)}
        onLaunched={(launch) => {
          setLaunchTarget(null);
          router.push(`/etl/launches/${launch.id}`);
        }}
      />

      <Dialog open={stopTarget !== null} onOpenChange={(open) => !open && !stopping && setStopTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Detener ejecución</DialogTitle>
            <DialogDescription>
              Se pedirá a Hop Server que detenga «{stopTarget ? processLabel(stopTarget.processCode, processes) : ''}».
              Una carga del DW detenida no publica datos parciales.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" disabled={stopping} onClick={() => setStopTarget(null)}>
              Cancelar
            </Button>
            <Button variant="destructive" loading={stopping} onClick={() => void confirmStop()}>
              Detener
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

type LaunchMode = 'CIERRE_ACADEMICO' | 'REPROCESO';

function reprocessOptionLabel(execution: EtlExecutionSummary): string {
  return [
    `Gestión ${execution.requestedGestion} · periodo ${execution.requestedPeriodo}`,
    STATUS_META[execution.status].label,
    dateLabel(execution.endedAt ?? execution.requestedAt),
    execution.runId.slice(0, 8),
  ].join(' · ');
}

/** Asks only for what the selected process needs and sends it to the BFF. */
function LaunchDialog({
  process,
  onClose,
  onLaunched,
}: {
  process: EtlProcess | null;
  onClose: () => void;
  onLaunched: (launch: EtlLaunch) => void;
}) {
  const [mode, setMode] = React.useState<LaunchMode>('CIERRE_ACADEMICO');
  const [closureId, setClosureId] = React.useState('');
  const [runId, setRunId] = React.useState('');
  const [closures, setClosures] = React.useState<AcademicClosure[] | null>(null);
  const [candidates, setCandidates] = React.useState<ReprocessCandidate[] | null>(null);
  const [candidatesError, setCandidatesError] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!process) return;
    setMode('CIERRE_ACADEMICO');
    setClosureId('');
    setRunId('');
    setError(null);
    setClosures(null);
    if (process.code !== 'VERTICAL_LOAD') return;
    const controller = new AbortController();
    // Closed periods pending processing; needs dw:closure:read, otherwise the ID is typed by hand.
    listAcademicClosures({ status: 'CERRADO', page: 0, size: 50 }, controller.signal)
      .then((page) => {
        setClosures(page.items);
        if (page.items.length > 0) setClosureId(String(page.items[0].closureId));
      })
      .catch(() => setClosures(null));
    return () => controller.abort();
  }, [process]);

  // Reprocess: offer the latest finished attempt per period instead of asking for a run ID.
  React.useEffect(() => {
    if (process?.code !== 'VERTICAL_LOAD' || mode !== 'REPROCESO') return;
    const controller = new AbortController();
    setCandidates(null);
    setCandidatesError(false);
    listEtlExecutions({ page: 0, size: 100 }, controller.signal)
      .then((page) => {
        const options = reprocessCandidates(page.items, closures);
        setCandidates(options);
        setRunId(options.find((option) => !option.blocked)?.execution.runId ?? '');
      })
      .catch(() => {
        if (!controller.signal.aborted) setCandidatesError(true);
      });
    return () => controller.abort();
  }, [process, mode, closures]);

  if (!process) return null;
  const needsRunId = process.code === 'PUBLISH_STAGED' || (process.code === 'VERTICAL_LOAD' && mode === 'REPROCESO');
  const needsClosure = process.code === 'VERTICAL_LOAD' && mode === 'CIERRE_ACADEMICO';

  function input(): LaunchEtlInput | null {
    if (!process) return null;
    if (process.code === 'VERTICAL_LOAD') {
      if (mode === 'CIERRE_ACADEMICO') {
        const id = Number(closureId);
        return Number.isSafeInteger(id) && id > 0
          ? { processCode: process.code, executionKind: 'CIERRE_ACADEMICO', closureId: id }
          : null;
      }
      return runId.trim() ? { processCode: process.code, executionKind: 'REPROCESO', retryOfRunId: runId.trim() } : null;
    }
    if (process.code === 'PUBLISH_STAGED') return runId.trim() ? { processCode: process.code, runId: runId.trim() } : null;
    return { processCode: process.code };
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const request = input();
    if (!request) {
      setError('Completa los datos que requiere el proceso.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      onLaunched(await launchEtlProcess(request));
    } catch (cause) {
      setError(message(cause, 'No se pudo lanzar el proceso.'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && !submitting && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Ejecutar · {process.displayName}</DialogTitle>
          <DialogDescription>{process.description}</DialogDescription>
        </DialogHeader>
        <form id="launch-etl" onSubmit={(event) => void submit(event)} className="space-y-4">
          {process.code === 'VERTICAL_LOAD' ? (
            <div className="space-y-1.5">
              <label htmlFor="launch-mode" className="text-sm font-medium">Tipo de carga</label>
              <Select id="launch-mode" value={mode} onChange={(event) => setMode(event.target.value as LaunchMode)}>
                <option value="CIERRE_ACADEMICO">Cierre académico (periodo cerrado por la DSA)</option>
                <option value="REPROCESO">Reproceso de una ejecución anterior</option>
              </Select>
            </div>
          ) : null}
          {needsClosure ? (
            <div className="space-y-1.5">
              <label htmlFor="launch-closure" className="text-sm font-medium">
                Cierre académico <span aria-hidden="true">*</span>
              </label>
              {closures && closures.length > 0 ? (
                <Select id="launch-closure" value={closureId} onChange={(event) => setClosureId(event.target.value)}>
                  {closures.map((closure) => (
                    <option key={closure.closureId} value={closure.closureId}>
                      Gestión {closure.gestion} · periodo {closure.periodo} (#{closure.closureId})
                    </option>
                  ))}
                </Select>
              ) : (
                <Input
                  id="launch-closure"
                  type="number"
                  min="1"
                  required
                  value={closureId}
                  onChange={(event) => setClosureId(event.target.value)}
                  placeholder="ID del cierre en estado CERRADO"
                />
              )}
              <p className="text-xs text-muted-foreground">
                {closures && closures.length === 0
                  ? 'No hay cierres CERRADO pendientes de procesar.'
                  : 'Solo se cargan periodos que la DSA cerró y que aún no se procesaron.'}
              </p>
            </div>
          ) : null}
          {needsRunId && process.code === 'VERTICAL_LOAD' ? (
            <div className="space-y-1.5">
              <label htmlFor="launch-retry" className="text-sm font-medium">
                Ejecución a reprocesar <span aria-hidden="true">*</span>
              </label>
              {candidates === null && !candidatesError ? (
                <p className="text-sm text-muted-foreground">Cargando ejecuciones…</p>
              ) : candidatesError ? (
                <p className="text-sm text-destructive">No se pudieron cargar las ejecuciones.</p>
              ) : candidates && candidates.length > 0 ? (
                <Select id="launch-retry" value={runId} onChange={(event) => setRunId(event.target.value)}>
                  {candidates.every((option) => option.blocked) ? <option value="">Ninguna disponible</option> : null}
                  {candidates.map(({ execution, blocked }) => (
                    <option key={execution.runId} value={execution.runId} disabled={blocked !== null}>
                      {reprocessOptionLabel(execution)}
                      {blocked ? ' — cierre ya procesado' : ''}
                    </option>
                  ))}
                </Select>
              ) : (
                <p className="text-sm text-muted-foreground">Todavía no hay ejecuciones terminadas.</p>
              )}
              <p className="text-xs text-muted-foreground">
                Se muestra el último intento terminado de cada periodo; el reproceso usa su gestión y periodo. Un periodo
                ya procesado debe reabrirse y volver a cerrarse en{' '}
                <Link href="/academic-closures" className="underline underline-offset-2">
                  Cierres académicos
                </Link>{' '}
                antes de reprocesarlo.
              </p>
            </div>
          ) : null}
          {needsRunId && process.code === 'PUBLISH_STAGED' ? (
            <div className="space-y-1.5">
              <label htmlFor="launch-run" className="text-sm font-medium">
                Ejecución preparada (run ID) <span aria-hidden="true">*</span>
              </label>
              <Input
                id="launch-run"
                required
                value={runId}
                onChange={(event) => setRunId(event.target.value)}
                placeholder="00000000-0000-0000-0000-000000000000"
                className="font-mono"
              />
            </div>
          ) : null}
          {process.code === 'CATALOG_SYNC' ? (
            <p className="text-sm text-muted-foreground">
              No requiere parámetros. Se sincronizan facultades y programas desde Jachasun.
            </p>
          ) : null}
          {error ? (
            <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </p>
          ) : null}
        </form>
        <DialogFooter>
          <Button variant="outline" type="button" disabled={submitting} onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="launch-etl" loading={submitting}>
            <Play aria-hidden="true" className="mr-1.5 size-4" />
            Ejecutar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
