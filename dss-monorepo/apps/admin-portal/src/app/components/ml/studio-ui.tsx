'use client';

import * as React from 'react';
import { Badge } from '@dss-monorepo/design-system';

import { getMlJob, isJobActive, listMlJobs, type MlJob, type MlJobKind, type MlJobStatus, type MlTask } from '../../data-access/ml-studio';

export const JOB_STATUS_LABELS: Record<MlJobStatus, string> = {
  QUEUED: 'En cola',
  RUNNING: 'En ejecución',
  SUCCEEDED: 'Completado',
  FAILED: 'Falló',
  CANCELLED: 'Cancelado',
};

export const JOB_KIND_LABELS: Record<MlJobKind, string> = {
  TRAIN: 'Entrenamiento',
  EXTRACT_DATASET: 'Extracción de datos',
  FORECAST: 'Pronóstico',
};

export const SUBJECT_LABELS: Record<MlTask['subject'], string> = {
  student: 'Estudiante',
  enrollment: 'Matrícula',
  series: 'Pronóstico',
};

export const KIND_LABELS: Record<MlTask['kind'], string> = {
  classification: 'Clasificación',
  regression: 'Regresión',
  forecast: 'Serie temporal',
};

export function JobStatusBadge({ status }: { status: MlJobStatus }) {
  const variant = status === 'FAILED' ? 'destructive' : status === 'SUCCEEDED' ? 'secondary' : 'outline';
  return (
    <Badge variant={variant} data-status={status}>
      {isJobActive({ status }) && <span aria-hidden="true" className="mr-1.5 inline-block size-1.5 animate-pulse rounded-full bg-primary" />}
      {JOB_STATUS_LABELS[status] ?? status}
    </Badge>
  );
}

export function ErrorAlert({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
      {message}
    </p>
  );
}

export function Notice({ children, tone = 'info' }: { children: React.ReactNode; tone?: 'info' | 'warning' }) {
  const styles =
    tone === 'warning'
      ? 'border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-100'
      : 'border-border bg-muted/40 text-muted-foreground';
  return <p className={`rounded-md border p-3 text-sm ${styles}`}>{children}</p>;
}

export function Panel({
  title,
  description,
  actions,
  children,
}: {
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-border bg-card p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold">{title}</h2>
          {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
        </div>
        {actions}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function Kpi({ label, value, hint }: { label: string; value: React.ReactNode; hint?: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-background/60 p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function errorMessage(cause: unknown, fallback: string): string {
  return cause instanceof Error && cause.message ? cause.message : fallback;
}

export function jobError(job: MlJob): string | null {
  if (job.status !== 'FAILED') return null;
  return job.error?.detail ?? job.error?.title ?? 'El job falló sin detalle.';
}

/**
 * Follows a job until it finishes. The job lives in prediction-service, so it survives a reload:
 * the wizard only keeps its id.
 */
export function useJobPolling(jobId: string | null, intervalMs = 3000): { job: MlJob | null; error: string | null } {
  const [job, setJob] = React.useState<MlJob | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  React.useEffect(() => {
    setJob(null);
    setError(null);
    if (!jobId) return undefined;
    let cancelled = false;
    let timer: number | undefined;
    const poll = async () => {
      try {
        const current = await getMlJob(jobId);
        if (cancelled) return;
        setJob(current);
        setError(null);
        if (isJobActive(current)) timer = window.setTimeout(() => void poll(), intervalMs);
      } catch (cause) {
        if (cancelled) return;
        setError(errorMessage(cause, 'No se pudo consultar el job.'));
        timer = window.setTimeout(() => void poll(), intervalMs * 2);
      }
    };
    void poll();
    return () => {
      cancelled = true;
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [jobId, intervalMs]);
  return { job, error };
}

export function JobProgress({ job }: { job: MlJob }) {
  const progress = typeof job.progress === 'number' ? Math.round(job.progress * (job.progress <= 1 ? 100 : 1)) : null;
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-background/60 p-3 text-sm" aria-live="polite">
      <JobStatusBadge status={job.status} />
      <span className="font-mono text-xs text-muted-foreground">{job.job_id}</span>
      {progress !== null && isJobActive(job) && (
        <span className="flex items-center gap-2">
          <span className="h-1.5 w-32 overflow-hidden rounded-full bg-muted">
            <span className="block h-full bg-primary transition-all" style={{ width: `${Math.min(progress, 100)}%` }} />
          </span>
          <span className="tabular-nums text-muted-foreground">{progress} %</span>
        </span>
      )}
    </div>
  );
}

/** Jobs of a training study (one per algorithm), refreshed while any of them is still running. */
export function useStudyJobs(studyId: string | null, intervalMs = 4000): { jobs: MlJob[]; loading: boolean; error: string | null } {
  const [jobs, setJobs] = React.useState<MlJob[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  React.useEffect(() => {
    setJobs([]);
    setError(null);
    if (!studyId) return undefined;
    let cancelled = false;
    let timer: number | undefined;
    setLoading(true);
    const poll = async () => {
      try {
        const current = await listMlJobs({ studyId, kind: 'TRAIN', limit: 20 });
        if (cancelled) return;
        setJobs(current);
        setError(null);
        if (current.length === 0 || current.some(isJobActive)) timer = window.setTimeout(() => void poll(), intervalMs);
      } catch (cause) {
        if (cancelled) return;
        setError(errorMessage(cause, 'No se pudo consultar los entrenamientos.'));
        timer = window.setTimeout(() => void poll(), intervalMs * 2);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void poll();
    return () => {
      cancelled = true;
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [studyId, intervalMs]);
  return { jobs, loading, error };
}
