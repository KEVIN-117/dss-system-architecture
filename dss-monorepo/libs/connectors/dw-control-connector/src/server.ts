/** Server-only client for dw-control-service. Never expose bearer tokens to browser code. */

export type DwControlPermission =
  | 'DW_CLOSURE_READ'
  | 'DW_CLOSURE_MANAGE'
  | 'DW_ETL_MONITOR_READ';

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
    if (!response.ok) throw upstreamError(response.status);
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

function upstreamError(status: number): DwControlClientError {
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
