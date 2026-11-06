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
} from '@dss-monorepo/design-system';
import {
  AlertTriangle,
  BrainCircuit,
  CircleHelp,
  Clock3,
  Cpu,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';

import {
  getMlTrainingJob,
  isMlAlgorithm,
  submitMlTrainingJob,
  type MlAlgorithm,
  type TrainingJob,
} from '../data-access/ml-operations';

const STORAGE_KEY = 'dss.admin.ml-operation-job-ids.v1';
const FIXTURE_DATASET = 'fixture:pred003_synthetic-v1';
const TRAINING_DATASETS = [
  {
    ref: FIXTURE_DATASET,
    label: 'Fixture sintético PRED-003 (retención)',
    description:
      'Dataset sintético incluido en el servicio para validar preparación y entrenamiento; no representa datos institucionales.',
  },
] as const;
const TERMINAL_STATES = new Set(['SUCCEEDED', 'FAILED', 'CANCELLED']);

function readSavedJobIds(): string[] {
  try {
    const value: unknown = JSON.parse(
      sessionStorage.getItem(STORAGE_KEY) ?? '[]',
    );
    return Array.isArray(value)
      ? value
          .filter((item): item is string => typeof item === 'string')
          .slice(0, 12)
      : [];
  } catch {
    return [];
  }
}

function saveJobIds(ids: string[]) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(ids.slice(0, 12)));
  } catch {
    // The running page still tracks jobs if browser storage is unavailable.
  }
}

function jobStatusVariant(
  status: TrainingJob['status'],
): React.ComponentProps<typeof Badge>['variant'] {
  if (status === 'SUCCEEDED') return 'secondary';
  if (status === 'FAILED') return 'destructive';
  if (status === 'CANCELLED') return 'outline';
  return 'default';
}

function algorithmLabel(algorithm: MlAlgorithm): string {
  return algorithm === 'random_forest' ? 'Random Forest' : 'XGBoost';
}

function dateLabel(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Fecha no disponible';
  return new Intl.DateTimeFormat('es-BO', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

export function AdminMlOperationsPage() {
  const [algorithm, setAlgorithm] =
    React.useState<MlAlgorithm>('random_forest');
  const [datasetRef, setDatasetRef] = React.useState(FIXTURE_DATASET);
  const [configurationRef, setConfigurationRef] = React.useState('');
  const [jobs, setJobs] = React.useState<TrainingJob[]>([]);
  const [loadingJobs, setLoadingJobs] = React.useState(true);
  const [refreshError, setRefreshError] = React.useState<string | null>(null);
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [confirmed, setConfirmed] = React.useState(false);
  const selectedDataset = TRAINING_DATASETS.find(
    (dataset) => dataset.ref === datasetRef,
  );

  const refreshJobs = React.useCallback(async () => {
    const ids = readSavedJobIds();
    if (ids.length === 0) {
      setJobs([]);
      setLoadingJobs(false);
      return;
    }
    try {
      const results = await Promise.allSettled(
        ids.map((id) => getMlTrainingJob(id)),
      );
      const refreshed = results.flatMap((result) =>
        result.status === 'fulfilled' ? [result.value] : [],
      );
      const failed = results.find((result) => result.status === 'rejected');
      setJobs(refreshed);
      setRefreshError(
        failed?.status === 'rejected'
          ? failed.reason instanceof Error
            ? failed.reason.message
            : 'No se pudo consultar uno o más jobs.'
          : null,
      );
    } catch (cause) {
      setRefreshError(
        cause instanceof Error
          ? cause.message
          : 'No se pudo actualizar el historial.',
      );
    } finally {
      setLoadingJobs(false);
    }
  }, []);

  React.useEffect(() => {
    void refreshJobs();
    const timer = window.setInterval(() => {
      if (jobs.some((job) => !TERMINAL_STATES.has(job.status)))
        void refreshJobs();
    }, 4000);
    return () => window.clearInterval(timer);
  }, [jobs, refreshJobs]);

  function openConfirmation(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitError(null);
    setConfirmed(false);
    setConfirmOpen(true);
  }

  async function confirmSubmission() {
    if (!confirmed || submitting) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const input = {
        dataset_ref: datasetRef.trim(),
        algorithm,
        ...(configurationRef.trim()
          ? { configuration_ref: configurationRef.trim() }
          : {}),
      };
      const job = await submitMlTrainingJob(input);
      const ids = [
        job.job_id,
        ...readSavedJobIds().filter((id) => id !== job.job_id),
      ];
      saveJobIds(ids);
      setJobs((current) => [
        job,
        ...current.filter((item) => item.job_id !== job.job_id),
      ]);
      setConfirmOpen(false);
      setConfirmed(false);
    } catch (cause) {
      setSubmitError(
        cause instanceof Error
          ? cause.message
          : 'No se pudo iniciar el entrenamiento.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section
      className="mx-auto w-full max-w-7xl space-y-7 p-5 sm:p-7"
      aria-labelledby="ml-operations-title"
    >
      <header className="flex flex-wrap items-end justify-between gap-5 border-b border-border pb-6">
        <div>
          <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            <BrainCircuit aria-hidden="true" className="size-4" /> DSS ·
            laboratorio de modelos
          </p>
          <h1
            id="ml-operations-title"
            className="text-3xl font-semibold tracking-tight"
          >
            Operaciones de ML
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
            Inicia y supervisa entrenamientos candidatos. Los modelos
            resultantes no se activan automáticamente.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => void refreshJobs()}
          disabled={loadingJobs}
        >
          <RefreshCw aria-hidden="true" className="mr-2 size-4" /> Actualizar
          jobs
        </Button>
      </header>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(19rem,0.85fr)]">
        <form
          onSubmit={openConfirmation}
          className="rounded-xl border border-border bg-card"
        >
          <div className="flex items-start gap-4 border-b border-border p-5 sm:p-6">
            <div className="rounded-lg border border-primary/30 bg-primary/10 p-2.5 text-primary">
              <BrainCircuit aria-hidden="true" className="size-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Nuevo entrenamiento</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                El worker ejecutará el algoritmo en segundo plano con el dataset
                indicado.
              </p>
            </div>
          </div>

          <div className="grid gap-5 p-5 sm:grid-cols-2 sm:p-6">
            <label className="space-y-2 text-sm font-medium">
              Algoritmo
              <select
                aria-label="Algoritmo de entrenamiento"
                value={algorithm}
                onChange={(event) => {
                  if (isMlAlgorithm(event.target.value))
                    setAlgorithm(event.target.value);
                }}
                className="h-10 w-full rounded-md border border-input bg-background px-3"
              >
                <option value="random_forest">Random Forest</option>
                <option value="xgboost">XGBoost</option>
              </select>
            </label>
            <label className="space-y-2 text-sm font-medium">
              Dataset de entrenamiento
              <select
                required
                aria-label="Dataset de entrenamiento"
                value={datasetRef}
                onChange={(event) => setDatasetRef(event.target.value)}
                aria-describedby="dataset-ref-help"
                className="h-10 w-full rounded-md border border-input bg-background px-3"
              >
                {TRAINING_DATASETS.map((dataset) => (
                  <option key={dataset.ref} value={dataset.ref}>
                    {dataset.label}
                  </option>
                ))}
              </select>
              <span
                id="dataset-ref-help"
                className="block text-xs font-normal text-muted-foreground"
              >
                {selectedDataset?.description} Los datasets institucionales se
                habilitarán cuando se implemente el catálogo y almacenamiento
                en bucket; aquí aún no se aceptan cargas de archivos.
              </span>
            </label>
            <label className="space-y-2 text-sm font-medium sm:col-span-2">
              Referencia de configuración{' '}
              <span className="font-normal text-muted-foreground">
                (opcional)
              </span>
              <Input
                maxLength={128}
                value={configurationRef}
                onChange={(event) => setConfigurationRef(event.target.value)}
                placeholder="Configuración versionada del catálogo ML"
              />
            </label>
          </div>

          {submitError && (
            <p
              role="alert"
              className="mx-5 mb-4 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive sm:mx-6"
            >
              {submitError}
            </p>
          )}

          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border bg-muted/30 px-5 py-4 sm:px-6">
            <span className="flex items-center gap-2 text-xs text-muted-foreground">
              <ShieldCheck aria-hidden="true" className="size-4" /> Acceso
              reservado a SUPERADMIN
            </span>
            <Button type="submit" disabled={submitting || !datasetRef.trim()}>
              Revisar y confirmar
            </Button>
          </div>
        </form>

        <aside className="space-y-4">
          <section
            className="rounded-xl border border-border bg-card p-5 sm:p-6"
            aria-labelledby="resource-controls-title"
          >
            <div className="flex items-center gap-3">
              <Cpu aria-hidden="true" className="size-5 text-primary" />
              <h2 id="resource-controls-title" className="font-semibold">
                Límites efectivos del worker
              </h2>
            </div>
            <dl className="mt-5 divide-y divide-border text-sm">
              <div className="flex items-center justify-between py-3">
                <dt className="text-muted-foreground">Concurrencia máxima</dt>
                <dd className="font-mono">1 job</dd>
              </div>
              <div className="flex items-center justify-between py-3">
                <dt className="text-muted-foreground">CPU configurada</dt>
                <dd className="font-mono">WORKER_CPU_LIMIT</dd>
              </div>
              <div className="flex items-center justify-between py-3">
                <dt className="text-muted-foreground">Memoria configurada</dt>
                <dd className="font-mono">WORKER_MEMORY_LIMIT_MB</dd>
              </div>
              <div className="flex items-center justify-between py-3">
                <dt className="text-muted-foreground">Timeout por job</dt>
                <dd className="font-mono">WORKER_JOB_TIMEOUT_SECONDS</dd>
              </div>
            </dl>
            <p className="mt-3 text-xs leading-5 text-muted-foreground">
              Los valores se aplican en Compose/worker. Esta pantalla no los
              cambia ni reinicia contenedores.
            </p>
          </section>

          <section
            className="rounded-xl border border-amber-500/35 bg-amber-500/5 p-5"
            aria-labelledby="capacity-test-title"
          >
            <div className="flex items-start gap-3">
              <AlertTriangle
                aria-hidden="true"
                className="mt-0.5 size-5 shrink-0 text-amber-600"
              />
              <div>
                <h2 id="capacity-test-title" className="font-semibold">
                  Caracterización de carga
                </h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Las pruebas de latencia, métricas Docker y caída controlada
                  del worker siguen siendo una operación de desarrollo aislada.
                  No se habilitan desde el portal hasta disponer de un runner
                  dedicado, auditable y con límites propios.
                </p>
                <p className="mt-3 flex items-center gap-2 text-xs font-medium text-amber-700 dark:text-amber-300">
                  <CircleHelp aria-hidden="true" className="size-4" /> No afecta
                  el worker compartido desde esta pantalla
                </p>
              </div>
            </div>
          </section>
        </aside>
      </div>

      <section
        className="overflow-hidden rounded-xl border border-border bg-card"
        aria-labelledby="training-history-title"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4 sm:px-6">
          <div>
            <h2 id="training-history-title" className="font-semibold">
              Jobs iniciados en esta sesión
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              El estado se actualiza automáticamente mientras haya trabajos
              activos.
            </p>
          </div>
          <span className="text-sm text-muted-foreground">
            {jobs.length} registrados
          </span>
        </div>

        {refreshError && (
          <p
            role="alert"
            className="m-4 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
          >
            {refreshError}
          </p>
        )}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-5 py-3">Solicitud</th>
                <th className="px-5 py-3">Algoritmo</th>
                <th className="px-5 py-3">Dataset</th>
                <th className="px-5 py-3">Estado</th>
                <th className="px-5 py-3">Candidato</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loadingJobs && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-5 py-8 text-center text-muted-foreground"
                  >
                    Consultando jobs…
                  </td>
                </tr>
              )}
              {!loadingJobs && jobs.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center">
                    <Clock3
                      aria-hidden="true"
                      className="mx-auto mb-2 size-5 text-muted-foreground"
                    />
                    <span className="font-medium">
                      Todavía no hay entrenamientos en esta sesión
                    </span>
                    <span className="mt-1 block text-xs text-muted-foreground">
                      Inicia un job para seguir su estado y candidato.
                    </span>
                  </td>
                </tr>
              )}
              {jobs.map((job) => (
                <tr key={job.job_id}>
                  <td className="px-5 py-4">
                    <span className="font-mono text-xs" title={job.job_id}>
                      {job.job_id.slice(0, 8)}…
                    </span>
                    <span className="mt-1 block text-xs text-muted-foreground">
                      {dateLabel(job.created_at)}
                    </span>
                  </td>
                  <td className="px-5 py-4">{algorithmLabel(job.algorithm)}</td>
                  <td
                    className="max-w-[18rem] truncate px-5 py-4 font-mono text-xs"
                    title={job.dataset_ref}
                  >
                    {job.dataset_ref}
                  </td>
                  <td className="px-5 py-4">
                    <Badge variant={jobStatusVariant(job.status)}>
                      {job.status}
                    </Badge>
                  </td>
                  <td className="px-5 py-4">
                    {job.model_candidate
                      ? `${job.model_candidate.model_id} · ${job.model_candidate.version}`
                      : (job.error?.title ?? '—')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <Dialog
        open={confirmOpen}
        onOpenChange={(open) => {
          if (!submitting) setConfirmOpen(open);
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Confirmar entrenamiento candidato</DialogTitle>
            <DialogDescription>
              Se creará un job asíncrono. El resultado quedará como candidato y
              no sustituirá un modelo activo.
            </DialogDescription>
          </DialogHeader>
          <dl className="grid gap-3 rounded-lg border border-border bg-muted/30 p-4 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Algoritmo</dt>
              <dd className="font-medium">{algorithmLabel(algorithm)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Dataset</dt>
              <dd className="max-w-[18rem] break-all text-right font-mono text-xs">
                {datasetRef}
              </dd>
            </div>
            {configurationRef.trim() && (
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Configuración</dt>
                <dd className="font-mono text-xs">{configurationRef}</dd>
              </div>
            )}
          </dl>
          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-amber-500/30 p-3 text-sm leading-5">
            <input
              className="mt-1 size-4 accent-primary"
              type="checkbox"
              checked={confirmed}
              onChange={(event) => setConfirmed(event.target.checked)}
            />
            <span>
              Confirmo que el dataset y la configuración están autorizados para
              este entrenamiento. Si uso datos institucionales, cuentan con
              aprobación DSA vigente.
            </span>
          </label>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={submitting}
              onClick={() => setConfirmOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={!confirmed || submitting}
              onClick={() => void confirmSubmission()}
            >
              {submitting ? 'Enviando job…' : 'Iniciar entrenamiento'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
