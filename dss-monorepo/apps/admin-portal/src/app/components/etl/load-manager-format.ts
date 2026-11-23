import type {
  EtlLaunch,
  EtlLaunchStatus,
  EtlLaunchTrigger,
} from '../../data-access/load-manager';
import type { AcademicClosure, EtlExecutionSummary } from '../../data-access/dw-control';
import type { Tone } from './etl-format';

const TERMINAL = new Set(['EXITOSA', 'FALLIDA', 'CANCELADA']);

/** Why an execution cannot be reprocessed right now, or null when it can. */
export type ReprocessBlock = 'CLOSURE_NOT_CLOSED' | null;

export interface ReprocessCandidate {
  execution: EtlExecutionSummary;
  blocked: ReprocessBlock;
}

/**
 * Latest finished vertical attempt per scope (closure, or gestión/periodo when there is none), marked with whether
 * the reprocess gate of create_hop_etl_execution would accept it: a closure reprocess needs the closure CERRADO and
 * not processed. `closedClosures` is null when the user cannot read closures; then nothing is marked as blocked and
 * dw-control-service has the last word.
 */
export function reprocessCandidates(
  executions: EtlExecutionSummary[],
  closedClosures: AcademicClosure[] | null,
): ReprocessCandidate[] {
  const reopenable = closedClosures
    ? new Set(closedClosures.filter((c) => c.status === 'CERRADO' && !c.processedRunId).map((c) => c.closureId))
    : null;
  const latest = new Map<string, EtlExecutionSummary>();
  for (const execution of executions) {
    if (!TERMINAL.has(execution.status)) continue;
    if (execution.requestedGestion === null || execution.requestedPeriodo === null) continue;
    const scope =
      execution.closureId !== null
        ? `c${execution.closureId}`
        : `p${execution.requestedGestion}-${execution.requestedPeriodo}`;
    const current = latest.get(scope);
    if (!current || execution.requestedAt > current.requestedAt) latest.set(scope, execution);
  }
  return [...latest.values()]
    .sort((a, b) => b.requestedAt.localeCompare(a.requestedAt))
    .map((execution) => ({
      execution,
      blocked:
        reopenable && execution.closureId !== null && !reopenable.has(execution.closureId)
          ? 'CLOSURE_NOT_CLOSED'
          : null,
    }));
}

export const LAUNCH_STATUS_META: Record<EtlLaunchStatus, { label: string; tone: Tone }> = {
  QUEUED: { label: 'En cola', tone: 'neutral' },
  SUBMITTED: { label: 'Enviada a Hop', tone: 'running' },
  RUNNING: { label: 'En ejecución', tone: 'running' },
  SUCCEEDED: { label: 'Exitosa', tone: 'success' },
  FAILED: { label: 'Fallida', tone: 'danger' },
  STOPPED: { label: 'Detenida', tone: 'warning' },
  SKIPPED: { label: 'Omitida', tone: 'neutral' },
  SUBMIT_FAILED: { label: 'No enviada', tone: 'danger' },
};

export const TRIGGER_LABEL: Record<EtlLaunchTrigger, string> = {
  MANUAL: 'Manual',
  SCHEDULED: 'Programada',
};

/** Fallback names when the catalog has not loaded yet. */
const PROCESS_LABEL: Record<string, string> = {
  VERTICAL_LOAD: 'Carga vertical del DW',
  CATALOG_SYNC: 'Sincronización del catálogo académico',
  PUBLISH_STAGED: 'Publicación de una ejecución preparada',
};

export function processLabel(code: string, catalog?: { code: string; displayName: string }[]): string {
  return catalog?.find((process) => process.code === code)?.displayName ?? PROCESS_LABEL[code] ?? code;
}

const PARAMETER_LABEL: Record<string, string> = {
  P_RUN_ID: 'Run ID',
  P_REQUESTED_GESTION: 'Gestión',
  P_REQUESTED_PERIODO: 'Periodo',
  P_EXECUTION_KIND: 'Tipo de ejecución',
  P_RETRY_OF_RUN_ID: 'Reintento de',
};

export function parameterLabel(name: string): string {
  return PARAMETER_LABEL[name] ?? name;
}

/** Common nightly and weekend schedules, all outside the default DSA hours. */
export const CRON_PRESETS: { label: string; cron: string }[] = [
  { label: 'Todos los días a las 02:00', cron: '0 0 2 * * *' },
  { label: 'Días hábiles a las 22:00', cron: '0 0 22 * * MON-FRI' },
  { label: 'Sábados a las 06:00', cron: '0 0 6 * * SAT' },
  { label: 'Domingos a las 03:00', cron: '0 0 3 * * SUN' },
];

/** Moment the launch reached Hop (or was requested) for elapsed-time displays. */
export function launchStart(launch: EtlLaunch): string {
  return launch.startedAt ?? launch.submittedAt ?? launch.requestedAt;
}
