'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  Button,
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
  AlertTriangle,
  ArrowLeft,
  Clock,
  Database,
  ListChecks,
  RefreshCw,
} from 'lucide-react';

import {
  getDwClosureCapabilities,
  getEtlExecution,
  type EtlExecutionDetail,
} from '../data-access/dw-control';
import {
  ACTIVE_STATUSES,
  KIND_LABEL,
  SEVERITY_META,
  STATUS_META,
  STEP_STATUS_META,
  PHASES,
  compactNumber,
  dateLabel,
  durationLabel,
  durationMs,
  formatDuration,
  formatNumber,
  groupMetrics,
  humanize,
  sourceLabel,
  summarizePhases,
  timeLabel,
  type MetricGroup,
} from './etl/etl-format';
import {
  AutoRefreshSwitch,
  CopyButton,
  KpiCard,
  SeverityIcon,
  StatusPill,
  TONE_BAR,
  TONE_CLASS,
  useNow,
} from './etl/EtlUi';

const AUTO_REFRESH_SECONDS = 10;
const PHASE_LABEL = Object.fromEntries(PHASES.map((p) => [p.code, p.label]));

export function AdminEtlExecutionDetailPage({ runId }: { runId: string }) {
  const [allowed, setAllowed] = React.useState<boolean | null>(null);
  const [detail, setDetail] = React.useState<EtlExecutionDetail | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = React.useState(true);
  const [updatedAt, setUpdatedAt] = React.useState<string | null>(null);

  React.useEffect(() => {
    const controller = new AbortController();
    getDwClosureCapabilities(controller.signal)
      .then((c) => setAllowed(c.canReadEtlExecutions))
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return;
        setAllowed(false);
        setError(
          cause instanceof Error ? cause.message : 'No se pudo verificar el acceso.',
        );
      });
    return () => controller.abort();
  }, []);

  const load = React.useCallback(
    async (quiet = false) => {
      if (!quiet) setLoading(true);
      setError(null);
      try {
        setDetail(await getEtlExecution(runId));
        setUpdatedAt(new Date().toISOString());
      } catch (cause) {
        setError(
          cause instanceof Error ? cause.message : 'No se pudo cargar el detalle.',
        );
      } finally {
        if (!quiet) setLoading(false);
      }
    },
    [runId],
  );

  React.useEffect(() => {
    if (allowed) void load();
  }, [allowed, load]);

  const isActive = detail ? ACTIVE_STATUSES.includes(detail.status) : false;

  React.useEffect(() => {
    if (!isActive || !autoRefresh) return;
    const id = window.setInterval(() => void load(true), AUTO_REFRESH_SECONDS * 1000);
    return () => window.clearInterval(id);
  }, [isActive, autoRefresh, load]);

  const now = useNow(isActive);

  const steps = React.useMemo(
    () => (detail ? [...detail.steps].sort((a, b) => a.stepOrder - b.stepOrder) : []),
    [detail],
  );
  const phases = React.useMemo(() => summarizePhases(steps), [steps]);
  const metricGroups = React.useMemo(
    () => (detail ? groupMetrics(detail.metrics) : []),
    [detail],
  );
  const errors = React.useMemo(
    () =>
      detail
        ? [...detail.errors].sort(
            (a, b) => SEVERITY_META[a.severity].rank - SEVERITY_META[b.severity].rank,
          )
        : [],
    [detail],
  );

  const back = (
    <Link
      href="/etl-executions"
      className="inline-flex items-center gap-1.5 rounded-md text-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <ArrowLeft aria-hidden="true" className="size-4" />
      Ejecuciones ETL
    </Link>
  );

  if (allowed === null || (allowed && loading && !detail && !error))
    return (
      <section aria-busy="true" className="space-y-4 p-4 md:p-6">
        {back}
        <Loader text="Cargando ejecución…" fullScreen={false} className="min-h-40" />
      </section>
    );

  if (allowed === false && !error)
    return (
      <section className="m-6 rounded-md border border-border bg-card p-6">
        <h1 className="text-lg font-semibold">Acceso restringido</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Tu cuenta no tiene permiso para consultar ejecuciones ETL.
        </p>
      </section>
    );

  if (!detail)
    return (
      <section className="space-y-4 p-4 md:p-6">
        {back}
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-4 rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive"
        >
          <span>{error ?? 'No se encontró la ejecución.'}</span>
          {allowed && (
            <Button variant="outline" size="sm" onClick={() => void load()}>
              Reintentar
            </Button>
          )}
        </div>
      </section>
    );

  const meta = STATUS_META[detail.status];
  const total = steps.length;
  const done = steps.filter((s) => s.status === 'EXITOSO').length;
  const failedSteps = steps.filter((s) => s.status === 'FALLIDO').length;
  const progress = total ? Math.round((done / total) * 100) : 0;
  const sourceRows = detail.metrics
    .filter((m) => m.name === 'source_rows_observed')
    .reduce((acc, m) => acc + m.value, 0);
  const sourceMetrics = detail.metrics.filter((m) => m.name === 'source_rows_observed');
  const distinctSources = new Set(sourceMetrics.map((m) => m.source).filter(Boolean)).size;
  const sourceCount = distinctSources || sourceMetrics.length;
  const blocking = errors.filter((e) => e.severity === 'ERROR' || e.severity === 'CRITICAL').length;
  const runDuration = durationMs(detail.startedAt, detail.endedAt, now);

  // Ventana temporal para la línea de tiempo de pasos.
  const starts = steps.map((s) => (s.startedAt ? new Date(s.startedAt).getTime() : NaN)).filter(Number.isFinite);
  const ends = steps
    .map((s) => (s.endedAt ? new Date(s.endedAt).getTime() : s.startedAt ? now : NaN))
    .filter(Number.isFinite);
  const windowStart = detail.startedAt ? new Date(detail.startedAt).getTime() : Math.min(...starts);
  const windowEnd = Math.max(detail.endedAt ? new Date(detail.endedAt).getTime() : now, ...ends);
  const span = Math.max(1, windowEnd - windowStart);

  const title = `${KIND_LABEL[detail.executionKind]}${
    detail.requestedGestion ? ` ${detail.requestedGestion}` : ''
  }${detail.requestedPeriodo ? ` · P${detail.requestedPeriodo}` : ''}`;

  return (
    <article className="space-y-6 p-4 md:p-6" aria-labelledby="run-title">
      {back}

      {/* Cabecera */}
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 id="run-title" className="text-2xl font-semibold">
              {title}
            </h1>
            <StatusPill tone={meta.tone} label={meta.label} />
          </div>
          <dl className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <dt className="sr-only">ID de ejecución</dt>
              <dd className="font-mono text-xs" title={detail.runId}>
                {detail.runId}
              </dd>
              <CopyButton value={detail.runId} label="Copiar ID de ejecución" />
            </div>
            <div className="flex gap-1">
              <dt>Solicitado por</dt>
              <dd className="font-medium text-foreground">{detail.requestedBy}</dd>
            </div>
            <div className="flex gap-1">
              <dt>el</dt>
              <dd>
                <time dateTime={detail.requestedAt}>{dateLabel(detail.requestedAt)}</time>
              </dd>
            </div>
            {detail.closureId ? (
              <div className="flex gap-1">
                <dt>Cierre</dt>
                <dd className="font-medium text-foreground">#{detail.closureId}</dd>
              </div>
            ) : null}
          </dl>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          {isActive && (
            <AutoRefreshSwitch
              checked={autoRefresh}
              onChange={setAutoRefresh}
              seconds={AUTO_REFRESH_SECONDS}
            />
          )}
          <Button variant="outline" onClick={() => void load()} disabled={loading}>
            <RefreshCw
              aria-hidden="true"
              className={`mr-2 size-4 ${loading ? 'motion-safe:animate-spin' : ''}`}
            />
            Actualizar
          </Button>
        </div>
      </header>

      {error && (
        <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </p>
      )}

      {/* Indicadores */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Duración"
          value={formatDuration(runDuration)}
          hint={
            detail.endedAt
              ? `${timeLabel(detail.startedAt)} – ${timeLabel(detail.endedAt)}`
              : detail.startedAt
                ? `En curso desde ${timeLabel(detail.startedAt)}`
                : 'Aún no inicia'
          }
          icon={Clock}
          tone={isActive ? 'running' : 'neutral'}
        />
        <KpiCard
          label="Pasos completados"
          value={`${done} de ${total}`}
          hint={failedSteps ? `${failedSteps} con fallos` : total ? `${progress}% del flujo` : 'Sin pasos registrados'}
          icon={ListChecks}
          tone={failedSteps ? 'danger' : done === total && total ? 'success' : 'running'}
        >
          <div
            role="progressbar"
            aria-label="Avance de pasos"
            aria-valuenow={progress}
            aria-valuemin={0}
            aria-valuemax={100}
            className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted"
          >
            <div
              className={`h-full rounded-full ${failedSteps ? 'bg-destructive' : 'bg-primary'}`}
              style={{ width: `${progress}%` }}
            />
          </div>
        </KpiCard>
        <KpiCard
          label="Filas leídas en origen"
          value={sourceCount ? compactNumber(sourceRows) : '—'}
          hint={sourceCount ? `${formatNumber(sourceRows)} filas en ${sourceCount} fuentes` : 'Sin lecturas de origen'}
          icon={Database}
        />
        <KpiCard
          label="Incidencias"
          value={formatNumber(errors.length)}
          hint={errors.length ? `${blocking} errores · ${errors.length - blocking} avisos` : 'Ninguna registrada'}
          icon={AlertTriangle}
          tone={blocking ? 'danger' : errors.length ? 'warning' : 'success'}
        />
      </div>

      {/* Fases */}
      <section aria-labelledby="phases-title" className="rounded-xl border border-border bg-card p-4 md:p-5">
        <h2 id="phases-title" className="text-base font-semibold">
          Avance por fases
        </h2>
        <ol className="mt-4 grid gap-3 sm:grid-cols-5">
          {phases.map((phase, i) => (
            <li key={phase.code} className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <span
                  aria-hidden="true"
                  className={`flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold ${TONE_CLASS[phase.tone]}`}
                >
                  {i + 1}
                </span>
                <span className={`h-1 flex-1 rounded-full ${TONE_BAR[phase.tone]}`} aria-hidden="true" />
              </div>
              <div>
                <p className="text-sm font-medium">{phase.label}</p>
                <p className="text-xs text-muted-foreground">
                  {phase.statusLabel}
                  {phase.total ? ` · ${phase.done}/${phase.total} pasos` : ''}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* Pasos con línea de tiempo */}
      <section aria-labelledby="steps-title" className="rounded-xl border border-border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
          <h2 id="steps-title" className="text-base font-semibold">
            Pasos y línea de tiempo
          </h2>
          <span className="text-sm text-muted-foreground">
            {total} pasos · ventana de {formatDuration(span)}
          </span>
        </div>
        {total === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">No hay pasos registrados.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table className="[&_td]:font-sans">
              <TableCaption className="sr-only">
                Pasos de la ejecución en orden, con fase, estado, inicio y duración
              </TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead scope="col" className="w-10">#</TableHead>
                  <TableHead scope="col">Paso</TableHead>
                  <TableHead scope="col">Estado</TableHead>
                  <TableHead scope="col" className="min-w-56">
                    Línea de tiempo
                  </TableHead>
                  <TableHead scope="col">Inicio</TableHead>
                  <TableHead scope="col" className="text-right">Duración</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {steps.map((step) => {
                  const sm = STEP_STATUS_META[step.status];
                  const s = step.startedAt ? new Date(step.startedAt).getTime() : null;
                  const e = step.endedAt ? new Date(step.endedAt).getTime() : s !== null ? now : null;
                  const left = s !== null ? ((s - windowStart) / span) * 100 : 0;
                  const width = s !== null && e !== null ? Math.max(1.2, ((e - s) / span) * 100) : 0;
                  return (
                    <TableRow key={`${step.stepOrder}-${step.stepCode}`}>
                      <TableCell className="tabular-nums text-muted-foreground">{step.stepOrder}</TableCell>
                      <TableCell>
                        <div className="font-medium">{humanize(step.stepCode)}</div>
                        <div className="text-xs text-muted-foreground">
                          {PHASE_LABEL[step.phase]} · <span className="font-mono">{step.stepCode}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <StatusPill tone={sm.tone} label={sm.label} size="sm" />
                      </TableCell>
                      <TableCell>
                        <div className="relative h-2.5 rounded-full bg-muted" aria-hidden="true">
                          {s !== null && (
                            <span
                              className={`absolute inset-y-0 rounded-full ${TONE_BAR[sm.tone]}`}
                              style={{ left: `${Math.min(left, 98.8)}%`, width: `${Math.min(width, 100 - left)}%` }}
                            />
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap tabular-nums">
                        <time dateTime={step.startedAt ?? undefined}>{timeLabel(step.startedAt)}</time>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {durationLabel(step.startedAt, step.endedAt, now)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        {/* Métricas */}
        <section aria-labelledby="metrics-title" className="rounded-xl border border-border bg-card">
          <div className="border-b border-border px-4 py-3">
            <h2 id="metrics-title" className="text-base font-semibold">
              Métricas de volumen
            </h2>
          </div>
          {metricGroups.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">No hay métricas disponibles.</p>
          ) : (
            <div className="divide-y divide-border">
              {metricGroups.map((group) => (
                <MetricGroupView key={`${group.name}-${group.unit}`} group={group} />
              ))}
            </div>
          )}
        </section>

        {/* Incidencias */}
        <section aria-labelledby="errors-title" className="rounded-xl border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h2 id="errors-title" className="text-base font-semibold">
              Incidencias
            </h2>
            <span className="text-sm text-muted-foreground">{errors.length}</span>
          </div>
          {errors.length === 0 ? (
            <div className="flex items-start gap-3 p-5">
              <StatusPill tone="success" label="Sin incidencias" size="sm" />
              <p className="text-sm text-muted-foreground">
                El servicio de control no registró errores ni advertencias para esta ejecución.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {errors.map((entry, index) => {
                const sev = SEVERITY_META[entry.severity];
                return (
                  <li key={`${entry.code}-${entry.occurredAt}-${index}`} className="p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium ${TONE_CLASS[sev.tone]}`}>
                        <SeverityIcon tone={sev.tone} />
                        {sev.label}
                      </span>
                      <span className="font-mono text-xs">{entry.code}</span>
                    </div>
                    <p className="mt-2 text-sm">{entry.message}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {entry.stepCode ? `Paso: ${humanize(entry.stepCode)} · ` : ''}
                      <time dateTime={entry.occurredAt}>{dateLabel(entry.occurredAt)}</time>
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
          <p className="border-t border-border px-4 py-3 text-xs text-muted-foreground">
            Los mensajes son los textos sanitizados que publica el servicio de control.
          </p>
        </section>
      </div>

      {updatedAt && (
        <p className="text-xs text-muted-foreground" aria-live="polite">
          Actualizado {dateLabel(updatedAt)}
        </p>
      )}
    </article>
  );
}

function MetricGroupView({ group }: { group: MetricGroup }) {
  const max = Math.max(1, ...group.entries.map((e) => e.value));
  const unit = group.unit ? ` ${group.unit}` : '';
  if (group.entries.length === 1) {
    const only = group.entries[0];
    return (
      <div className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-3">
        <div>
          <p className="text-sm font-medium">{group.label}</p>
          <p className="font-mono text-xs text-muted-foreground">{group.name}</p>
        </div>
        <p className="text-lg font-semibold tabular-nums">
          {formatNumber(only.value)}
          <span className="text-sm font-normal text-muted-foreground">{unit}</span>
        </p>
      </div>
    );
  }
  return (
    <div className="px-4 py-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p className="text-sm font-medium">{group.label}</p>
          <p className="text-xs text-muted-foreground">
            {group.entries.length} mediciones · <span className="font-mono">{group.name}</span>
          </p>
        </div>
        <p className="text-lg font-semibold tabular-nums">
          {formatNumber(group.total)}
          <span className="text-sm font-normal text-muted-foreground">{unit} en total</span>
        </p>
      </div>
      <table className="mt-3 w-full text-sm">
        <caption className="sr-only">{group.label}: valor de cada medición</caption>
        <thead className="sr-only">
          <tr>
            <th scope="col">{group.entries.some((e) => e.source) ? 'Fuente' : 'Medición'}</th>
            <th scope="col">Proporción</th>
            <th scope="col">Valor</th>
          </tr>
        </thead>
        <tbody>
          {group.entries.map((entry, i) => (
            <tr key={`${entry.measuredAt}-${i}`}>
              <td className="py-1.5 pr-3 align-top">
                {entry.source ? (
                  <>
                    <span className="block text-sm font-medium">{sourceLabel(entry.source)}</span>
                    <span className="block font-mono text-xs text-muted-foreground">{entry.source}</span>
                  </>
                ) : entry.stepCode ? (
                  <span className="block text-sm">{humanize(entry.stepCode)}</span>
                ) : (
                  <time
                    dateTime={entry.measuredAt}
                    className="block whitespace-nowrap text-xs text-muted-foreground"
                  >
                    {timeLabel(entry.measuredAt)}
                  </time>
                )}
              </td>
              <td className="w-2/5 py-1.5 pr-3">
                <div className="h-2 rounded-full bg-muted" aria-hidden="true">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${Math.max(1, (entry.value / max) * 100)}%` }}
                  />
                </div>
              </td>
              <td className="w-28 py-1.5 text-right font-medium tabular-nums">
                {formatNumber(entry.value)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
