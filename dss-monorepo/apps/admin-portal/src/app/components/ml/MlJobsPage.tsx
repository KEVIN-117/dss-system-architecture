'use client';

import * as React from 'react';
import { Button } from '@dss-monorepo/design-system';
import { ListChecks, RefreshCw, XCircle } from 'lucide-react';

import {
  cancelMlJob,
  isJobActive,
  listMlJobs,
  type MlJob,
  type MlJobKind,
  type MlJobStatus,
} from '../../data-access/ml-studio';
import { algorithmName, dateTime } from './model-charts';
import { ErrorAlert, JOB_KIND_LABELS, JOB_STATUS_LABELS, JobStatusBadge, errorMessage, jobError } from './studio-ui';

const REFRESH_MS = 5000;

/** What a job worked on, in one line. */
export function jobSubject(job: MlJob): string {
  const params = job.params ?? {};
  if (job.job_kind === 'EXTRACT_DATASET') return String(params.task_code ?? 'Dataset');
  if (job.job_kind === 'FORECAST') {
    const series = Array.isArray(params.series_codes) && params.series_codes.length ? params.series_codes.join(', ') : 'Todas las series';
    return `${series} · ${String(params.cadence ?? '')}`;
  }
  return `${algorithmName(job.algorithm)} · ${job.dataset_ref}`;
}

function jobResult(job: MlJob): string {
  if (job.model_candidate) return `Modelo ${job.model_candidate.model_id}`;
  if (job.result_ref) return job.result_ref;
  return jobError(job) ?? '—';
}

/**
 * Global list of ML jobs (PRED-107): trainings, dataset extractions and forecasts of every operator,
 * read from prediction-service, so it no longer depends on the browser that launched them.
 */
export function MlJobsPage() {
  const [jobs, setJobs] = React.useState<MlJob[]>([]);
  const [kind, setKind] = React.useState<MlJobKind | ''>('');
  const [status, setStatus] = React.useState<MlJobStatus | ''>('');
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [cancelling, setCancelling] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setError(null);
    try {
      setJobs(await listMlJobs({ kind: kind || undefined, status: status || undefined, limit: 100 }));
    } catch (cause) {
      setError(errorMessage(cause, 'No se pudo listar los jobs.'));
    } finally {
      setLoading(false);
    }
  }, [kind, status]);
  React.useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  const anyActive = jobs.some(isJobActive);
  React.useEffect(() => {
    if (!anyActive) return undefined;
    const timer = window.setInterval(() => void load(), REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [anyActive, load]);

  async function cancel(job: MlJob) {
    setCancelling(job.job_id);
    setError(null);
    try {
      const updated = await cancelMlJob(job.job_id);
      setJobs((current) => current.map((item) => (item.job_id === updated.job_id ? updated : item)));
    } catch (cause) {
      setError(errorMessage(cause, 'No se pudo cancelar el job.'));
    } finally {
      setCancelling(null);
    }
  }

  return (
    <section className="mx-auto w-full max-w-7xl space-y-7 p-5 sm:p-7" aria-labelledby="ml-jobs-title">
      <header className="flex flex-wrap items-end justify-between gap-5 border-b border-border pb-6">
        <div>
          <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            <ListChecks aria-hidden="true" className="size-4" /> DSS · aprendizaje automático
          </p>
          <h1 id="ml-jobs-title" className="text-3xl font-semibold tracking-tight">Jobs ML</h1>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
            Extracciones, entrenamientos y pronósticos de todos los operadores. Los jobs en cola o en ejecución se pueden
            cancelar; la lista se actualiza sola mientras haya alguno activo.
          </p>
        </div>
        <Button variant="outline" onClick={() => void load()} disabled={loading}>
          <RefreshCw aria-hidden="true" className="mr-2 size-4" /> Actualizar
        </Button>
      </header>

      <div className="flex flex-wrap items-end gap-5">
        <label className="space-y-2 text-sm font-medium">
          Tipo
          <select
            aria-label="Tipo de job"
            value={kind}
            onChange={(event) => setKind(event.target.value as MlJobKind | '')}
            className="h-10 min-w-52 rounded-md border border-input bg-background px-3"
          >
            <option value="">Todos</option>
            {(Object.keys(JOB_KIND_LABELS) as MlJobKind[]).map((item) => (
              <option key={item} value={item}>{JOB_KIND_LABELS[item]}</option>
            ))}
          </select>
        </label>
        <label className="space-y-2 text-sm font-medium">
          Estado
          <select
            aria-label="Estado del job"
            value={status}
            onChange={(event) => setStatus(event.target.value as MlJobStatus | '')}
            className="h-10 min-w-52 rounded-md border border-input bg-background px-3"
          >
            <option value="">Todos</option>
            {(Object.keys(JOB_STATUS_LABELS) as MlJobStatus[]).map((item) => (
              <option key={item} value={item}>{JOB_STATUS_LABELS[item]}</option>
            ))}
          </select>
        </label>
      </div>

      <ErrorAlert message={error} />

      <section className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[60rem] text-left text-sm">
            <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Tipo</th>
                <th className="px-4 py-3">Trabajo</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3">Creado</th>
                <th className="px-4 py-3">Operador</th>
                <th className="px-4 py-3">Resultado</th>
                <th className="px-4 py-3"><span className="sr-only">Acciones</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {jobs.map((job) => (
                <tr key={job.job_id}>
                  <td className="px-4 py-3 font-medium">{JOB_KIND_LABELS[job.job_kind ?? 'TRAIN']}</td>
                  <td className="max-w-72 truncate px-4 py-3" title={jobSubject(job)}>{jobSubject(job)}</td>
                  <td className="px-4 py-3"><JobStatusBadge status={job.status} /></td>
                  <td className="px-4 py-3 text-muted-foreground">{dateTime(job.created_at)}</td>
                  <td className="px-4 py-3 text-muted-foreground">{job.submitted_by}</td>
                  <td className={`max-w-72 truncate px-4 py-3 font-mono text-xs ${job.status === 'FAILED' ? 'text-destructive' : ''}`} title={jobResult(job)}>
                    {jobResult(job)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {isJobActive(job) && (
                      <Button
                        size="sm"
                        variant="outline"
                        aria-label={`Cancelar job ${job.job_id}`}
                        disabled={cancelling === job.job_id}
                        onClick={() => void cancel(job)}
                      >
                        <XCircle aria-hidden="true" className="mr-1.5 size-4" /> Cancelar
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!loading && jobs.length === 0 && (
          <p className="p-8 text-center text-sm text-muted-foreground">No hay jobs con estos filtros.</p>
        )}
      </section>
    </section>
  );
}
