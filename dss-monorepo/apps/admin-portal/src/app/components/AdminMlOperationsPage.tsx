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
  FileArchive,
  FileCheck2,
  RefreshCw,
  ShieldCheck,
  Upload,
  X,
} from 'lucide-react';

import {
  getAvailableDatasets,
  getMlTrainingJob,
  isMlAlgorithm,
  submitMlTrainingJob,
  uploadCustomDataset,
  type DatasetOption,
  type MlAlgorithm,
  type TrainingJob,
} from '../data-access/ml-operations';

const STORAGE_KEY = 'dss.admin.ml-operation-job-ids.v1';
const FIXTURE_DATASET = 'fixture:pred003_synthetic-v1';
const DEFAULT_DATASETS: DatasetOption[] = [
  {
    dataset_ref: FIXTURE_DATASET,
    dataset_id: 'pred003-synthetic',
    label: 'Fixture sintético PRED-003 (retención)',
    description:
      'Dataset sintético incluido en el servicio para validar preparación y entrenamiento; no representa datos institucionales.',
    is_custom: false,
    row_count: 40,
    target_field: 'target_class',
  },
];
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

function fileSizeLabel(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${new Intl.NumberFormat('es-BO', { maximumFractionDigits: 1 }).format(value)} ${units[unit]}`;
}

export function AdminMlOperationsPage() {
  const [algorithm, setAlgorithm] =
    React.useState<MlAlgorithm>('random_forest');
  const [availableDatasets, setAvailableDatasets] =
    React.useState<DatasetOption[]>(DEFAULT_DATASETS);
  const [datasetRef, setDatasetRef] = React.useState(FIXTURE_DATASET);
  const [configurationRef, setConfigurationRef] = React.useState('');
  const [jobs, setJobs] = React.useState<TrainingJob[]>([]);
  const [loadingJobs, setLoadingJobs] = React.useState(true);
  const [refreshError, setRefreshError] = React.useState<string | null>(null);
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [confirmed, setConfirmed] = React.useState(false);

  // Upload modal state
  const [uploadOpen, setUploadOpen] = React.useState(false);
  const [uploadFile, setUploadFile] = React.useState<File | null>(null);
  const [uploading, setUploading] = React.useState(false);
  const [uploadError, setUploadError] = React.useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = React.useState<string | null>(null);
  const [uploadDropActive, setUploadDropActive] = React.useState(false);
  const uploadInputRef = React.useRef<HTMLInputElement>(null);

  const selectedDataset = availableDatasets.find(
    (dataset) => dataset.dataset_ref === datasetRef,
  );

  const refreshDatasets = React.useCallback(async () => {
    try {
      const list = await getAvailableDatasets();
      if (Array.isArray(list) && list.length > 0) {
        setAvailableDatasets(list);
      }
    } catch {
      // Usar fallback de DEFAULT_DATASETS si falla la llamada
    }
  }, []);

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
    void refreshDatasets();
    void refreshJobs();
  }, [refreshDatasets, refreshJobs]);

  const hasActiveJobs = jobs.some((job) => !TERMINAL_STATES.has(job.status));

  React.useEffect(() => {
    if (!hasActiveJobs) return;
    const timer = window.setInterval(() => void refreshJobs(), 4000);
    return () => window.clearInterval(timer);
  }, [hasActiveJobs, refreshJobs]);

  function selectUploadFile(file?: File) {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.zip')) {
      setUploadFile(null);
      setUploadError('Selecciona un archivo .zip con el dataset preparado.');
      setUploadSuccess(null);
      if (uploadInputRef.current) uploadInputRef.current.value = '';
      return;
    }
    setUploadFile(file);
    setUploadError(null);
    setUploadSuccess(null);
  }

  async function handleDatasetUpload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!uploadFile || uploading) return;
    setUploading(true);
    setUploadError(null);
    setUploadSuccess(null);
    try {
      const result = await uploadCustomDataset(uploadFile);
      setUploadSuccess(
        `Dataset subido y validado exitosamente (${result.row_count} filas). ID: ${result.dataset_ref}`,
      );
      await refreshDatasets();
      setDatasetRef(result.dataset_ref);
      setUploadFile(null);
    } catch (cause) {
      setUploadError(
        cause instanceof Error ? cause.message : 'Error al subir el dataset.',
      );
    } finally {
      setUploading(false);
    }
  }

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
              <div className="flex items-center justify-between">
                <span>Dataset de entrenamiento</span>
                <button
                  type="button"
                  onClick={() => {
                    setUploadOpen(true);
                    setUploadError(null);
                    setUploadSuccess(null);
                  }}
                  className="inline-flex items-center gap-1 text-xs text-primary underline hover:text-primary/80"
                >
                  <Upload aria-hidden="true" className="size-3.5" /> Subir dataset
                </button>
              </div>
              <select
                required
                aria-label="Dataset de entrenamiento"
                value={datasetRef}
                onChange={(event) => setDatasetRef(event.target.value)}
                aria-describedby="dataset-ref-help"
                className="h-10 w-full rounded-md border border-input bg-background px-3"
              >
                {availableDatasets.map((dataset) => (
                  <option key={dataset.dataset_ref} value={dataset.dataset_ref}>
                    {dataset.label} ({dataset.row_count} filas)
                  </option>
                ))}
              </select>
              <span
                id="dataset-ref-help"
                className="block text-xs font-normal text-muted-foreground"
              >
                {selectedDataset?.description ||
                  `Dataset de ${selectedDataset?.row_count} filas preparado bajo el contrato PRED-002.`}
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

      {/* Modal para subir dataset preparado */}
      <Dialog
        open={uploadOpen}
        onOpenChange={(open) => {
          if (!uploading) {
            setUploadOpen(open);
            setUploadError(null);
            setUploadSuccess(null);
            setUploadFile(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <div className="flex items-start gap-4">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <FileArchive aria-hidden="true" className="size-5" />
              </span>
              <div className="space-y-1">
                <DialogTitle>Agregar dataset de entrenamiento</DialogTitle>
                <DialogDescription>
                  Selecciona el paquete ZIP preparado para el contrato PRED-002.
                  El servicio validará su estructura antes de registrarlo.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <form onSubmit={handleDatasetUpload} className="space-y-5">
            <div
              onDragEnter={(event) => {
                event.preventDefault();
                if (!uploading) setUploadDropActive(true);
              }}
              onDragOver={(event) => event.preventDefault()}
              onDragLeave={(event) => {
                if (
                  !(event.relatedTarget instanceof Node) ||
                  !event.currentTarget.contains(event.relatedTarget)
                )
                  setUploadDropActive(false);
              }}
              onDrop={(event) => {
                event.preventDefault();
                setUploadDropActive(false);
                if (!uploading) selectUploadFile(event.dataTransfer.files[0]);
              }}
              className={`rounded-xl border-2 border-dashed p-6 text-center transition-colors sm:p-8 ${
                uploadDropActive
                  ? 'border-primary bg-primary/10'
                  : 'border-border bg-muted/20 hover:border-primary/60 hover:bg-muted/40'
              }`}
            >
              <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Upload aria-hidden="true" className="size-5" />
              </span>
              <p className="mt-4 font-medium text-foreground">
                Arrastra el archivo ZIP aquí
              </p>
              <p className="mt-1 text-sm text-muted-foreground">o</p>
              <label className="mt-3 inline-flex min-h-10 cursor-pointer items-center justify-center rounded-md border border-border bg-background px-4 text-sm font-medium text-foreground transition-colors hover:bg-muted focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
                Examinar archivos
                <input
                  ref={uploadInputRef}
                  type="file"
                  accept=".zip"
                  disabled={uploading}
                  onChange={(e) => {
                    selectUploadFile(e.target.files?.[0]);
                  }}
                  className="sr-only"
                />
              </label>
              <p className="mt-3 text-xs text-muted-foreground">
                Solo archivos .zip. Debe incluir{' '}
                <code className="rounded bg-muted px-1 py-0.5 text-foreground">
                  manifest.json
                </code>{' '}
                y{' '}
                <code className="rounded bg-muted px-1 py-0.5 text-foreground">
                  rows.jsonl
                </code>.
              </p>
            </div>

            {uploadFile && (
              <div className="flex min-w-0 items-center gap-3 rounded-lg border border-border bg-card p-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <FileCheck2 aria-hidden="true" className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p
                    className="truncate text-sm font-medium"
                    title={uploadFile.name}
                  >
                    {uploadFile.name}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Archivo ZIP · {fileSizeLabel(uploadFile.size)}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Quitar dataset seleccionado"
                  disabled={uploading}
                  onClick={() => {
                    setUploadFile(null);
                    if (uploadInputRef.current) uploadInputRef.current.value = '';
                  }}
                >
                  <X aria-hidden="true" className="size-4" />
                </Button>
              </div>
            )}

            {uploadError && (
              <p
                role="alert"
                className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
              >
                {uploadError}
              </p>
            )}

            {uploadSuccess && (
              <p
                role="status"
                className="rounded-md border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm text-emerald-600 dark:text-emerald-400"
              >
                {uploadSuccess}
              </p>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={uploading}
                onClick={() => setUploadOpen(false)}
              >
                Cerrar
              </Button>
              <Button type="submit" disabled={!uploadFile || uploading}>
                {uploading ? 'Validando y subiendo…' : 'Subir y validar dataset'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}
