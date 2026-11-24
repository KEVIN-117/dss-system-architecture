/**
 * Typed ML Studio operations of prediction-service (PRED-106).
 *
 * Every function validates its inputs before calling the service and checks the
 * response shape it relies on; prediction-service re-validates everything and
 * enforces `prediction:train` / `prediction:forecast:read` itself.
 */
import {
  isBoundedString,
  isRecord,
  isSearchSpace,
  isTrainingJob,
  isUuid,
  MlRequestValidationError,
  MlServiceClientError,
  requestJson,
  type MlRequestOptions,
} from './ml-service-client.js';
import {
  FORECAST_SERIES,
  type DatasetExtractionRequest,
  type DatasetProfile,
  type DatasetSample,
  type DatasetSummary,
  type ForecastJobRequest,
  type ForecastQuery,
  type ForecastRun,
  type MlJobListQuery,
  type MlTask,
  type ModelComparison,
  type ModelHistory,
  type ModelRollbackRequest,
  type TrainingStudy,
  type TrainingStudyRequest,
} from '../models/ml-admin.js';
import type { TrainingJob } from '../models/prediction.js';

const JOB_KINDS = ['TRAIN', 'EXTRACT_DATASET', 'FORECAST'];
const JOB_STATUSES = ['QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELLED'];
const CADENCES = ['ANUAL', 'SEMESTRAL'];
const TASK_CODE = /^[A-Z][A-Z0-9_]{1,63}$/;
const MODEL_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const DATASET_REF = /^(custom:)?[A-Za-z0-9][A-Za-z0-9._-]{0,127}$|^fixture:[A-Za-z0-9._-]{1,128}$/;
const PROGRAM_REF = /^[A-Za-z0-9._-]{1,16}$/;
const ALGORITHMS = ['ridge', 'random_forest', 'xgboost'];

function invalid(message: string): never {
  throw new MlRequestValidationError(message);
}

function idempotency(key: string): string {
  if (!isBoundedString(key, 16, 128)) invalid('Idempotency-Key must contain between 16 and 128 characters');
  return key;
}

function badResponse(what: string): never {
  throw new MlServiceClientError(`Prediction service returned an invalid ${what}`, 502);
}

function queryString(values: Record<string, string | number | undefined>): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined && value !== '') query.set(key, String(value));
  }
  const text = query.toString();
  return text ? `?${text}` : '';
}

function programList(programs: unknown, max = 200): string[] | undefined {
  if (programs === undefined) return undefined;
  if (!Array.isArray(programs) || programs.length > max || !programs.every((p) => typeof p === 'string' && PROGRAM_REF.test(p))) {
    invalid(`programs must be up to ${max} program identifiers`);
  }
  return programs as string[];
}

function asJob(value: unknown): TrainingJob {
  if (!isTrainingJob(value)) badResponse('job');
  return value;
}

/** GET /v1/ml-tasks: prediction targets and forecast series of the catalog. */
export async function listMlTasks(serviceUrl: string, accessToken: string, options: MlRequestOptions = {}): Promise<MlTask[]> {
  const response = await requestJson(serviceUrl, '/v1/ml-tasks', accessToken, { method: 'GET' }, options);
  if (!Array.isArray(response) || !response.every((item) => isRecord(item) && typeof item.code === 'string')) badResponse('task catalog');
  return response as MlTask[];
}

/** GET /v1/jobs: jobs of every operator, newest first. */
export async function listMlJobs(serviceUrl: string, accessToken: string, query: MlJobListQuery = {},
  options: MlRequestOptions = {}): Promise<TrainingJob[]> {
  if (query.kind !== undefined && !JOB_KINDS.includes(query.kind)) invalid('Unknown job kind');
  if (query.status !== undefined && !JOB_STATUSES.includes(query.status)) invalid('Unknown job status');
  if (query.studyId !== undefined && !/^[0-9a-f]{32}$/.test(query.studyId)) invalid('studyId must be 32 hex characters');
  if (query.limit !== undefined && (!Number.isInteger(query.limit) || query.limit < 1 || query.limit > 200)) invalid('limit must be between 1 and 200');
  const path = `/v1/jobs${queryString({ kind: query.kind, status: query.status, study_id: query.studyId, limit: query.limit })}`;
  const response = await requestJson(serviceUrl, path, accessToken, { method: 'GET' }, options);
  if (!Array.isArray(response)) badResponse('job list');
  return response.map(asJob);
}

/** GET /v1/jobs/{id}: any job kind. */
export async function getMlJob(serviceUrl: string, accessToken: string, jobId: string, options: MlRequestOptions = {}): Promise<TrainingJob> {
  if (!isUuid(jobId)) invalid('jobId must be a UUID');
  return asJob(await requestJson(serviceUrl, `/v1/jobs/${encodeURIComponent(jobId)}`, accessToken, { method: 'GET' }, options));
}

/** POST /v1/jobs/{id}/cancel: queued or running jobs (running ones discard partial output). */
export async function cancelMlJob(serviceUrl: string, accessToken: string, jobId: string, options: MlRequestOptions = {}): Promise<TrainingJob> {
  if (!isUuid(jobId)) invalid('jobId must be a UUID');
  return asJob(await requestJson(serviceUrl, `/v1/jobs/${encodeURIComponent(jobId)}/cancel`, accessToken, { method: 'POST' }, options));
}

/** POST /v1/dataset-extractions: extract a prepared dataset from the DW (PRED-102). */
export async function submitDatasetExtraction(serviceUrl: string, accessToken: string, input: DatasetExtractionRequest,
  idempotencyKey: string, options: MlRequestOptions = {}): Promise<TrainingJob> {
  if (!isRecord(input) || !TASK_CODE.test(String(input.task_code)) || !CADENCES.includes(String(input.cadence))) {
    invalid('Invalid dataset extraction request');
  }
  const body: DatasetExtractionRequest = { task_code: input.task_code, cadence: input.cadence };
  const programs = programList(input.programs);
  if (programs) body.programs = programs;
  if (input.horizon_years !== undefined) {
    if (!Number.isInteger(input.horizon_years) || input.horizon_years < 1 || input.horizon_years > 10) invalid('horizon_years must be between 1 and 10');
    body.horizon_years = input.horizon_years;
  }
  if (input.features !== undefined) {
    if (!Array.isArray(input.features) || input.features.length > 64 || !input.features.every((f) => typeof f === 'string' && /^[a-z_]{1,64}$/.test(f))) {
      invalid('features must be up to 64 feature names');
    }
    body.features = input.features;
  }
  return asJob(await requestJson(serviceUrl, '/v1/dataset-extractions', accessToken,
    { method: 'POST', body: JSON.stringify(body), idempotencyKey: idempotency(idempotencyKey) }, options));
}

/** GET /v1/datasets: fixtures, uploaded and extracted datasets. */
export async function listMlDatasets(serviceUrl: string, accessToken: string, options: MlRequestOptions = {}): Promise<DatasetSummary[]> {
  const response = await requestJson(serviceUrl, '/v1/datasets', accessToken, { method: 'GET' }, options);
  if (!Array.isArray(response) || !response.every((item) => isRecord(item) && typeof item.dataset_ref === 'string')) badResponse('dataset list');
  return response as DatasetSummary[];
}

function datasetPath(datasetRef: string, suffix: string): string {
  if (!DATASET_REF.test(datasetRef)) invalid('Invalid dataset reference');
  return `/v1/datasets/${encodeURIComponent(datasetRef)}/${suffix}`;
}

/** GET /v1/datasets/{ref}/profile: exploratory profile (aggregates only). */
export async function getDatasetProfile(serviceUrl: string, accessToken: string, datasetRef: string,
  options: MlRequestOptions = {}): Promise<DatasetProfile> {
  const response = await requestJson(serviceUrl, datasetPath(datasetRef, 'profile'), accessToken, { method: 'GET' }, options);
  if (!isRecord(response) || typeof response.row_count !== 'number' || !Array.isArray(response.features)) badResponse('dataset profile');
  return response as unknown as DatasetProfile;
}

/** GET /v1/datasets/{ref}/sample: first rows, pseudonymised, declared fields only. */
export async function getDatasetSample(serviceUrl: string, accessToken: string, datasetRef: string, limit = 50,
  options: MlRequestOptions = {}): Promise<DatasetSample> {
  if (!Number.isInteger(limit) || limit < 1 || limit > 200) invalid('limit must be between 1 and 200');
  const response = await requestJson(serviceUrl, `${datasetPath(datasetRef, 'sample')}${queryString({ limit })}`,
    accessToken, { method: 'GET' }, options);
  if (!isRecord(response) || !Array.isArray(response.columns) || !Array.isArray(response.rows)) badResponse('dataset sample');
  return response as unknown as DatasetSample;
}

/** POST /v1/training-studies: one TRAIN job per algorithm, grouped by study_id. */
export async function submitTrainingStudy(serviceUrl: string, accessToken: string, input: TrainingStudyRequest,
  idempotencyKey: string, options: MlRequestOptions = {}): Promise<TrainingStudy> {
  if (!isRecord(input) || !DATASET_REF.test(String(input.dataset_ref)) || !Array.isArray(input.algorithms) ||
      input.algorithms.length < 1 || input.algorithms.length > 3 || !input.algorithms.every((a) => ALGORITHMS.includes(a)) ||
      new Set(input.algorithms).size !== input.algorithms.length) {
    invalid('Invalid training study request');
  }
  if (input.configuration_ref !== undefined && !isBoundedString(input.configuration_ref, 1, 128)) invalid('Invalid configuration_ref');
  if (input.search_spaces !== undefined && (!isRecord(input.search_spaces) ||
      !Object.entries(input.search_spaces).every(([algorithm, space]) => input.algorithms.includes(algorithm) && isSearchSpace(space)))) {
    invalid('search_spaces must map requested algorithms to small parameter grids');
  }
  if (!isBoundedString(idempotencyKey, 16, 96)) invalid('Idempotency-Key must contain between 16 and 96 characters');
  const response = await requestJson(serviceUrl, '/v1/training-studies', accessToken,
    { method: 'POST', body: JSON.stringify(input), idempotencyKey }, options);
  if (!isRecord(response) || typeof response.study_id !== 'string' || !Array.isArray(response.jobs)) badResponse('training study');
  return { ...(response as unknown as TrainingStudy), jobs: response.jobs.map(asJob) };
}

/** GET /v1/models/compare: 2-6 candidates trained on the same partition (PRED-105). */
export async function compareModels(serviceUrl: string, accessToken: string, modelIds: string[],
  options: MlRequestOptions = {}): Promise<ModelComparison> {
  const ids = [...new Set(modelIds)];
  if (ids.length < 2 || ids.length > 6 || !ids.every((id) => MODEL_ID.test(id))) invalid('Compare between 2 and 6 distinct model identifiers');
  const response = await requestJson(serviceUrl, `/v1/models/compare${queryString({ ids: ids.join(',') })}`,
    accessToken, { method: 'GET' }, options);
  if (!isRecord(response) || typeof response.decision_status !== 'string' || !Array.isArray(response.models)) badResponse('model comparison');
  return response as unknown as ModelComparison;
}

/** POST /v1/models/rollback: restore the previously active model of a scope (audited). */
export async function rollbackModel(serviceUrl: string, accessToken: string, input: ModelRollbackRequest,
  options: MlRequestOptions = {}): Promise<{ active: Record<string, unknown> }> {
  if (!isRecord(input) || !TASK_CODE.test(String(input.event_code)) || !CADENCES.includes(String(input.cadence)) ||
      !isBoundedString(input.reason, 3, 500)) {
    invalid('Invalid rollback request');
  }
  const response = await requestJson(serviceUrl, '/v1/models/rollback', accessToken,
    { method: 'POST', body: JSON.stringify({ event_code: input.event_code, cadence: input.cadence, reason: input.reason }) }, options);
  if (!isRecord(response) || !isRecord(response.active)) badResponse('rollback result');
  return response as { active: Record<string, unknown> };
}

/** GET /v1/models/{id}/history: audited registry events of one model. */
export async function getModelHistory(serviceUrl: string, accessToken: string, modelId: string,
  options: MlRequestOptions = {}): Promise<ModelHistory> {
  if (!MODEL_ID.test(modelId)) invalid('Invalid model identifier');
  const response = await requestJson(serviceUrl, `/v1/models/${encodeURIComponent(modelId)}/history`, accessToken, { method: 'GET' }, options);
  if (!isRecord(response) || !Array.isArray(response.events)) badResponse('model history');
  return response as unknown as ModelHistory;
}

/** POST /v1/forecast-jobs: program forecasts (PRED-104). */
export async function submitForecastJob(serviceUrl: string, accessToken: string, input: ForecastJobRequest,
  idempotencyKey: string, options: MlRequestOptions = {}): Promise<TrainingJob> {
  if (!isRecord(input) || !CADENCES.includes(String(input.cadence))) invalid('Invalid forecast request');
  const body: ForecastJobRequest = { cadence: input.cadence };
  if (input.series_codes !== undefined) {
    if (!Array.isArray(input.series_codes) || input.series_codes.length > 3 ||
        !input.series_codes.every((code) => (FORECAST_SERIES as readonly string[]).includes(code))) invalid('Unknown forecast series');
    body.series_codes = input.series_codes;
  }
  const programs = programList(input.programs);
  if (programs) body.programs = programs;
  if (input.horizon !== undefined) {
    if (!Number.isInteger(input.horizon) || input.horizon < 1 || input.horizon > 8) invalid('horizon must be between 1 and 8');
    body.horizon = input.horizon;
  }
  return asJob(await requestJson(serviceUrl, '/v1/forecast-jobs', accessToken,
    { method: 'POST', body: JSON.stringify(body), idempotencyKey: idempotency(idempotencyKey) }, options));
}

/** GET /v1/forecasts: one program's latest forecast with points, or the latest summary of every program. */
export async function getForecasts(serviceUrl: string, accessToken: string, query: ForecastQuery,
  options: MlRequestOptions = {}): Promise<ForecastRun | { series: string; forecasts: ForecastRun[] }> {
  if (!(FORECAST_SERIES as readonly string[]).includes(query.series)) invalid('Unknown forecast series');
  if (query.programRef !== undefined && !PROGRAM_REF.test(query.programRef)) invalid('Invalid program reference');
  if (query.cadence !== undefined && !CADENCES.includes(query.cadence)) invalid('Invalid cadence');
  const response = await requestJson(serviceUrl,
    `/v1/forecasts${queryString({ series: query.series, program_ref: query.programRef, cadence: query.cadence })}`,
    accessToken, { method: 'GET' }, options);
  if (!isRecord(response)) badResponse('forecast');
  if (query.programRef !== undefined ? !Array.isArray(response.points) : !Array.isArray(response.forecasts)) badResponse('forecast');
  return response as unknown as ForecastRun | { series: string; forecasts: ForecastRun[] };
}
