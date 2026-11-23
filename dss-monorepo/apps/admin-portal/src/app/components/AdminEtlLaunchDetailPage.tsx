'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@dss-monorepo/design-system';
import { ArrowLeft, CircleStop, ExternalLink, RefreshCw } from 'lucide-react';

import {
  getEtlLaunch,
  getEtlLaunchLogs,
  getLoadManagerCapabilities,
  stopEtlLaunch,
  type EtlLaunch,
  type LoadManagerCapabilities,
} from '../data-access/load-manager';
import { dateLabel, durationLabel } from './etl/etl-format';
import { CopyButton, StatusPill, useNow } from './etl/EtlUi';
import {
  LAUNCH_STATUS_META,
  TRIGGER_LABEL,
  launchStart,
  parameterLabel,
  processLabel,
} from './etl/load-manager-format';

const REFRESH_SECONDS = 5;

function message(cause: unknown, fallback: string): string {
  return cause instanceof Error ? cause.message : fallback;
}

export function AdminEtlLaunchDetailPage({ launchId }: { launchId: string }) {
  const [capabilities, setCapabilities] =
    React.useState<LoadManagerCapabilities | null>(null);
  const [launch, setLaunch] = React.useState<EtlLaunch | null>(null);
  const [log, setLog] = React.useState('');
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [confirmStop, setConfirmStop] = React.useState(false);
  const [stopping, setStopping] = React.useState(false);
  const [followLog, setFollowLog] = React.useState(true);
  const logRef = React.useRef<HTMLPreElement>(null);

  React.useEffect(() => {
    const controller = new AbortController();
    getLoadManagerCapabilities(controller.signal)
      .then(setCapabilities)
      .catch((cause: unknown) => {
        if (!controller.signal.aborted)
          setError(message(cause, 'No se pudo verificar el acceso.'));
      });
    return () => controller.abort();
  }, []);

  const canRead = capabilities?.canReadEtlExecutions === true;

  const load = React.useCallback(
    async (quiet = false) => {
      if (!quiet) setLoading(true);
      try {
        const [detail, logs] = await Promise.all([
          getEtlLaunch(launchId),
          getEtlLaunchLogs(launchId),
        ]);
        setLaunch(detail);
        setLog(logs.log);
        setError(null);
      } catch (cause) {
        setError(message(cause, 'No se pudo cargar el lanzamiento.'));
      } finally {
        if (!quiet) setLoading(false);
      }
    },
    [launchId],
  );

  React.useEffect(() => {
    if (canRead) void load();
  }, [canRead, load]);

  const active = launch?.active === true;
  React.useEffect(() => {
    if (!active) return;
    const id = window.setInterval(
      () => void load(true),
      REFRESH_SECONDS * 1000,
    );
    return () => window.clearInterval(id);
  }, [active, load]);

  React.useEffect(() => {
    if (followLog && logRef.current)
      logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [log, followLog]);

  const now = useNow(active);

  async function stop() {
    setStopping(true);
    try {
      setLaunch(await stopEtlLaunch(launchId));
      setConfirmStop(false);
      void load(true);
    } catch (cause) {
      setError(message(cause, 'No se pudo detener la ejecución.'));
      setConfirmStop(false);
    } finally {
      setStopping(false);
    }
  }

  if (capabilities && !canRead)
    return (
      <section className="m-6 rounded-md border border-border bg-card p-6">
        <h1 className="text-lg font-semibold">Acceso restringido</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Tu cuenta no tiene permiso para consultar el Load Manager.
        </p>
      </section>
    );

  const meta = launch ? LAUNCH_STATUS_META[launch.status] : null;
  return (
    <section className="space-y-6 p-4 md:p-6" aria-labelledby="launch-title">
      <Link
        href="/etl"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        Panel ETL
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">
            Servicio de control del almacén de datos · Lanzamiento ETL
          </p>
          <h1 id="launch-title" className="mt-1 text-2xl font-semibold">
            {launch ? processLabel(launch.processCode) : 'Lanzamiento'}
          </h1>
          <p className="mt-1 flex items-center gap-1 font-mono text-xs text-muted-foreground">
            {launchId}
            <CopyButton value={launchId} label="Copiar ID del lanzamiento" />
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {meta ? <StatusPill {...meta} /> : null}
          {launch && capabilities?.canExecuteEtl && launch.active ? (
            <Button
              variant="destructive"
              disabled={launch.stopRequestedAt !== null}
              onClick={() => setConfirmStop(true)}
            >
              <CircleStop aria-hidden="true" className="mr-2 size-4" />
              {launch.stopRequestedAt ? 'Detención solicitada' : 'Detener'}
            </Button>
          ) : null}
          <Button
            variant="outline"
            disabled={loading}
            onClick={() => void load()}
          >
            <RefreshCw
              aria-hidden="true"
              className={`mr-2 size-4 ${loading ? 'motion-safe:animate-spin' : ''}`}
            />
            Actualizar
          </Button>
        </div>
      </header>

      {error ? (
        <p
          role="alert"
          className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
        >
          {error}
        </p>
      ) : null}

      {launch ? (
        <>
          {launch.resultSummary ? (
            <p
              className={`rounded-md border p-3 text-sm ${
                meta?.tone === 'danger'
                  ? 'border-destructive/40 bg-destructive/10 text-destructive'
                  : 'border-border bg-muted/40'
              }`}
            >
              {launch.status === 'SKIPPED' ? 'Omitida: ' : ''}
              {launch.resultSummary}
            </p>
          ) : null}

          <dl className="grid gap-4 rounded-xl border border-border bg-card p-4 sm:grid-cols-2 xl:grid-cols-4">
            <Item label="Origen" value={TRIGGER_LABEL[launch.trigger]} />
            <Item label="Solicitado por" value={launch.requestedBy} />
            <Item label="Solicitado" value={dateLabel(launch.requestedAt)} />
            <Item
              label="Duración"
              value={durationLabel(launchStart(launch), launch.finishedAt, now)}
            />
            <Item label="Enviado a Hop" value={dateLabel(launch.submittedAt)} />
            <Item label="Finalizado" value={dateLabel(launch.finishedAt)} />
            {launch.stopRequestedAt ? (
              <Item
                label="Detención solicitada"
                value={`${launch.stopRequestedBy ?? '—'} · ${dateLabel(launch.stopRequestedAt)}`}
              />
            ) : null}
            {launch.scheduleId ? (
              <Item
                label="Programación"
                value={
                  <Link
                    href="/etl-schedules"
                    className="text-primary hover:underline"
                  >
                    #{launch.scheduleId}
                  </Link>
                }
              />
            ) : null}
          </dl>

          <div className="grid gap-6 xl:grid-cols-3">
            <section aria-labelledby="params-title" className="space-y-3">
              <h2 id="params-title" className="text-lg font-semibold">
                Parámetros enviados a Hop
              </h2>
              {Object.keys(launch.parameters).length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Este proceso no recibe parámetros.
                </p>
              ) : (
                <dl className="space-y-2 rounded-xl border border-border bg-card p-4 text-sm">
                  {Object.entries(launch.parameters).map(([name, value]) => (
                    <div key={name} className="flex justify-between gap-3">
                      <dt className="text-muted-foreground">
                        {parameterLabel(name)}
                      </dt>
                      <dd className="truncate font-mono text-xs" title={value}>
                        {value}
                      </dd>
                    </div>
                  ))}
                </dl>
              )}
              {launch.runId ? (
                <Link
                  href={`/etl-executions/${launch.runId}`}
                  className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                >
                  <ExternalLink aria-hidden="true" className="size-4" />
                  Ver la ejecución en el DW (pasos y métricas)
                </Link>
              ) : null}
            </section>

            <section
              aria-labelledby="log-title"
              className="space-y-3 xl:col-span-2"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 id="log-title" className="text-lg font-semibold">
                  Log de Hop
                </h2>
                <label className="flex items-center gap-2 text-sm text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={followLog}
                    onChange={(event) => setFollowLog(event.target.checked)}
                  />
                  Seguir el final
                </label>
              </div>
              <pre
                ref={logRef}
                tabIndex={0}
                aria-label="Log de Hop Server"
                className="max-h-128 min-h-48 overflow-auto rounded-xl border border-border bg-muted/40 p-4 font-mono text-xs leading-relaxed whitespace-pre-wrap"
              >
                {log ||
                  (launch.active
                    ? 'Esperando el log de Hop Server…'
                    : 'Sin log disponible.')}
              </pre>
              <p className="text-xs text-muted-foreground">
                Últimas líneas del log (hasta 64 KiB). Las credenciales se
                ocultan antes de guardarlas.
                {launch.active
                  ? ` Se actualiza cada ${REFRESH_SECONDS} s.`
                  : ''}
              </p>
            </section>
          </div>
        </>
      ) : loading ? (
        <p aria-busy="true" className="text-sm text-muted-foreground">
          Cargando lanzamiento…
        </p>
      ) : null}

      <Dialog
        open={confirmStop}
        onOpenChange={(open) => !open && !stopping && setConfirmStop(false)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Detener ejecución</DialogTitle>
            <DialogDescription>
              Se pedirá a Hop Server que detenga la ejecución. El estado cambia
              a «Detenida» cuando Hop confirma la detención; una carga detenida
              no publica datos parciales.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              disabled={stopping}
              onClick={() => setConfirmStop(false)}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              loading={stopping}
              onClick={() => void stop()}
            >
              Detener
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function Item({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 truncate text-sm font-medium">{value}</dd>
    </div>
  );
}
