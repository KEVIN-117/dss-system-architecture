/**
 * Load Manager client (LM-007): calls the BFF routes `/api/admin/dw/etl/*` (LM-006) with the session cookie.
 * Errors carry the BFF code and, for rejected requests, the reason dw-control-service gave (for example a
 * schedule inside the DSA operating hours).
 */

export type EtlLaunchStatus =
  | 'QUEUED'
  | 'SUBMITTED'
  | 'RUNNING'
  | 'SUCCEEDED'
  | 'FAILED'
  | 'STOPPED'
  | 'SKIPPED'
  | 'SUBMIT_FAILED';
export type EtlLaunchTrigger = 'MANUAL' | 'SCHEDULED';
export type EtlScheduleMode = 'AUTO_PENDING_CLOSURES' | 'NO_PARAMETERS';

export interface LoadManagerHealth {
  hopOnline: boolean;
  hopStatus: string | null;
  monitoringEnabled: boolean;
  schedulerEnabled: boolean;
  operatingWindow: string;
  checkedAt: string;
}
export interface EtlProcess {
  code: string;
  displayName: string;
  description: string;
  workflowFile: string;
  parameterNames: string[];
  schedulable: boolean;
  scheduleMode: EtlScheduleMode | null;
  enabled: boolean;
}
export interface EtlLaunch {
  id: string;
  processCode: string;
  trigger: EtlLaunchTrigger;
  scheduleId: number | null;
  closureId: number | null;
  runId: string | null;
  parameters: Record<string, string>;
  status: EtlLaunchStatus;
  active: boolean;
  hopExecutionId: string | null;
  requestedBy: string;
  requestedAt: string;
  submittedAt: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  stopRequestedBy: string | null;
  stopRequestedAt: string | null;
  resultSummary: string | null;
  rowVersion: number;
}
export interface EtlLaunchLog {
  launchId: string;
  status: EtlLaunchStatus;
  active: boolean;
  log: string;
}
export interface EtlStatus {
  running: boolean;
  active: EtlLaunch[];
}
export interface EtlSchedule {
  id: number;
  processCode: string;
  name: string;
  cronExpression: string;
  timezone: string;
  mode: EtlScheduleMode;
  enabled: boolean;
  nextFireAt: string | null;
  lastFiredAt: string | null;
  lastLaunchId: string | null;
  firing: boolean;
  createdBy: string;
  createdAt: string;
  updatedBy: string;
  updatedAt: string;
  rowVersion: number;
}
export interface SchedulePreview {
  cronExpression: string;
  timezone: string;
  operatingWindow: string;
  valid: boolean;
  validationMessage: string | null;
  occurrences: { at: string; insideOperatingWindow: boolean }[];
}
export interface Page<T> {
  items: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}
export interface LaunchFilters {
  processCode?: string;
  status?: EtlLaunchStatus;
  trigger?: EtlLaunchTrigger;
  scheduleId?: number;
  page: number;
  size: number;
}
export interface LaunchEtlInput {
  processCode: string;
  executionKind?: 'CIERRE_ACADEMICO' | 'REPROCESO';
  closureId?: number;
  retryOfRunId?: string;
  runId?: string;
}
export interface ScheduleInput {
  processCode: string;
  name: string;
  cronExpression: string;
  timezone?: string;
  enabled?: boolean;
}
export interface LoadManagerCapabilities {
  canReadEtlExecutions: boolean;
  canExecuteEtl: boolean;
  canManageEtlSchedules: boolean;
}

/** Error returned by the Load Manager routes; `message` is ready to show to the user. */
export class LoadManagerError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string | null,
  ) {
    super(message);
    this.name = 'LoadManagerError';
  }
}

const BFF_BASE_URL =
  process.env.NEXT_PUBLIC_BFF_URL?.trim().replace(/\/$/, '') ?? '';
const ETL_URL = `${BFF_BASE_URL}/api/admin/dw/etl`;

const MESSAGES: Record<string, string> = {
  HOP_UNAVAILABLE:
    'Hop Server no está disponible. La solicitud quedó registrada como no enviada; inténtalo más tarde.',
  HOP_REJECTED: 'Hop Server rechazó la ejecución. Revisa el detalle del lanzamiento.',
  DW_CONTROL_UNAVAILABLE: 'El servicio de control del DW no está disponible.',
  DW_CONTROL_TIMEOUT: 'El servicio de control del DW tardó demasiado en responder.',
};

async function toError(response: Response): Promise<LoadManagerError> {
  let code: string | null = null;
  let detail: string | null = null;
  let error: string | null = null;
  try {
    const body: unknown = await response.json();
    if (isRecord(body)) {
      if (typeof body.code === 'string') code = body.code;
      if (typeof body.detail === 'string') detail = body.detail;
      if (typeof body.error === 'string') error = body.error;
    }
  } catch {
    // Non-JSON response: fall back to the status-based message.
  }
  const message =
    detail ??
    (code && MESSAGES[code]) ??
    (response.status === 409
      ? 'La operación choca con el estado actual: puede haber una ejecución activa del proceso o la programación cambió. Actualiza y vuelve a intentarlo.'
      : response.status === 403
        ? 'Tu cuenta no tiene permiso para esta operación.'
        : response.status === 404
          ? 'El recurso ya no existe.'
          : (error ?? `Solicitud fallida (${response.status}).`));
  return new LoadManagerError(message, response.status, code);
}

async function request<T>(
  url: string,
  init: RequestInit = {},
  signal?: AbortSignal,
): Promise<T> {
  const response = await fetch(url, {
    ...init,
    credentials: 'include',
    cache: 'no-store',
    headers: {
      Accept: 'application/json',
      ...(init.body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    signal,
  });
  if (!response.ok) throw await toError(response);
  if (response.status === 204) return null as T;
  return (await response.json()) as T;
}

function post<T>(url: string, body?: unknown): Promise<T> {
  return request<T>(url, {
    method: 'POST',
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

export function getLoadManagerCapabilities(
  signal?: AbortSignal,
): Promise<LoadManagerCapabilities> {
  return request(`${BFF_BASE_URL}/api/admin/dw/capabilities`, {}, signal);
}

export function getLoadManagerHealth(signal?: AbortSignal): Promise<LoadManagerHealth> {
  return request(`${ETL_URL}/health`, {}, signal);
}

export function getEtlStatus(signal?: AbortSignal): Promise<EtlStatus> {
  return request(`${ETL_URL}/status`, {}, signal);
}

export function listEtlProcesses(signal?: AbortSignal): Promise<EtlProcess[]> {
  return request(`${ETL_URL}/processes`, {}, signal);
}

export function listEtlLaunches(
  filters: LaunchFilters,
  signal?: AbortSignal,
): Promise<Page<EtlLaunch>> {
  const params = new URLSearchParams({
    page: String(filters.page),
    size: String(filters.size),
  });
  if (filters.processCode) params.set('processCode', filters.processCode);
  if (filters.status) params.set('status', filters.status);
  if (filters.trigger) params.set('trigger', filters.trigger);
  if (filters.scheduleId !== undefined)
    params.set('scheduleId', String(filters.scheduleId));
  return request(`${ETL_URL}/launches?${params}`, {}, signal);
}

export function getEtlLaunch(launchId: string, signal?: AbortSignal): Promise<EtlLaunch> {
  return request(`${ETL_URL}/launches/${encodeURIComponent(launchId)}`, {}, signal);
}

export function getEtlLaunchLogs(
  launchId: string,
  signal?: AbortSignal,
): Promise<EtlLaunchLog> {
  return request(
    `${ETL_URL}/launches/${encodeURIComponent(launchId)}/logs`,
    {},
    signal,
  );
}

export function launchEtlProcess(input: LaunchEtlInput): Promise<EtlLaunch> {
  return post(`${ETL_URL}/launches`, input);
}

export function stopEtlLaunch(launchId: string): Promise<EtlLaunch> {
  return post(`${ETL_URL}/launches/${encodeURIComponent(launchId)}/stop`);
}

export function listEtlSchedules(signal?: AbortSignal): Promise<EtlSchedule[]> {
  return request(`${ETL_URL}/schedules`, {}, signal);
}

export function previewEtlSchedule(
  cronExpression: string,
  timezone?: string,
  count = 8,
  signal?: AbortSignal,
): Promise<SchedulePreview> {
  const params = new URLSearchParams({ cronExpression: cronExpression.trim(), count: String(count) });
  if (timezone) params.set('timezone', timezone);
  return request(`${ETL_URL}/schedules/preview?${params}`, {}, signal);
}

export function createEtlSchedule(input: ScheduleInput): Promise<EtlSchedule> {
  return post(`${ETL_URL}/schedules`, input);
}

export function updateEtlSchedule(
  scheduleId: number,
  input: { name: string; cronExpression: string; timezone?: string; rowVersion: number },
): Promise<EtlSchedule> {
  return request(`${ETL_URL}/schedules/${scheduleId}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  });
}

export function setEtlScheduleEnabled(
  scheduleId: number,
  enabled: boolean,
  rowVersion: number,
): Promise<EtlSchedule> {
  return post(`${ETL_URL}/schedules/${scheduleId}/${enabled ? 'enable' : 'disable'}`, {
    rowVersion,
  });
}

export function deleteEtlSchedule(scheduleId: number, rowVersion: number): Promise<null> {
  return request(`${ETL_URL}/schedules/${scheduleId}?rowVersion=${rowVersion}`, {
    method: 'DELETE',
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
