import type {
  EtlExecutionMetric,
  EtlExecutionStep,
  ExecutionKind,
  ExecutionStatus,
  SanitizedExecutionError,
} from '../../data-access/dw-control';

export type StepStatus = EtlExecutionStep['status'];
export type StepPhase = EtlExecutionStep['phase'];
export type Severity = SanitizedExecutionError['severity'];
export type Tone = 'success' | 'danger' | 'running' | 'warning' | 'neutral';

export const ACTIVE_STATUSES: ExecutionStatus[] = [
  'SOLICITADA',
  'EN_EJECUCION',
  'PUBLICANDO',
];

export const STATUS_META: Record<ExecutionStatus, { label: string; tone: Tone }> = {
  SOLICITADA: { label: 'Solicitada', tone: 'neutral' },
  EN_EJECUCION: { label: 'En ejecución', tone: 'running' },
  PUBLICANDO: { label: 'Publicando', tone: 'running' },
  EXITOSA: { label: 'Exitosa', tone: 'success' },
  FALLIDA: { label: 'Fallida', tone: 'danger' },
  CANCELADA: { label: 'Cancelada', tone: 'warning' },
};

export const STEP_STATUS_META: Record<StepStatus, { label: string; tone: Tone }> = {
  PENDIENTE: { label: 'Pendiente', tone: 'neutral' },
  EN_EJECUCION: { label: 'En ejecución', tone: 'running' },
  EXITOSO: { label: 'Exitoso', tone: 'success' },
  FALLIDO: { label: 'Fallido', tone: 'danger' },
  OMITIDO: { label: 'Omitido', tone: 'warning' },
};

export const KIND_LABEL: Record<ExecutionKind, string> = {
  HISTORICA: 'Carga histórica',
  CIERRE_ACADEMICO: 'Cierre académico',
  REPROCESO: 'Reproceso',
};

export const PHASES: { code: StepPhase; label: string }[] = [
  { code: 'EXTRACCION', label: 'Extracción' },
  { code: 'STAGING', label: 'Staging' },
  { code: 'TRANSFORMACION', label: 'Transformación' },
  { code: 'VALIDACION', label: 'Validación' },
  { code: 'PUBLICACION', label: 'Publicación' },
];

export const SEVERITY_META: Record<Severity, { label: string; tone: Tone; rank: number }> = {
  CRITICAL: { label: 'Crítica', tone: 'danger', rank: 0 },
  ERROR: { label: 'Error', tone: 'danger', rank: 1 },
  WARN: { label: 'Advertencia', tone: 'warning', rank: 2 },
  INFO: { label: 'Información', tone: 'neutral', rank: 3 },
};

const WORDS: Record<string, string> = {
  dim: 'dimensión',
  dimension: 'dimensión',
  fact: 'hechos',
  source: 'origen',
  rows: 'filas',
  observed: 'observadas',
  prepared: 'preparadas',
  snapshot: 'instantánea',
  student: 'estudiante',
  estudiante: 'estudiante',
  admision: 'admisión',
  scd2: 'SCD2',
  dw: 'DW',
  etl: 'ETL',
};

/** Convierte códigos técnicos (snake_case o MAYÚSCULAS) en texto legible. */
export function humanize(code: string): string {
  const words = code
    .toLowerCase()
    .split(/[_\s.-]+/)
    .filter(Boolean)
    .map((w) => WORDS[w] ?? w);
  const text = words.join(' ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}

const METRIC_LABELS: Record<string, string> = {
  source_rows_observed: 'Filas observadas en origen',
  student_snapshot_rows: 'Filas de la instantánea de estudiantes',
};

export function metricLabel(name: string): string {
  if (METRIC_LABELS[name]) return METRIC_LABELS[name];
  const prepared = name.match(/^(.+)_prepared_rows$/);
  if (prepared) return `Filas preparadas · ${humanize(prepared[1])}`;
  const rows = name.match(/^(.+)_rows$/);
  if (rows) return `Filas · ${humanize(rows[1])}`;
  return humanize(name);
}

/** `academico.alumnos` → `Alumnos`: el último segmento del contrato de origen. */
export function sourceLabel(source: string): string {
  const last = source.split('.').filter(Boolean).at(-1) ?? source;
  return humanize(last);
}

export function unitLabel(unit: string): string {
  const u = unit.toUpperCase();
  if (u === 'ROWS' || u === 'FILAS') return 'filas';
  if (u === 'UNIDAD') return '';
  if (u === 'SECONDS' || u === 'S') return 's';
  return unit.toLowerCase();
}

const numberFormat = new Intl.NumberFormat('es-BO');
export function formatNumber(value: number): string {
  return numberFormat.format(value);
}

export function compactNumber(value: number): string {
  return new Intl.NumberFormat('es-BO', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value);
}

export function dateLabel(value: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? '—'
    : new Intl.DateTimeFormat('es-BO', {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(date);
}

export function timeLabel(value: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? '—'
    : new Intl.DateTimeFormat('es-BO', { timeStyle: 'medium' }).format(date);
}

export function relativeLabel(value: string | null, now = Date.now()): string {
  if (!value) return '—';
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return '—';
  const diff = Math.round((time - now) / 1000);
  const rtf = new Intl.RelativeTimeFormat('es', { numeric: 'auto' });
  const abs = Math.abs(diff);
  if (abs < 60) return rtf.format(diff, 'second');
  if (abs < 3600) return rtf.format(Math.round(diff / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), 'hour');
  return rtf.format(Math.round(diff / 86400), 'day');
}

export function durationMs(
  start: string | null,
  end: string | null,
  now = Date.now(),
): number | null {
  if (!start) return null;
  const from = new Date(start).getTime();
  const to = end ? new Date(end).getTime() : now;
  if (!Number.isFinite(from) || !Number.isFinite(to) || to < from) return null;
  return to - from;
}

export function formatDuration(ms: number | null): string {
  if (ms === null) return '—';
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds} s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ${seconds % 60} s`;
  const hours = Math.floor(minutes / 60);
  return `${hours} h ${minutes % 60} min`;
}

export function durationLabel(
  start: string | null,
  end: string | null,
  now = Date.now(),
): string {
  return formatDuration(durationMs(start, end, now));
}

export type MetricGroup = {
  name: string;
  label: string;
  unit: string;
  total: number;
  entries: EtlExecutionMetric[];
};

/** Agrupa métricas repetidas (p. ej. una por fuente) bajo un mismo nombre. */
export function groupMetrics(metrics: EtlExecutionMetric[]): MetricGroup[] {
  const map = new Map<string, MetricGroup>();
  for (const metric of metrics) {
    const key = `${metric.name}|${metric.unit}`;
    const group = map.get(key) ?? {
      name: metric.name,
      label: metricLabel(metric.name),
      unit: unitLabel(metric.unit),
      total: 0,
      entries: [],
    };
    group.total += metric.value;
    group.entries.push(metric);
    map.set(key, group);
  }
  return [...map.values()]
    .map((g) => ({
      ...g,
      entries: [...g.entries].sort((a, b) => b.value - a.value),
    }))
    .sort((a, b) => b.entries.length - a.entries.length || b.total - a.total);
}

export type PhaseSummary = {
  code: StepPhase;
  label: string;
  tone: Tone;
  statusLabel: string;
  total: number;
  done: number;
};

export function summarizePhases(steps: EtlExecutionStep[]): PhaseSummary[] {
  return PHASES.map(({ code, label }) => {
    const inPhase = steps.filter((s) => s.phase === code);
    const done = inPhase.filter((s) => s.status === 'EXITOSO').length;
    let tone: Tone = 'neutral';
    let statusLabel = inPhase.length ? 'Pendiente' : 'Sin pasos';
    if (inPhase.some((s) => s.status === 'FALLIDO')) {
      tone = 'danger';
      statusLabel = 'Con fallos';
    } else if (inPhase.some((s) => s.status === 'EN_EJECUCION')) {
      tone = 'running';
      statusLabel = 'En curso';
    } else if (inPhase.length && done === inPhase.length) {
      tone = 'success';
      statusLabel = 'Completada';
    } else if (inPhase.length && inPhase.every((s) => s.status === 'OMITIDO')) {
      tone = 'warning';
      statusLabel = 'Omitida';
    } else if (done > 0) {
      tone = 'running';
      statusLabel = 'Parcial';
    }
    return { code, label, tone, statusLabel, total: inPhase.length, done };
  });
}
