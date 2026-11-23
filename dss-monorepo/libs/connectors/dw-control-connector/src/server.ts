/** Server-only client for dw-control-service. Never expose bearer tokens to browser code. */

export type DwControlPermission =
  | 'DW_CLOSURE_READ'
  | 'DW_CLOSURE_MANAGE'
  | 'DW_ETL_MONITOR_READ'
  /** LM-005: launch and stop Load Manager executions. */
  | 'DW_ETL_EXECUTE'
  /** LM-005: create, edit, pause and delete Load Manager schedules. */
  | 'DW_ETL_SCHEDULE_MANAGE';

export interface DwControlServiceConfig {
  baseUrl: string;
  accessToken: string;
  timeoutMs?: number;
}

export type ClosureStatus = 'PENDIENTE' | 'CERRADO' | 'REABIERTO' | 'PROCESADO';
export type ExecutionKind = 'HISTORICA' | 'CIERRE_ACADEMICO' | 'REPROCESO';
export type ExecutionStatus =
  | 'SOLICITADA'
  | 'EN_EJECUCION'
  | 'PUBLICANDO'
  | 'EXITOSA'
  | 'FALLIDA'
  | 'CANCELADA';

export interface Page<T> {
  items: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}
export interface AcademicClosure {
  closureId: number;
  gestion: number;
  periodo: number;
  status: ClosureStatus;
  effectiveAt: string | null;
  authorizedBySubject: string | null;
  createdBySubject: string;
  closureReason: string;
  version: number;
  processedRunId: string | null;
  processedAt: string | null;
  createdAt: string;
  updatedAt: string;
}
export interface AcademicClosureEvent {
  eventId: number;
  closureId: number;
  fromStatus: ClosureStatus | null;
  toStatus: ClosureStatus;
  actorSubject: string;
  reason: string;
  runId: string | null;
  occurredAt: string;
}
export interface ClosureListQuery {
  gestion?: number;
  periodo?: number;
  status?: ClosureStatus;
  page?: number;
  size?: number;
}
export interface ExecutionListQuery {
  status?: ExecutionStatus;
  executionKind?: ExecutionKind;
  gestion?: number;
  periodo?: number;
  closureId?: number;
  page?: number;
  size?: number;
}
export interface EtlExecutionSummary {
  runId: string;
  executionKind: ExecutionKind;
  status: ExecutionStatus;
  closureId: number | null;
  requestedGestion: number | null;
  requestedPeriodo: number | null;
  requestedBy: string;
  requestedAt: string;
  startedAt: string | null;
  endedAt: string | null;
}
export interface EtlExecutionStep {
  stepCode: string;
  phase:
    | 'EXTRACCION'
    | 'STAGING'
    | 'TRANSFORMACION'
    | 'VALIDACION'
    | 'PUBLICACION';
  status: 'PENDIENTE' | 'EN_EJECUCION' | 'EXITOSO' | 'FALLIDO' | 'OMITIDO';
  stepOrder: number;
  startedAt: string | null;
  endedAt: string | null;
}
export interface EtlExecutionMetric {
  name: string;
  value: number;
  unit: string;
  measuredAt: string;
  /** Contrato de origen que produjo la métrica (p. ej. `academico.alumnos`). */
  source: string | null;
  /** Paso asociado a la métrica, si existe. */
  stepCode: string | null;
}
export interface SanitizedExecutionError {
  severity: 'INFO' | 'WARN' | 'ERROR' | 'CRITICAL';
  code: string;
  message: string;
  stepCode: string | null;
  occurredAt: string;
}
export interface EtlExecutionDetail extends EtlExecutionSummary {
  steps: EtlExecutionStep[];
  metrics: EtlExecutionMetric[];
  errors: SanitizedExecutionError[];
}

export class DwControlClientError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message = 'dw-control-service request failed',
    /**
     * Reason authored by dw-control-service for a rejected request (400/409), for example why a schedule
     * falls inside the DSA operating hours. Only set after passing {@link isSafeUpstreamDetail}.
     */
    public readonly detail?: string,
  ) {
    super(message);
    this.name = 'DwControlClientError';
  }
}

export function listAcademicClosures(
  config: DwControlServiceConfig,
  query: ClosureListQuery = {},
  signal?: AbortSignal,
): Promise<Page<AcademicClosure>> {
  validatePage(query);
  if (
    query.gestion !== undefined &&
    !integerBetween(query.gestion, 2000, 32767)
  )
    throw invalidRequest('Invalid gestion filter');
  if (query.periodo !== undefined && !integerBetween(query.periodo, 1, 32767))
    throw invalidRequest('Invalid periodo filter');
  if (query.status !== undefined && !oneOf(query.status, CLOSURE_STATUSES))
    throw invalidRequest('Invalid closure status filter');
  return getPage(
    config,
    '/api/v1/academic-closures',
    query,
    parseClosure,
    signal,
  );
}

export function getAcademicClosure(
  config: DwControlServiceConfig,
  closureId: number,
  signal?: AbortSignal,
): Promise<AcademicClosure> {
  validateClosureId(closureId);
  return requestJson(
    config,
    `/api/v1/academic-closures/${closureId}`,
    { method: 'GET' },
    parseClosure,
    signal,
  );
}

export function listAcademicClosureEvents(
  config: DwControlServiceConfig,
  closureId: number,
  query: Pick<ClosureListQuery, 'page' | 'size'> = {},
  signal?: AbortSignal,
): Promise<Page<AcademicClosureEvent>> {
  validateClosureId(closureId);
  validatePage(query);
  return getPage(
    config,
    `/api/v1/academic-closures/${closureId}/events`,
    query,
    parseClosureEvent,
    signal,
  );
}

export function createAcademicClosure(
  config: DwControlServiceConfig,
  input: { gestion: number; periodo: number; reason: string },
  signal?: AbortSignal,
): Promise<AcademicClosure> {
  if (
    !integerBetween(input.gestion, 2000, 32767) ||
    !integerBetween(input.periodo, 1, 32767) ||
    !validReason(input.reason)
  )
    throw invalidRequest('Invalid academic closure request');
  return postJson(
    config,
    '/api/v1/academic-closures',
    input,
    parseClosure,
    signal,
  );
}

export function closeAcademicPeriod(
  config: DwControlServiceConfig,
  closureId: number,
  input: { effectiveAt: string; reason: string },
  signal?: AbortSignal,
): Promise<AcademicClosure> {
  validateClosureId(closureId);
  if (!validDateTime(input.effectiveAt) || !validReason(input.reason))
    throw invalidRequest('Invalid close-period request');
  return postJson(
    config,
    `/api/v1/academic-closures/${closureId}/close`,
    input,
    parseClosure,
    signal,
  );
}

export function reopenAcademicPeriod(
  config: DwControlServiceConfig,
  closureId: number,
  input: { reason: string },
  signal?: AbortSignal,
): Promise<AcademicClosure> {
  validateClosureId(closureId);
  if (!validReason(input.reason))
    throw invalidRequest('Invalid reopen-period request');
  return postJson(
    config,
    `/api/v1/academic-closures/${closureId}/reopen`,
    input,
    parseClosure,
    signal,
  );
}

export function listEtlExecutions(
  config: DwControlServiceConfig,
  query: ExecutionListQuery = {},
  signal?: AbortSignal,
): Promise<Page<EtlExecutionSummary>> {
  validatePage(query);
  if (
    query.gestion !== undefined &&
    !integerBetween(query.gestion, 2000, 32767)
  )
    throw invalidRequest('Invalid gestion filter');
  if (query.periodo !== undefined && !integerBetween(query.periodo, 1, 32767))
    throw invalidRequest('Invalid periodo filter');
  if (query.closureId !== undefined && !positiveInteger(query.closureId))
    throw invalidRequest('Invalid closureId filter');
  if (query.status !== undefined && !oneOf(query.status, EXECUTION_STATUSES))
    throw invalidRequest('Invalid execution status filter');
  if (
    query.executionKind !== undefined &&
    !oneOf(query.executionKind, EXECUTION_KINDS)
  )
    throw invalidRequest('Invalid execution kind filter');
  return getPage(
    config,
    '/api/v1/etl/executions',
    query,
    parseExecutionSummary,
    signal,
  );
}

export function getEtlExecution(
  config: DwControlServiceConfig,
  runId: string,
  signal?: AbortSignal,
): Promise<EtlExecutionDetail> {
  if (!isUuid(runId)) throw invalidRequest('Invalid execution ID');
  return requestJson(
    config,
    `/api/v1/etl/executions/${encodeURIComponent(runId)}`,
    { method: 'GET' },
    parseExecutionDetail,
    signal,
  );
}

const CLOSURE_STATUSES = [
  'PENDIENTE',
  'CERRADO',
  'REABIERTO',
  'PROCESADO',
] as const;
const EXECUTION_KINDS = ['HISTORICA', 'CIERRE_ACADEMICO', 'REPROCESO'] as const;
const EXECUTION_STATUSES = [
  'SOLICITADA',
  'EN_EJECUCION',
  'PUBLICANDO',
  'EXITOSA',
  'FALLIDA',
  'CANCELADA',
] as const;

function getPage<T, Q extends object>(
  config: DwControlServiceConfig,
  path: string,
  query: Q,
  parseItem: (item: unknown) => T,
  signal?: AbortSignal,
): Promise<Page<T>> {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query))
    if (value !== undefined) params.set(key, String(value));
  return requestJson(
    config,
    `${path}${params.size ? `?${params}` : ''}`,
    { method: 'GET' },
    (value) => parsePage(value, parseItem),
    signal,
  );
}

function postJson<T>(
  config: DwControlServiceConfig,
  path: string,
  body: unknown,
  parse: (value: unknown) => T,
  signal?: AbortSignal,
): Promise<T> {
  return requestJson(
    config,
    path,
    { method: 'POST', body: JSON.stringify(body) },
    parse,
    signal,
  );
}

async function requestJson<T>(
  config: DwControlServiceConfig,
  path: string,
  init: RequestInit,
  parse: (value: unknown) => T,
  externalSignal?: AbortSignal,
): Promise<T> {
  const baseUrl = validateBaseUrl(config.baseUrl);
  if (!config.accessToken.trim())
    throw new DwControlClientError(
      503,
      'DW_CONTROL_CONFIGURATION_ERROR',
      'dw-control-service is not configured',
    );
  const timeoutMs = config.timeoutMs ?? 15_000;
  if (!integerBetween(timeoutMs, 1000, 60_000))
    throw new DwControlClientError(
      503,
      'DW_CONTROL_CONFIGURATION_ERROR',
      'dw-control-service timeout is invalid',
    );
  const timeoutController = new AbortController();
  const timeout = setTimeout(() => timeoutController.abort(), timeoutMs);
  const signal = externalSignal
    ? AbortSignal.any([externalSignal, timeoutController.signal])
    : timeoutController.signal;
  try {
    const response = await fetch(new URL(path, `${baseUrl}/`), {
      ...init,
      headers: {
        Accept: 'application/json',
        ...(init.body === undefined
          ? {}
          : { 'Content-Type': 'application/json' }),
        ...init.headers,
        Authorization: `Bearer ${config.accessToken}`,
      },
      cache: 'no-store',
      redirect: 'manual',
      signal,
    });
    if (!response.ok) throw await upstreamError(response);
    if (response.status === 204) return parse(null);
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      throw invalidResponse();
    }
    try {
      return parse(body);
    } catch (error) {
      if (error instanceof DwControlClientError) throw error;
      throw invalidResponse();
    }
  } catch (error) {
    if (error instanceof DwControlClientError) throw error;
    if (timeoutController.signal.aborted)
      throw new DwControlClientError(
        504,
        'DW_CONTROL_TIMEOUT',
        'dw-control-service request timed out',
      );
    throw new DwControlClientError(
      503,
      'DW_CONTROL_UNAVAILABLE',
      'dw-control-service is unavailable',
    );
  } finally {
    clearTimeout(timeout);
  }
}

/** Upstream problem codes that keep their meaning for the portal (LM-005 Load Manager). */
const PASS_THROUGH_CODES: Record<number, readonly string[]> = {
  502: ['HOP_REJECTED'],
  503: ['HOP_UNAVAILABLE'],
};

async function upstreamError(response: Response): Promise<DwControlClientError> {
  const status = response.status;
  const problem = await readProblem(response);
  const passThrough = PASS_THROUGH_CODES[status];
  if (passThrough && problem?.code && passThrough.includes(problem.code))
    return new DwControlClientError(status, problem.code);
  const error = upstreamErrorCode(status);
  const detail =
    (status === 400 || status === 404 || status === 409 || status === 422) &&
    isSafeUpstreamDetail(problem?.detail)
      ? problem.detail
      : undefined;
  return detail === undefined
    ? error
    : new DwControlClientError(status, error.code, error.message, detail);
}

/** Reads `{code, detail}` from an RFC 9457 problem body; anything else is ignored. */
async function readProblem(
  response: Response,
): Promise<{ code?: string; detail?: string } | null> {
  const type = response.headers.get('content-type') ?? '';
  if (!/application\/(problem\+)?json/i.test(type)) return null;
  try {
    const body: unknown = await response.json();
    if (typeof body !== 'object' || body === null || Array.isArray(body))
      return null;
    const value = body as Record<string, unknown>;
    return {
      ...(typeof value.code === 'string' && /^[A-Z][A-Z0-9_]{0,63}$/.test(value.code)
        ? { code: value.code }
        : {}),
      ...(typeof value.detail === 'string' ? { detail: value.detail } : {}),
    };
  } catch {
    return null;
  }
}

/**
 * dw-control-service details for 400/404/409/422 are authored messages (for example "La ejecución del lunes ... cae dentro
 * del horario operativo de la DSA"). They are still bounded and screened for anything that looks like an internal
 * leak before reaching the browser.
 */
export function isSafeUpstreamDetail(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.trim().length > 0 &&
    value.length <= 500 &&
    !hasControlCharacters(value) &&
    !/(password|passwd|secret|token|authorization|bearer|jdbc|sqlstate|exception|stack\s*trace|https?:\/\/)/i.test(
      value,
    )
  );
}

/** Control characters other than tab and line feed. */
function hasControlCharacters(value: string): boolean {
  for (let index = 0; index < value.length; index++) {
    const code = value.charCodeAt(index);
    if ((code < 0x20 && code !== 0x09 && code !== 0x0a) || code === 0x7f) return true;
  }
  return false;
}

function upstreamErrorCode(status: number): DwControlClientError {
  const code =
    status === 401
      ? 'DW_CONTROL_UNAUTHORIZED'
      : status === 403
        ? 'DW_CONTROL_FORBIDDEN'
        : status === 404
          ? 'DW_CONTROL_NOT_FOUND'
          : status === 409
            ? 'DW_CONTROL_CONFLICT'
            : status === 400 || status === 422
              ? 'DW_CONTROL_INVALID_REQUEST'
              : status === 429
                ? 'DW_CONTROL_RATE_LIMITED'
                : 'DW_CONTROL_UPSTREAM_ERROR';
  return new DwControlClientError(status, code);
}

function validateBaseUrl(value: string): string {
  try {
    const url = new URL(value);
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    )
      throw new Error('invalid');
    return url.toString().replace(/\/$/, '');
  } catch {
    throw new DwControlClientError(
      503,
      'DW_CONTROL_CONFIGURATION_ERROR',
      'dw-control-service URL is invalid',
    );
  }
}

function parsePage<T>(
  value: unknown,
  parseItem: (item: unknown) => T,
): Page<T> {
  const v = record(value);
  if (
    !Array.isArray(v.items) ||
    !nonNegativeInteger(v.page) ||
    !positiveInteger(v.size) ||
    !nonNegativeInteger(v.totalElements) ||
    !nonNegativeInteger(v.totalPages)
  )
    throw invalidResponse();
  return {
    items: v.items.map(parseItem),
    page: v.page,
    size: v.size,
    totalElements: v.totalElements,
    totalPages: v.totalPages,
  };
}

function parseClosure(value: unknown): AcademicClosure {
  const v = record(value);
  if (
    !positiveInteger(v.closureId) ||
    !integerBetween(v.gestion, 2000, 32767) ||
    !integerBetween(v.periodo, 1, 32767) ||
    !oneOf(v.status, CLOSURE_STATUSES) ||
    !nullableDate(v.effectiveAt) ||
    !nullableString(v.authorizedBySubject) ||
    !string(v.createdBySubject) ||
    !string(v.closureReason) ||
    !positiveInteger(v.version) ||
    !nullableUuid(v.processedRunId) ||
    !nullableDate(v.processedAt) ||
    !date(v.createdAt) ||
    !date(v.updatedAt)
  )
    throw invalidResponse();
  return {
    closureId: v.closureId,
    gestion: v.gestion,
    periodo: v.periodo,
    status: v.status,
    effectiveAt: v.effectiveAt,
    authorizedBySubject: v.authorizedBySubject,
    createdBySubject: v.createdBySubject,
    closureReason: v.closureReason,
    version: v.version,
    processedRunId: v.processedRunId,
    processedAt: v.processedAt,
    createdAt: v.createdAt,
    updatedAt: v.updatedAt,
  };
}

function parseClosureEvent(value: unknown): AcademicClosureEvent {
  const v = record(value);
  if (
    !positiveInteger(v.eventId) ||
    !positiveInteger(v.closureId) ||
    !nullableOneOf(v.fromStatus, CLOSURE_STATUSES) ||
    !oneOf(v.toStatus, CLOSURE_STATUSES) ||
    !string(v.actorSubject) ||
    !string(v.reason) ||
    !nullableUuid(v.runId) ||
    !date(v.occurredAt)
  )
    throw invalidResponse();
  return {
    eventId: v.eventId,
    closureId: v.closureId,
    fromStatus: v.fromStatus,
    toStatus: v.toStatus,
    actorSubject: v.actorSubject,
    reason: v.reason,
    runId: v.runId,
    occurredAt: v.occurredAt,
  };
}

function parseExecutionSummary(value: unknown): EtlExecutionSummary {
  const v = record(value);
  if (
    !isUuid(v.runId) ||
    !oneOf(v.executionKind, EXECUTION_KINDS) ||
    !oneOf(v.status, EXECUTION_STATUSES) ||
    !nullablePositiveInteger(v.closureId) ||
    !nullableIntegerBetween(v.requestedGestion, 2000, 32767) ||
    !nullableIntegerBetween(v.requestedPeriodo, 1, 32767) ||
    !string(v.requestedBy) ||
    !date(v.requestedAt) ||
    !nullableDate(v.startedAt) ||
    !nullableDate(v.endedAt)
  )
    throw invalidResponse();
  return {
    runId: v.runId,
    executionKind: v.executionKind,
    status: v.status,
    closureId: v.closureId,
    requestedGestion: v.requestedGestion,
    requestedPeriodo: v.requestedPeriodo,
    requestedBy: v.requestedBy,
    requestedAt: v.requestedAt,
    startedAt: v.startedAt,
    endedAt: v.endedAt,
  };
}

function parseExecutionDetail(value: unknown): EtlExecutionDetail {
  const v = record(value);
  const summary = parseExecutionSummary(v);
  if (
    !Array.isArray(v.steps) ||
    !Array.isArray(v.metrics) ||
    !Array.isArray(v.errors)
  )
    throw invalidResponse();
  const steps = v.steps.map((step): EtlExecutionStep => {
    const item = record(step);
    if (
      !string(item.stepCode) ||
      !oneOf(item.phase, [
        'EXTRACCION',
        'STAGING',
        'TRANSFORMACION',
        'VALIDACION',
        'PUBLICACION',
      ] as const) ||
      !oneOf(item.status, [
        'PENDIENTE',
        'EN_EJECUCION',
        'EXITOSO',
        'FALLIDO',
        'OMITIDO',
      ] as const) ||
      !nonNegativeInteger(item.stepOrder) ||
      !nullableDate(item.startedAt) ||
      !nullableDate(item.endedAt)
    )
      throw invalidResponse();
    return {
      stepCode: item.stepCode,
      phase: item.phase,
      status: item.status,
      stepOrder: item.stepOrder,
      startedAt: item.startedAt,
      endedAt: item.endedAt,
    };
  });
  const metrics = v.metrics.map((metric): EtlExecutionMetric => {
    const item = record(metric);
    if (
      !string(item.name) ||
      typeof item.value !== 'number' ||
      !Number.isFinite(item.value) ||
      !string(item.unit) ||
      !date(item.measuredAt)
    )
      throw invalidResponse();
    return {
      name: item.name,
      value: item.value,
      unit: item.unit,
      measuredAt: item.measuredAt,
      source: optionalIdentifier(item.source),
      stepCode: optionalIdentifier(item.stepCode),
    };
  });
  const errors = v.errors.map((error): SanitizedExecutionError => {
    const item = record(error);
    if (
      !oneOf(item.severity, ['INFO', 'WARN', 'ERROR', 'CRITICAL'] as const) ||
      !string(item.code) ||
      !/^[A-Z][A-Z0-9_.-]{0,99}$/.test(item.code) ||
      !isSafeExecutionMessage(item.message) ||
      !nullableString(item.stepCode) ||
      !date(item.occurredAt)
    )
      throw invalidResponse();
    return {
      severity: item.severity,
      code: item.code,
      message: item.message,
      stepCode: item.stepCode,
      occurredAt: item.occurredAt,
    };
  });
  return { ...summary, steps, metrics, errors };
}

function record(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    throw invalidResponse();
  return value as Record<string, unknown>;
}
function string(value: unknown): value is string {
  return typeof value === 'string';
}
/**
 * Identificador opcional: los servicios anteriores no envían el campo y un
 * valor con formato inesperado se descarta en lugar de mostrarse.
 */
function optionalIdentifier(value: unknown): string | null {
  return typeof value === 'string' && /^[A-Za-z][A-Za-z0-9_.-]{0,99}$/.test(value)
    ? value
    : null;
}

function nullableString(value: unknown): value is string | null {
  return value === null || string(value);
}
function nonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}
function positiveInteger(value: unknown): value is number {
  return integerBetween(value, 1, Number.MAX_SAFE_INTEGER);
}
function integerBetween(
  value: unknown,
  min: number,
  max: number,
): value is number {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= min &&
    value <= max
  );
}
function nullableIntegerBetween(
  value: unknown,
  min: number,
  max: number,
): value is number | null {
  return value === null || integerBetween(value, min, max);
}
function nullablePositiveInteger(value: unknown): value is number | null {
  return value === null || positiveInteger(value);
}
function oneOf<T extends string>(
  value: unknown,
  values: readonly T[],
): value is T {
  return typeof value === 'string' && values.includes(value as T);
}
function nullableOneOf<T extends string>(
  value: unknown,
  values: readonly T[],
): value is T | null {
  return value === null || oneOf(value, values);
}
function date(value: unknown): value is string {
  return string(value) && Number.isFinite(Date.parse(value));
}
function nullableDate(value: unknown): value is string | null {
  return value === null || date(value);
}
function isUuid(value: unknown): value is string {
  return (
    string(value) &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  );
}
function nullableUuid(value: unknown): value is string | null {
  return value === null || isUuid(value);
}
function validReason(value: unknown): value is string {
  return string(value) && value.trim().length > 0 && value.length <= 2000;
}
function isSafeExecutionMessage(value: unknown): value is string {
  return (
    string(value) &&
    value.length > 0 &&
    value.length <= 200 &&
    !/(password|passwd|secret|token|authorization|bearer|jdbc|sqlstate|exception|stack\s*trace|https?:\/\/)/i.test(
      value,
    )
  );
}
function validDateTime(value: unknown): value is string {
  return date(value) && /^\d{4}-\d{2}-\d{2}T/.test(value);
}
function validateClosureId(value: number): void {
  if (!positiveInteger(value)) throw invalidRequest('Invalid closure ID');
}
function validatePage(query: { page?: number; size?: number }): void {
  if (
    (query.page !== undefined && !nonNegativeInteger(query.page)) ||
    (query.size !== undefined && !integerBetween(query.size, 1, 100))
  )
    throw invalidRequest('Invalid pagination');
}
function invalidRequest(message: string): DwControlClientError {
  return new DwControlClientError(400, 'DW_CONTROL_INVALID_REQUEST', message);
}
function invalidResponse(): DwControlClientError {
  return new DwControlClientError(502, 'DW_CONTROL_INVALID_RESPONSE');
}

// ---------------------------------------------------------------------------
// Load Manager (LM-005 API, docs/dw/load-manager-service.md)
// ---------------------------------------------------------------------------

export type EtlProcessCode = 'VERTICAL_LOAD' | 'CATALOG_SYNC' | 'PUBLISH_STAGED';
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
export interface LaunchListQuery {
  processCode?: string;
  status?: EtlLaunchStatus;
  trigger?: EtlLaunchTrigger;
  scheduleId?: number;
  page?: number;
  size?: number;
}
/**
 * VERTICAL_LOAD: executionKind CIERRE_ACADEMICO with closureId, or REPROCESO with retryOfRunId.
 * PUBLISH_STAGED: runId. CATALOG_SYNC: nothing else.
 */
export interface LaunchEtlInput {
  processCode: string;
  executionKind?: 'CIERRE_ACADEMICO' | 'REPROCESO';
  closureId?: number;
  retryOfRunId?: string;
  runId?: string;
}
export interface CreateScheduleInput {
  processCode: string;
  name: string;
  cronExpression: string;
  timezone?: string;
  enabled?: boolean;
}
export interface UpdateScheduleInput {
  name: string;
  cronExpression: string;
  timezone?: string;
  rowVersion: number;
}

export const ETL_LAUNCH_STATUSES = [
  'QUEUED',
  'SUBMITTED',
  'RUNNING',
  'SUCCEEDED',
  'FAILED',
  'STOPPED',
  'SKIPPED',
  'SUBMIT_FAILED',
] as const;
export const ETL_LAUNCH_TRIGGERS = ['MANUAL', 'SCHEDULED'] as const;
const SCHEDULE_MODES = ['AUTO_PENDING_CLOSURES', 'NO_PARAMETERS'] as const;
const PROCESS_CODE = /^[A-Z][A-Z0-9_]{1,31}$/;
const PARAMETER_NAME = /^P_[A-Z0-9_]{1,60}$/;
const CRON = /^\S+( \S+){5}$/;
const TIMEZONE = /^[A-Za-z][A-Za-z0-9_+\-/]{0,63}$/;
const MAX_LOG_LENGTH = 70_000;

export function getLoadManagerHealth(
  config: DwControlServiceConfig,
  signal?: AbortSignal,
): Promise<LoadManagerHealth> {
  return requestJson(config, '/api/v1/etl/health', { method: 'GET' }, parseHealth, signal);
}

export function getEtlStatus(
  config: DwControlServiceConfig,
  signal?: AbortSignal,
): Promise<EtlStatus> {
  return requestJson(config, '/api/v1/etl/status', { method: 'GET' }, parseStatus, signal);
}

export function listEtlProcesses(
  config: DwControlServiceConfig,
  signal?: AbortSignal,
): Promise<EtlProcess[]> {
  return requestJson(
    config,
    '/api/v1/etl/processes',
    { method: 'GET' },
    (value) => array(value).map(parseProcess),
    signal,
  );
}

export function listEtlLaunches(
  config: DwControlServiceConfig,
  query: LaunchListQuery = {},
  signal?: AbortSignal,
): Promise<Page<EtlLaunch>> {
  validatePage(query);
  if (query.processCode !== undefined && !PROCESS_CODE.test(query.processCode))
    throw invalidRequest('Invalid process filter');
  if (query.status !== undefined && !oneOf(query.status, ETL_LAUNCH_STATUSES))
    throw invalidRequest('Invalid launch status filter');
  if (query.trigger !== undefined && !oneOf(query.trigger, ETL_LAUNCH_TRIGGERS))
    throw invalidRequest('Invalid launch trigger filter');
  if (query.scheduleId !== undefined && !positiveInteger(query.scheduleId))
    throw invalidRequest('Invalid schedule filter');
  return getPage(config, '/api/v1/etl/launches', query, parseLaunch, signal);
}

export function getEtlLaunch(
  config: DwControlServiceConfig,
  launchId: string,
  signal?: AbortSignal,
): Promise<EtlLaunch> {
  if (!isUuid(launchId)) throw invalidRequest('Invalid launch ID');
  return requestJson(
    config,
    `/api/v1/etl/launches/${encodeURIComponent(launchId)}`,
    { method: 'GET' },
    parseLaunch,
    signal,
  );
}

export function getEtlLaunchLogs(
  config: DwControlServiceConfig,
  launchId: string,
  signal?: AbortSignal,
): Promise<EtlLaunchLog> {
  if (!isUuid(launchId)) throw invalidRequest('Invalid launch ID');
  return requestJson(
    config,
    `/api/v1/etl/launches/${encodeURIComponent(launchId)}/logs`,
    { method: 'GET' },
    parseLaunchLog,
    signal,
  );
}

export function launchEtlProcess(
  config: DwControlServiceConfig,
  input: LaunchEtlInput,
  signal?: AbortSignal,
): Promise<EtlLaunch> {
  if (
    !PROCESS_CODE.test(input.processCode) ||
    (input.executionKind !== undefined &&
      !oneOf(input.executionKind, ['CIERRE_ACADEMICO', 'REPROCESO'] as const)) ||
    (input.closureId !== undefined && !positiveInteger(input.closureId)) ||
    (input.retryOfRunId !== undefined && !isUuid(input.retryOfRunId)) ||
    (input.runId !== undefined && !isUuid(input.runId))
  )
    throw invalidRequest('Invalid launch request');
  return postJson(
    config,
    '/api/v1/etl/launches',
    {
      processCode: input.processCode,
      ...(input.executionKind === undefined ? {} : { executionKind: input.executionKind }),
      ...(input.closureId === undefined ? {} : { closureId: input.closureId }),
      ...(input.retryOfRunId === undefined ? {} : { retryOfRunId: input.retryOfRunId }),
      ...(input.runId === undefined ? {} : { runId: input.runId }),
    },
    parseLaunch,
    signal,
  );
}

export function stopEtlLaunch(
  config: DwControlServiceConfig,
  launchId: string,
  signal?: AbortSignal,
): Promise<EtlLaunch> {
  if (!isUuid(launchId)) throw invalidRequest('Invalid launch ID');
  return requestJson(
    config,
    `/api/v1/etl/launches/${encodeURIComponent(launchId)}/stop`,
    { method: 'POST' },
    parseLaunch,
    signal,
  );
}

export function listEtlSchedules(
  config: DwControlServiceConfig,
  signal?: AbortSignal,
): Promise<EtlSchedule[]> {
  return requestJson(
    config,
    '/api/v1/etl/schedules',
    { method: 'GET' },
    (value) => array(value).map(parseSchedule),
    signal,
  );
}

export function getEtlSchedule(
  config: DwControlServiceConfig,
  scheduleId: number,
  signal?: AbortSignal,
): Promise<EtlSchedule> {
  validateScheduleId(scheduleId);
  return requestJson(
    config,
    `/api/v1/etl/schedules/${scheduleId}`,
    { method: 'GET' },
    parseSchedule,
    signal,
  );
}

export function previewEtlSchedule(
  config: DwControlServiceConfig,
  query: { cronExpression: string; timezone?: string; count?: number },
  signal?: AbortSignal,
): Promise<SchedulePreview> {
  if (
    !validCron(query.cronExpression) ||
    (query.timezone !== undefined && !TIMEZONE.test(query.timezone)) ||
    (query.count !== undefined && !integerBetween(query.count, 1, 50))
  )
    throw invalidRequest('Invalid schedule preview request');
  const params = new URLSearchParams({ cronExpression: query.cronExpression.trim() });
  if (query.timezone !== undefined) params.set('timezone', query.timezone);
  if (query.count !== undefined) params.set('count', String(query.count));
  return requestJson(
    config,
    `/api/v1/etl/schedules/preview?${params}`,
    { method: 'GET' },
    parsePreview,
    signal,
  );
}

export function createEtlSchedule(
  config: DwControlServiceConfig,
  input: CreateScheduleInput,
  signal?: AbortSignal,
): Promise<EtlSchedule> {
  if (
    !PROCESS_CODE.test(input.processCode) ||
    !validScheduleName(input.name) ||
    !validCron(input.cronExpression) ||
    (input.timezone !== undefined && !TIMEZONE.test(input.timezone)) ||
    (input.enabled !== undefined && typeof input.enabled !== 'boolean')
  )
    throw invalidRequest('Invalid schedule request');
  return postJson(
    config,
    '/api/v1/etl/schedules',
    {
      processCode: input.processCode,
      name: input.name.trim(),
      cronExpression: input.cronExpression.trim(),
      ...(input.timezone === undefined ? {} : { timezone: input.timezone }),
      ...(input.enabled === undefined ? {} : { enabled: input.enabled }),
    },
    parseSchedule,
    signal,
  );
}

export function updateEtlSchedule(
  config: DwControlServiceConfig,
  scheduleId: number,
  input: UpdateScheduleInput,
  signal?: AbortSignal,
): Promise<EtlSchedule> {
  validateScheduleId(scheduleId);
  if (
    !validScheduleName(input.name) ||
    !validCron(input.cronExpression) ||
    (input.timezone !== undefined && !TIMEZONE.test(input.timezone)) ||
    !positiveInteger(input.rowVersion)
  )
    throw invalidRequest('Invalid schedule request');
  return requestJson(
    config,
    `/api/v1/etl/schedules/${scheduleId}`,
    {
      method: 'PUT',
      body: JSON.stringify({
        name: input.name.trim(),
        cronExpression: input.cronExpression.trim(),
        ...(input.timezone === undefined ? {} : { timezone: input.timezone }),
        rowVersion: input.rowVersion,
      }),
    },
    parseSchedule,
    signal,
  );
}

export function setEtlScheduleEnabled(
  config: DwControlServiceConfig,
  scheduleId: number,
  enabled: boolean,
  rowVersion: number,
  signal?: AbortSignal,
): Promise<EtlSchedule> {
  validateScheduleId(scheduleId);
  if (typeof enabled !== 'boolean' || !positiveInteger(rowVersion))
    throw invalidRequest('Invalid schedule request');
  return postJson(
    config,
    `/api/v1/etl/schedules/${scheduleId}/${enabled ? 'enable' : 'disable'}`,
    { rowVersion },
    parseSchedule,
    signal,
  );
}

export function deleteEtlSchedule(
  config: DwControlServiceConfig,
  scheduleId: number,
  rowVersion: number,
  signal?: AbortSignal,
): Promise<null> {
  validateScheduleId(scheduleId);
  if (!positiveInteger(rowVersion)) throw invalidRequest('Invalid schedule request');
  return requestJson(
    config,
    `/api/v1/etl/schedules/${scheduleId}?rowVersion=${rowVersion}`,
    { method: 'DELETE' },
    () => null,
    signal,
  );
}

function parseHealth(value: unknown): LoadManagerHealth {
  const v = record(value);
  if (
    typeof v.hopOnline !== 'boolean' ||
    !nullableBoundedString(v.hopStatus, 200) ||
    typeof v.monitoringEnabled !== 'boolean' ||
    typeof v.schedulerEnabled !== 'boolean' ||
    !boundedString(v.operatingWindow, 300) ||
    !date(v.checkedAt)
  )
    throw invalidResponse();
  return {
    hopOnline: v.hopOnline,
    hopStatus: v.hopStatus,
    monitoringEnabled: v.monitoringEnabled,
    schedulerEnabled: v.schedulerEnabled,
    operatingWindow: v.operatingWindow,
    checkedAt: v.checkedAt,
  };
}

function parseStatus(value: unknown): EtlStatus {
  const v = record(value);
  if (typeof v.running !== 'boolean') throw invalidResponse();
  return { running: v.running, active: array(v.active).map(parseLaunch) };
}

function parseProcess(value: unknown): EtlProcess {
  const v = record(value);
  if (
    !string(v.code) ||
    !PROCESS_CODE.test(v.code) ||
    !boundedString(v.displayName, 120) ||
    !boundedString(v.description, 2000) ||
    !boundedString(v.workflowFile, 255) ||
    !Array.isArray(v.parameterNames) ||
    !v.parameterNames.every((name) => string(name) && PARAMETER_NAME.test(name)) ||
    typeof v.schedulable !== 'boolean' ||
    !nullableOneOf(v.scheduleMode, SCHEDULE_MODES) ||
    typeof v.enabled !== 'boolean'
  )
    throw invalidResponse();
  return {
    code: v.code,
    displayName: v.displayName,
    description: v.description,
    workflowFile: v.workflowFile,
    parameterNames: v.parameterNames as string[],
    schedulable: v.schedulable,
    scheduleMode: v.scheduleMode,
    enabled: v.enabled,
  };
}

function parseLaunch(value: unknown): EtlLaunch {
  const v = record(value);
  if (
    !isUuid(v.id) ||
    !string(v.processCode) ||
    !PROCESS_CODE.test(v.processCode) ||
    !oneOf(v.trigger, ETL_LAUNCH_TRIGGERS) ||
    !nullablePositiveInteger(v.scheduleId) ||
    !nullablePositiveInteger(v.closureId) ||
    !nullableUuid(v.runId) ||
    !oneOf(v.status, ETL_LAUNCH_STATUSES) ||
    typeof v.active !== 'boolean' ||
    !nullableUuid(v.hopExecutionId) ||
    !boundedString(v.requestedBy, 255) ||
    !date(v.requestedAt) ||
    !nullableDate(v.submittedAt) ||
    !nullableDate(v.startedAt) ||
    !nullableDate(v.finishedAt) ||
    !nullableBoundedString(v.stopRequestedBy, 255) ||
    !nullableDate(v.stopRequestedAt) ||
    !nullableBoundedString(v.resultSummary, 2000) ||
    !positiveInteger(v.rowVersion)
  )
    throw invalidResponse();
  return {
    id: v.id,
    processCode: v.processCode,
    trigger: v.trigger,
    scheduleId: v.scheduleId,
    closureId: v.closureId,
    runId: v.runId,
    parameters: parseParameters(v.parameters),
    status: v.status,
    active: v.active,
    hopExecutionId: v.hopExecutionId,
    requestedBy: v.requestedBy,
    requestedAt: v.requestedAt,
    submittedAt: v.submittedAt,
    startedAt: v.startedAt,
    finishedAt: v.finishedAt,
    stopRequestedBy: v.stopRequestedBy,
    stopRequestedAt: v.stopRequestedAt,
    resultSummary: v.resultSummary,
    rowVersion: v.rowVersion,
  };
}

function parseParameters(value: unknown): Record<string, string> {
  const v = record(value);
  const parameters: Record<string, string> = {};
  for (const [name, parameter] of Object.entries(v)) {
    if (!PARAMETER_NAME.test(name) || !boundedString(parameter, 255)) throw invalidResponse();
    parameters[name] = parameter;
  }
  return parameters;
}

function parseLaunchLog(value: unknown): EtlLaunchLog {
  const v = record(value);
  if (
    !isUuid(v.launchId) ||
    !oneOf(v.status, ETL_LAUNCH_STATUSES) ||
    typeof v.active !== 'boolean' ||
    !string(v.log) ||
    v.log.length > MAX_LOG_LENGTH
  )
    throw invalidResponse();
  return { launchId: v.launchId, status: v.status, active: v.active, log: v.log };
}

function parseSchedule(value: unknown): EtlSchedule {
  const v = record(value);
  if (
    !positiveInteger(v.id) ||
    !string(v.processCode) ||
    !PROCESS_CODE.test(v.processCode) ||
    !boundedString(v.name, 120) ||
    !boundedString(v.cronExpression, 120) ||
    !boundedString(v.timezone, 64) ||
    !oneOf(v.mode, SCHEDULE_MODES) ||
    typeof v.enabled !== 'boolean' ||
    !nullableDate(v.nextFireAt) ||
    !nullableDate(v.lastFiredAt) ||
    !nullableUuid(v.lastLaunchId) ||
    typeof v.firing !== 'boolean' ||
    !boundedString(v.createdBy, 255) ||
    !date(v.createdAt) ||
    !boundedString(v.updatedBy, 255) ||
    !date(v.updatedAt) ||
    !positiveInteger(v.rowVersion)
  )
    throw invalidResponse();
  return {
    id: v.id,
    processCode: v.processCode,
    name: v.name,
    cronExpression: v.cronExpression,
    timezone: v.timezone,
    mode: v.mode,
    enabled: v.enabled,
    nextFireAt: v.nextFireAt,
    lastFiredAt: v.lastFiredAt,
    lastLaunchId: v.lastLaunchId,
    firing: v.firing,
    createdBy: v.createdBy,
    createdAt: v.createdAt,
    updatedBy: v.updatedBy,
    updatedAt: v.updatedAt,
    rowVersion: v.rowVersion,
  };
}

function parsePreview(value: unknown): SchedulePreview {
  const v = record(value);
  if (
    !boundedString(v.cronExpression, 120) ||
    !boundedString(v.timezone, 64) ||
    !boundedString(v.operatingWindow, 300) ||
    typeof v.valid !== 'boolean' ||
    !(v.validationMessage === null || isSafeUpstreamDetail(v.validationMessage))
  )
    throw invalidResponse();
  const occurrences = array(v.occurrences).map((occurrence) => {
    const item = record(occurrence);
    if (!date(item.at) || typeof item.insideOperatingWindow !== 'boolean')
      throw invalidResponse();
    return { at: item.at, insideOperatingWindow: item.insideOperatingWindow };
  });
  return {
    cronExpression: v.cronExpression,
    timezone: v.timezone,
    operatingWindow: v.operatingWindow,
    valid: v.valid,
    validationMessage: v.validationMessage,
    occurrences,
  };
}

function array(value: unknown): unknown[] {
  if (!Array.isArray(value)) throw invalidResponse();
  return value;
}
function boundedString(value: unknown, max: number): value is string {
  return string(value) && value.length <= max;
}
function nullableBoundedString(value: unknown, max: number): value is string | null {
  return value === null || boundedString(value, max);
}
function validCron(value: unknown): value is string {
  return string(value) && value.trim().length <= 120 && CRON.test(value.trim());
}
function validScheduleName(value: unknown): value is string {
  return string(value) && value.trim().length > 0 && value.trim().length <= 120;
}
function validateScheduleId(value: number): void {
  if (!positiveInteger(value)) throw invalidRequest('Invalid schedule ID');
}
