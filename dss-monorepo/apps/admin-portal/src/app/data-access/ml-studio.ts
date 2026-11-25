/**
 * ML Studio data layer (PRED-107): the admin portal talks to the BFF routes under /api/admin/ml/**
 * (PRED-106), which authenticate the session, check prediction:train and call prediction-service.
 * Activation and deactivation still use the registry routes of ml-operations.ts.
 */
import { responseError, type MlAlgorithm, type ModelCadence } from './ml-operations';

const BFF_BASE_URL = process.env.NEXT_PUBLIC_BFF_URL?.trim().replace(/\/$/, '') ?? '';
const ML_URL = `${BFF_BASE_URL}/api/admin/ml`;

export type MlTaskKind = 'classification' | 'regression' | 'forecast';
export type MlTaskSubject = 'student' | 'enrollment' | 'series';
export type MlJobKind = 'TRAIN' | 'EXTRACT_DATASET' | 'FORECAST';
export type MlJobStatus = 'QUEUED' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'CANCELLED';

/** One target of the prediction-service task catalog. */
export interface MlTask {
  code: string;
  kind: MlTaskKind;
  subject: MlTaskSubject;
  grain: string;
  title: string;
  description: string;
  target_field: string;
  target_label: string;
  population_label: string;
  algorithms: string[];
  primary_metric: string;
  cadences: ModelCadence[];
  positive_class?: string | null;
  negative_class?: string | null;
  servable: boolean;
  extractable: boolean;
  target_unit?: string | null;
}

export interface MlJob {
  job_id: string;
  dataset_ref: string;
  algorithm: MlAlgorithm | '';
  status: MlJobStatus;
  progress?: number | null;
  created_at: string;
  started_at?: string | null;
  finished_at?: string | null;
  submitted_by: string;
  model_candidate?: { model_id: string; version: string } | null;
  error?: { title?: string; detail?: string; code?: string } | null;
  job_kind?: MlJobKind;
  params?: Record<string, unknown> | null;
  /** EXTRACT_DATASET: the dataset_ref of the new dataset. FORECAST: forecast-job:{id}. */
  result_ref?: string | null;
  study_id?: string | null;
}

export const ACTIVE_JOB_STATUSES: readonly MlJobStatus[] = ['QUEUED', 'RUNNING'];
export function isJobActive(job: Pick<MlJob, 'status'>): boolean {
  return ACTIVE_JOB_STATUSES.includes(job.status);
}

export interface MlDataset {
  dataset_ref: string;
  dataset_id: string;
  label: string;
  description?: string | null;
  is_custom: boolean;
  row_count: number;
  target_field?: string | null;
  event_code?: string | null;
  created_at?: string | null;
}

export interface NumericSummary {
  count: number;
  min: number | null;
  max: number | null;
  mean: number | null;
  std: number | null;
  p25: number | null;
  median: number | null;
  p75: number | null;
  distinct: number;
  histogram: Array<{ start: number | null; end: number | null; count: number }>;
}

export interface FeatureProfile {
  name: string;
  logical_type: string;
  source_field?: string | null;
  missing: number;
  missing_ratio: number | null;
  summary?: NumericSummary;
  target_correlation?: number | null;
  label_source_feature?: boolean;
  top_values?: Array<{ value: string; count: number }>;
  distinct?: number;
}

export type TargetProfile =
  | { kind: 'regression'; field: string | null; missing: number; summary: NumericSummary }
  | {
      kind: 'classification';
      field: string | null;
      positive_class: string | null;
      negative_class: string | null;
      missing: number;
      classes: Array<{ class_name: string; count: number; ratio: number | null }>;
      imbalance_ratio: number | null;
      smote_threshold: number;
      smote_recommended: boolean;
    };

export interface DatasetProfile {
  profile_version: string;
  generated_at: string;
  dataset_id?: string | null;
  event_code?: string | null;
  task_kind: MlTaskKind;
  row_count: number;
  feature_count: number;
  coverage: Record<string, Array<{ key: string; count: number }>>;
  target: TargetProfile;
  features: FeatureProfile[];
  target_correlations: Array<{ field: string; correlation: number }>;
  warnings: Array<{ code: string; field: string | null; message: string }>;
}

export interface DatasetSample {
  row_count: number;
  columns: string[];
  rows: Array<Record<string, unknown>>;
}

export type SearchSpace = Record<string, Array<number | string | null>>;

export interface TrainingStudy {
  study_id: string;
  dataset_ref: string;
  task_code?: string | null;
  jobs: MlJob[];
}

export interface ModelComparison {
  task_kind: 'classification' | 'regression';
  decision_status: 'APTO' | 'EVIDENCIA_INSUFICIENTE';
  decision_reason: string;
  selection_rule: string;
  candidate_selection_status: 'SELECTED_BY_VALIDATION' | 'NO_UNIQUE_WINNER';
  selected_candidate_by_validation: string | null;
  top_candidates_by_validation: string[];
}

export interface RegistryEvent {
  action: 'ACTIVATE' | 'PROMOTE' | 'ROLLBACK' | 'DEACTIVATE';
  scope_key: string | null;
  previous: { model_id: string; version: string } | null;
  active: { model_id: string; version: string } | null;
  approved_by?: string;
  reason?: string;
  at?: string;
}

export interface ModelHistory {
  model_id: string;
  event_code?: string | null;
  cadence?: ModelCadence | null;
  lifecycle_state?: string | null;
  events: RegistryEvent[];
}

export const FORECAST_SERIES = ['APPLICATIONS_BY_PROGRAM', 'ADMITTED_BY_PROGRAM', 'ENROLLED_BY_PROGRAM'] as const;
export type ForecastSeries = (typeof FORECAST_SERIES)[number];

export interface ForecastBacktest {
  model: string;
  origins: number;
  evaluated_points: number;
  mae: number | null;
  rmse: number | null;
  mape: number | null;
  bias?: number | null;
  interval_coverage: Record<string, number> | null;
}

export interface ForecastPoint {
  year: number;
  period: number;
  kind: 'HISTORY' | 'FORECAST';
  horizon: number | null;
  value: number;
  interval: Record<string, { lower: number; upper: number }> | null;
}

export interface ForecastRun {
  run_id: string;
  job_id: string;
  series_code: ForecastSeries;
  program_ref: string;
  cadence: ModelCadence;
  horizon: number;
  model_kind: string;
  model: Record<string, unknown>;
  selection: Record<string, unknown>;
  backtest: { selected?: ForecastBacktest; candidates?: ForecastBacktest[] };
  history_points: number;
  created_at: string;
  points?: ForecastPoint[];
}

async function request<T>(path: string, init: RequestInit & { idempotent?: boolean } = {}): Promise<T> {
  const { idempotent, headers, ...rest } = init;
  const response = await fetch(`${ML_URL}${path}`, {
    credentials: 'include',
    cache: 'no-store',
    ...rest,
    headers: {
      Accept: 'application/json',
      ...(rest.body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(idempotent ? { 'Idempotency-Key': crypto.randomUUID() } : {}),
      ...(headers as Record<string, string> | undefined),
    },
  });
  if (!response.ok) throw Object.assign(await responseError(response), { status: response.status });
  return (await response.json()) as T;
}

/** HTTP status of a failed ML Studio call, when it reached the BFF. */
export function errorStatus(error: unknown): number | null {
  const status = (error as { status?: unknown } | null)?.status;
  return typeof status === 'number' ? status : null;
}

function query(params: Record<string, string | number | undefined | null>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') search.set(key, String(value));
  }
  const text = search.toString();
  return text ? `?${text}` : '';
}

export function listMlTasks(): Promise<MlTask[]> {
  return request<MlTask[]>('/tasks');
}

export function listMlJobs(filters: { kind?: MlJobKind; status?: MlJobStatus; studyId?: string; limit?: number } = {}): Promise<MlJob[]> {
  return request<MlJob[]>(`/jobs${query({ kind: filters.kind, status: filters.status, study_id: filters.studyId, limit: filters.limit })}`);
}

export function getMlJob(jobId: string): Promise<MlJob> {
  return request<MlJob>(`/jobs/${encodeURIComponent(jobId)}`);
}

export function cancelMlJob(jobId: string): Promise<MlJob> {
  return request<MlJob>(`/jobs/${encodeURIComponent(jobId)}/cancel`, { method: 'POST' });
}

export function submitDatasetExtraction(input: {
  task_code: string;
  cadence: ModelCadence;
  programs?: string[];
  horizon_years?: number;
}): Promise<MlJob> {
  return request<MlJob>('/dataset-extractions', { method: 'POST', body: JSON.stringify(input), idempotent: true });
}

export function listMlDatasets(): Promise<MlDataset[]> {
  return request<MlDataset[]>('/datasets');
}

export function getDatasetProfile(datasetRef: string): Promise<DatasetProfile> {
  return request<DatasetProfile>(`/datasets/${encodeURIComponent(datasetRef)}/profile`);
}

export function getDatasetSample(datasetRef: string, limit = 20): Promise<DatasetSample> {
  return request<DatasetSample>(`/datasets/${encodeURIComponent(datasetRef)}/sample${query({ limit })}`);
}

export function submitTrainingStudy(input: {
  dataset_ref: string;
  algorithms: string[];
  search_spaces?: Record<string, SearchSpace>;
}): Promise<TrainingStudy> {
  return request<TrainingStudy>('/training-studies', { method: 'POST', body: JSON.stringify(input), idempotent: true });
}

export function compareModels(modelIds: string[]): Promise<ModelComparison> {
  return request<ModelComparison>(`/models/compare${query({ ids: modelIds.join(',') })}`);
}

/** Restores the version that was active before the current one; returns the restored pointer. */
export function rollbackModel(input: {
  event_code: string;
  cadence: ModelCadence;
  reason: string;
}): Promise<{ model_id: string; version: string }> {
  return request<{ active: { model_id: string; version: string } }>('/models/rollback', {
    method: 'POST',
    body: JSON.stringify(input),
  }).then((body) => body.active);
}

export function getModelHistory(modelId: string): Promise<ModelHistory> {
  return request<ModelHistory>(`/models/${encodeURIComponent(modelId)}/history`);
}

export function submitForecastJob(input: {
  cadence: ModelCadence;
  series_codes?: ForecastSeries[];
  programs?: string[];
  horizon?: number;
}): Promise<MlJob> {
  return request<MlJob>('/forecast-jobs', { method: 'POST', body: JSON.stringify(input), idempotent: true });
}

export function listForecasts(series: ForecastSeries, cadence?: ModelCadence): Promise<ForecastRun[]> {
  return request<{ forecasts: ForecastRun[] }>(`/forecasts${query({ series, cadence })}`).then((body) => body.forecasts);
}

/** Latest forecast of a program with its points, or null while none has been generated. */
export async function getProgramForecast(
  series: ForecastSeries,
  programRef: string,
  cadence?: ModelCadence,
): Promise<ForecastRun | null> {
  try {
    return await request<ForecastRun>(`/forecasts${query({ series, program_ref: programRef, cadence })}`);
  } catch (error) {
    if (errorStatus(error) === 404) return null;
    throw error;
  }
}

/** Search-space parameters the service accepts per algorithm (mirrors prediction-service). */
export const SEARCH_SPACE_PARAMETERS: Record<string, Array<{ name: string; label: string; hint: string }>> = {
  ridge: [{ name: 'alpha', label: 'alpha', hint: 'Regularización, p. ej. 0.1, 1, 10' }],
  random_forest: [
    { name: 'n_estimators', label: 'n_estimators', hint: 'Árboles, 10–1000' },
    { name: 'max_depth', label: 'max_depth', hint: 'Profundidad 1–64 o «none»' },
    { name: 'min_samples_leaf', label: 'min_samples_leaf', hint: '1–100' },
  ],
  xgboost: [
    { name: 'n_estimators', label: 'n_estimators', hint: 'Árboles, 10–1000' },
    { name: 'max_depth', label: 'max_depth', hint: 'Profundidad 1–16' },
    { name: 'learning_rate', label: 'learning_rate', hint: '0–1, p. ej. 0.05, 0.1' },
  ],
};

/** Parse "0.1, 1, none" into grid values; returns null when a value is not a number or «none». */
export function parseGridValues(text: string): Array<number | null> | null {
  const items = text.split(',').map((item) => item.trim()).filter(Boolean);
  if (items.length === 0 || items.length > 10) return null;
  const values: Array<number | null> = [];
  for (const item of items) {
    if (/^none$/i.test(item)) values.push(null);
    else if (/^-?\d+(\.\d+)?$/.test(item)) values.push(Number(item));
    else return null;
  }
  return values;
}
