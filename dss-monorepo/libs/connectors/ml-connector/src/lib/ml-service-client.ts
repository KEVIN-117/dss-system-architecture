import type {
  MlProblem,
  PredictionRequest,
  PredictionResponse,
  TrainingJob,
  TrainingJobRequest,
} from '../models/prediction.js';

const CONTRACT_VERSION = '1.0';
const DEFAULT_TIMEOUT_MS = 15_000;

export interface MlRequestOptions {
  signal?: AbortSignal;
  requestId?: string;
  timeoutMs?: number;
  fetcher?: typeof fetch;
}

export class MlServiceClientError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly problem?: MlProblem,
  ) {
    super(message);
    this.name = 'MlServiceClientError';
  }
}

export class MlServiceTimeoutError extends Error {
  constructor() {
    super('Prediction service request timed out');
    this.name = 'MlServiceTimeoutError';
  }
}

export function isPredictionRequest(
  value: unknown,
): value is PredictionRequest {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, [
      'contract_version',
      'subject_ref',
      'program_ref',
      'academic_cut',
    ])
  ) {
    return false;
  }
  return (
    value.contract_version === CONTRACT_VERSION &&
    isBoundedString(value.subject_ref, 1, 128) &&
    isBoundedString(value.program_ref, 1, 64) &&
    isRecord(value.academic_cut) &&
    hasOnlyKeys(value.academic_cut, ['cut_id']) &&
    isBoundedString(value.academic_cut.cut_id, 1, 128)
  );
}

export function isTrainingJobRequest(
  value: unknown,
): value is TrainingJobRequest {
  return (
    isRecord(value) &&
    hasOnlyKeys(value, ['dataset_ref', 'algorithm', 'configuration_ref']) &&
    isBoundedString(value.dataset_ref, 1, 256) &&
    (value.algorithm === 'random_forest' || value.algorithm === 'xgboost') &&
    (value.configuration_ref === undefined ||
      isBoundedString(value.configuration_ref, 1, 128))
  );
}

export async function predict(
  serviceUrl: string,
  accessToken: string,
  input: PredictionRequest,
  options: MlRequestOptions = {},
): Promise<PredictionResponse> {
  assertPredictionRequest(input);
  const response = await requestJson(
    serviceUrl,
    '/v1/predictions',
    accessToken,
    { method: 'POST', body: JSON.stringify(input) },
    options,
  );
  if (!isPredictionResponse(response)) {
    throw new MlServiceClientError(
      'Prediction service returned an invalid prediction response',
      502,
    );
  }
  return response;
}

export async function submitTrainingJob(
  serviceUrl: string,
  accessToken: string,
  input: TrainingJobRequest,
  idempotencyKey: string,
  options: MlRequestOptions = {},
): Promise<TrainingJob> {
  assertTrainingJobRequest(input);
  if (!isBoundedString(idempotencyKey, 16, 128)) {
    throw new TypeError(
      'Idempotency-Key must contain between 16 and 128 characters',
    );
  }
  const response = await requestJson(
    serviceUrl,
    '/v1/training-jobs',
    accessToken,
    { method: 'POST', body: JSON.stringify(input), idempotencyKey },
    options,
  );
  if (!isTrainingJob(response)) {
    throw new MlServiceClientError(
      'Prediction service returned an invalid training job',
      502,
    );
  }
  return response;
}

export async function getTrainingJob(
  serviceUrl: string,
  accessToken: string,
  jobId: string,
  options: MlRequestOptions = {},
): Promise<TrainingJob> {
  if (!isUuid(jobId)) throw new TypeError('jobId must be a UUID');
  const response = await requestJson(
    serviceUrl,
    `/v1/training-jobs/${encodeURIComponent(jobId)}`,
    accessToken,
    { method: 'GET' },
    options,
  );
  if (!isTrainingJob(response)) {
    throw new MlServiceClientError(
      'Prediction service returned an invalid training job',
      502,
    );
  }
  return response;
}

async function requestJson(
  serviceUrl: string,
  path: string,
  accessToken: string,
  request: { method: 'GET' | 'POST'; body?: string; idempotencyKey?: string },
  options: MlRequestOptions,
): Promise<unknown> {
  const baseUrl = parseServiceUrl(serviceUrl);
  if (!accessToken.trim())
    throw new TypeError('A verified access token is required');
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 120_000) {
    throw new TypeError('timeoutMs must be an integer between 1 and 120000');
  }

  const timeoutController = new AbortController();
  const timer = setTimeout(() => timeoutController.abort(), timeoutMs);
  const signal = options.signal
    ? AbortSignal.any([options.signal, timeoutController.signal])
    : timeoutController.signal;
  const headers = new Headers({
    Accept: 'application/json',
    Authorization: `Bearer ${accessToken}`,
  });
  if (request.body !== undefined)
    headers.set('Content-Type', 'application/json');
  if (request.idempotencyKey)
    headers.set('Idempotency-Key', request.idempotencyKey);
  if (options.requestId && isBoundedString(options.requestId, 1, 128)) {
    headers.set('X-Request-ID', options.requestId);
  }

  try {
    const response = await (options.fetcher ?? fetch)(
      new URL(`${baseUrl}${path}`),
      {
        method: request.method,
        headers,
        body: request.body,
        signal,
        cache: 'no-store',
        redirect: 'manual',
      },
    );
    if (!response.ok) {
      const errorBody: unknown = await response.json().catch(() => undefined);
      const problem = isMlProblem(errorBody) ? errorBody : undefined;
      throw new MlServiceClientError(
        problem?.title ?? `Prediction service returned HTTP ${response.status}`,
        response.status,
        problem,
      );
    }
    return await readJson(response);
  } catch (error) {
    if (error instanceof MlServiceClientError) throw error;
    if (timeoutController.signal.aborted && !options.signal?.aborted) {
      throw new MlServiceTimeoutError();
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    throw new MlServiceClientError(
      'Prediction service returned malformed JSON',
      502,
    );
  }
}

function parseServiceUrl(value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new TypeError(
      'Prediction service URL must be an absolute HTTP(S) URL',
    );
  }
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  ) {
    throw new TypeError(
      'Prediction service URL must be an HTTP(S) origin/base path without credentials or query',
    );
  }
  return url.toString().replace(/\/$/, '');
}

function assertPredictionRequest(value: PredictionRequest): void {
  if (!isPredictionRequest(value))
    throw new TypeError('Invalid PredictionRequest for contract v1');
}

function assertTrainingJobRequest(value: TrainingJobRequest): void {
  if (!isTrainingJobRequest(value))
    throw new TypeError('Invalid TrainingJobRequest for contract v1');
}

function isPredictionResponse(value: unknown): value is PredictionResponse {
  return (
    isRecord(value) &&
    hasOnlyKeys(value, [
      'contract_version',
      'prediction_id',
      'subject_ref',
      'program_ref',
      'event_type',
      'course_ref',
      'event_code',
      'predicted_class',
      'event_probability',
      'model',
      'academic_cut',
      'generated_at',
    ]) &&
    value.contract_version === CONTRACT_VERSION &&
    isUuid(value.prediction_id) &&
    isBoundedString(value.subject_ref, 1, 128) &&
    isBoundedString(value.program_ref, 1, 64) &&
    (value.event_type === 'course_abandonment' ||
      value.event_type === 'program_dropout') &&
    (value.course_ref === undefined ||
      value.course_ref === null ||
      isBoundedString(value.course_ref, 1, 128)) &&
    isBoundedString(value.event_code, 1, 128) &&
    (value.predicted_class === 'POSITIVE_EVENT' ||
      value.predicted_class === 'NEGATIVE_EVENT') &&
    (value.event_probability === undefined ||
      value.event_probability === null ||
      (typeof value.event_probability === 'number' &&
        value.event_probability >= 0 &&
        value.event_probability <= 1)) &&
    isRecord(value.model) &&
    isBoundedString(value.model.model_id, 1, 128) &&
    isBoundedString(value.model.version, 1, 128) &&
    isAcademicCutRef(value.academic_cut) &&
    isIsoDate(value.generated_at)
  );
}

function isTrainingJob(value: unknown): value is TrainingJob {
  return (
    isRecord(value) &&
    hasOnlyKeys(value, [
      'job_id',
      'contract_version',
      'dataset_ref',
      'algorithm',
      'status',
      'progress',
      'created_at',
      'started_at',
      'finished_at',
      'submitted_by',
      'model_candidate',
      'error',
    ]) &&
    isUuid(value.job_id) &&
    value.contract_version === CONTRACT_VERSION &&
    isBoundedString(value.dataset_ref, 1, 256) &&
    (value.algorithm === 'random_forest' || value.algorithm === 'xgboost') &&
    ['QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELLED'].includes(
      String(value.status),
    ) &&
    (value.progress === undefined ||
      value.progress === null ||
      (Number.isInteger(value.progress) &&
        Number(value.progress) >= 0 &&
        Number(value.progress) <= 100)) &&
    isIsoDate(value.created_at) &&
    isBoundedString(value.submitted_by, 1, 256) &&
    (value.started_at === undefined ||
      value.started_at === null ||
      isIsoDate(value.started_at)) &&
    (value.finished_at === undefined ||
      value.finished_at === null ||
      isIsoDate(value.finished_at)) &&
    (value.model_candidate === undefined ||
      value.model_candidate === null ||
      isModelReference(value.model_candidate)) &&
    (value.error === undefined ||
      value.error === null ||
      isMlProblem(value.error))
  );
}

function isMlProblem(value: unknown): value is MlProblem {
  return (
    isRecord(value) &&
    isBoundedString(value.type, 1, 512) &&
    hasOnlyKeys(value, [
      'type',
      'title',
      'status',
      'detail',
      'code',
      'request_id',
    ]) &&
    isBoundedString(value.title, 1, 160) &&
    Number.isInteger(value.status) &&
    (!('detail' in value) || isBoundedString(value.detail, 0, 500)) &&
    [
      'INVALID_REQUEST',
      'INVALID_TOKEN',
      'INSUFFICIENT_SCOPE',
      'RESOURCE_NOT_FOUND',
      'INCOMPATIBLE_SCHEMA',
      'INELIGIBLE_PROFILE',
      'DATA_UNAVAILABLE',
      'NO_ACTIVE_MODEL',
      'JOB_CAPACITY',
      'JOB_FAILED',
      'CONFLICT',
      'TIMEOUT',
      'INTERNAL_ERROR',
    ].includes(String(value.code)) &&
    isBoundedString(value.request_id, 1, 128)
  );
}

function isModelReference(value: unknown): boolean {
  return (
    isRecord(value) &&
    hasOnlyKeys(value, ['model_id', 'version']) &&
    isBoundedString(value.model_id, 1, 128) &&
    isBoundedString(value.version, 1, 128)
  );
}

function isAcademicCutRef(value: unknown): boolean {
  return isRecord(value) && isBoundedString(value.cut_id, 1, 128);
}

function isIsoDate(value: unknown): value is string {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value));
}

function isUuid(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isBoundedString(
  value: unknown,
  min: number,
  max: number,
): value is string {
  return (
    typeof value === 'string' &&
    value.trim().length >= min &&
    value.length <= max
  );
}

function hasOnlyKeys(
  value: Record<string, unknown>,
  allowed: string[],
): boolean {
  return Object.keys(value).every((key) => allowed.includes(key));
}
