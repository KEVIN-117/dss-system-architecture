'use client';

import * as React from 'react';
import { Button } from '@dss-monorepo/design-system';
import { DatabaseZap, RefreshCw } from 'lucide-react';

import type { ModelCadence } from '../../../data-access/ml-operations';
import { listMlDatasets, submitDatasetExtraction, type MlDataset, type MlTask } from '../../../data-access/ml-studio';
import { dateTime } from '../model-charts';
import { ErrorAlert, JobProgress, Notice, Panel, errorMessage, jobError, useJobPolling } from '../studio-ui';

const DROPOUT = 'PROGRAM_DROPOUT_NEXT_EXPECTED_CLOSURE';

export function parsePrograms(text: string): string[] | null {
  const programs = text.split(/[\s,;]+/).map((item) => item.trim()).filter(Boolean);
  return programs.every((program) => /^[A-Za-z0-9._-]{1,16}$/.test(program)) ? programs : null;
}

/**
 * Step 2: extract the dataset from the data warehouse (an EXTRACT_DATASET job in prediction-service)
 * or reuse a dataset already extracted or uploaded for the same target.
 */
export function DataStep({
  task,
  extractionJobId,
  datasetRef,
  onExtractionStarted,
  onDataset,
}: {
  task: MlTask;
  extractionJobId: string | null;
  datasetRef: string | null;
  onExtractionStarted: (jobId: string) => void;
  onDataset: (datasetRef: string) => void;
}) {
  const [cadence, setCadence] = React.useState<ModelCadence>(task.cadences[0] ?? 'SEMESTRAL');
  const [programs, setPrograms] = React.useState('');
  const [horizon, setHorizon] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [datasets, setDatasets] = React.useState<MlDataset[] | null>(null);
  const [datasetsError, setDatasetsError] = React.useState<string | null>(null);
  const { job, error: pollError } = useJobPolling(extractionJobId);

  const loadDatasets = React.useCallback(async () => {
    setDatasetsError(null);
    try {
      setDatasets(await listMlDatasets());
    } catch (cause) {
      setDatasetsError(errorMessage(cause, 'No se pudo listar los datasets.'));
    }
  }, []);
  React.useEffect(() => void loadDatasets(), [loadDatasets]);

  React.useEffect(() => {
    if (job?.status === 'SUCCEEDED' && job.result_ref && job.result_ref !== datasetRef) {
      onDataset(job.result_ref);
      void loadDatasets();
    }
  }, [job, datasetRef, onDataset, loadDatasets]);

  const matching = (datasets ?? []).filter((dataset) => dataset.event_code === task.code);

  async function extract(event: React.FormEvent) {
    event.preventDefault();
    const programList = parsePrograms(programs);
    if (programList === null) {
      setError('Los códigos de carrera solo admiten letras, números, punto, guion y guion bajo (máximo 16).');
      return;
    }
    const horizonYears = horizon.trim() ? Number(horizon) : undefined;
    if (horizonYears !== undefined && (!Number.isInteger(horizonYears) || horizonYears < 1 || horizonYears > 10)) {
      setError('El horizonte debe ser un número entero de años entre 1 y 10.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const created = await submitDatasetExtraction({
        task_code: task.code,
        cadence,
        ...(programList.length ? { programs: programList } : {}),
        ...(horizonYears !== undefined ? { horizon_years: horizonYears } : {}),
      });
      onExtractionStarted(created.job_id);
    } catch (cause) {
      setError(errorMessage(cause, 'No se pudo iniciar la extracción.'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[3fr_2fr]">
      <Panel
        title="Extraer del almacén de datos"
        description="Arma el dataset con las variables vigentes en cada corte (sin mirar el futuro) y lo registra como inmutable. Puede tardar varios minutos; el job sigue aunque cierres esta página."
      >
        {!task.extractable ? (
          <Notice tone="warning">Este objetivo no se extrae del almacén; usa un dataset cargado desde Operaciones ML.</Notice>
        ) : (
          <form className="grid gap-4 sm:grid-cols-2" onSubmit={(event) => void extract(event)}>
            <label className="space-y-2 text-sm font-medium">
              Cadencia
              <select
                aria-label="Cadencia"
                value={cadence}
                onChange={(event) => setCadence(event.target.value as ModelCadence)}
                className="h-10 w-full rounded-md border border-input bg-background px-3"
              >
                {task.cadences.map((item) => (
                  <option key={item} value={item}>{item === 'SEMESTRAL' ? 'Semestral' : 'Anual'}</option>
                ))}
              </select>
            </label>
            {task.code === DROPOUT && (
              <label className="space-y-2 text-sm font-medium">
                Horizonte (años)
                <input
                  aria-label="Horizonte (años)"
                  inputMode="numeric"
                  value={horizon}
                  onChange={(event) => setHorizon(event.target.value)}
                  placeholder="Duración de la carrera"
                  className="h-10 w-full rounded-md border border-input bg-background px-3"
                />
              </label>
            )}
            <label className="space-y-2 text-sm font-medium sm:col-span-2">
              Carreras <span className="font-normal text-muted-foreground">(opcional; vacío = todas)</span>
              <input
                aria-label="Carreras"
                value={programs}
                onChange={(event) => setPrograms(event.target.value)}
                placeholder="Códigos separados por coma, p. ej. INF, SIS"
                className="h-10 w-full rounded-md border border-input bg-background px-3"
              />
            </label>
            <div className="sm:col-span-2">
              <Button type="submit" disabled={submitting || job?.status === 'RUNNING' || job?.status === 'QUEUED'}>
                <DatabaseZap aria-hidden="true" className="mr-2 size-4" />
                {submitting ? 'Enviando…' : 'Extraer dataset'}
              </Button>
            </div>
          </form>
        )}
        <div className="mt-4 space-y-3">
          <ErrorAlert message={error ?? pollError} />
          {job && <JobProgress job={job} />}
          {job && <ErrorAlert message={jobError(job)} />}
          {job?.status === 'SUCCEEDED' && (
            <Notice>Dataset listo: <span className="font-mono text-xs text-foreground">{job.result_ref}</span></Notice>
          )}
        </div>
      </Panel>

      <Panel
        title="Usar un dataset existente"
        description="Extracciones anteriores y datasets cargados con el mismo objetivo."
        actions={
          <Button variant="outline" size="sm" onClick={() => void loadDatasets()}>
            <RefreshCw aria-hidden="true" className="mr-2 size-4" /> Actualizar
          </Button>
        }
      >
        <ErrorAlert message={datasetsError} />
        {datasets !== null && matching.length === 0 && (
          <p className="text-sm text-muted-foreground">Aún no hay datasets para este objetivo.</p>
        )}
        <ul className="space-y-2">
          {matching.map((dataset) => (
            <li key={dataset.dataset_ref}>
              <button
                type="button"
                aria-pressed={dataset.dataset_ref === datasetRef}
                onClick={() => onDataset(dataset.dataset_ref)}
                className={`w-full rounded-lg border p-3 text-left text-sm transition-colors hover:border-primary/60 ${
                  dataset.dataset_ref === datasetRef ? 'border-primary bg-primary/5' : 'border-border'
                }`}
              >
                <span className="block font-medium">{dataset.label}</span>
                <span className="block text-xs text-muted-foreground">
                  {new Intl.NumberFormat('es-BO').format(dataset.row_count)} filas · {dateTime(dataset.created_at)}
                  {dataset.is_custom ? '' : ' · fixture'}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}
