/** Wire DTOs of the ML Studio operations of prediction-service (PRED-101..PRED-105). */
import type { MlJobKind, ModelReference, SearchSpace, TrainingJob, TrainingJobStatus } from './prediction.js';

export type MlTaskKind = 'classification' | 'regression' | 'forecast';
export type MlCadence = 'ANUAL' | 'SEMESTRAL';

/** One target of the prediction-service task catalog (GET /v1/ml-tasks). */
export interface MlTask {
  code: string;
  kind: MlTaskKind;
  subject: 'student' | 'enrollment' | 'series';
  grain: string;
  title: string;
  description: string;
  target_field: string;
  target_label: string;
  population_label: string;
  algorithms: string[];
  primary_metric: string;
  cadences: MlCadence[];
  positive_class?: string | null;
  negative_class?: string | null;
  serving_event_type?: string | null;
  servable: boolean;
  requires_course_ref: boolean;
  extractable: boolean;
  definition_version: string;
  target_definition_ref: string;
  population_definition_ref: string;
  sources: string[];
  target_unit?: string | null;
  required_features?: string[];
}

export interface MlJobListQuery {
  kind?: MlJobKind;
  status?: TrainingJobStatus;
  studyId?: string;
  limit?: number;
}

/** POST /v1/dataset-extractions (PRED-102). */
export interface DatasetExtractionRequest {
  task_code: string;
  cadence: MlCadence;
  programs?: string[];
  horizon_years?: number;
  features?: string[];
}

export interface DatasetSummary {
  dataset_ref: string;
  dataset_id: string;
  label: string;
  description?: string | null;
  is_custom: boolean;
  row_count: number;
  target_field?: string | null;
  event_code?: string | null;
  created_at?: string | null;
  content_digest?: string | null;
}

export interface ProfileWarning {
  code: string;
  field: string | null;
  message: string;
}

/** Exploratory profile of a dataset: aggregates only, no rows (PRED-102). */
export interface DatasetProfile {
  profile_version: string;
  generated_at: string;
  dataset_id?: string | null;
  event_code?: string | null;
  task_kind: MlTaskKind;
  row_count: number;
  feature_count: number;
  coverage: Record<string, Array<{ key: string; count: number }>>;
  target: Record<string, unknown>;
  features: Array<Record<string, unknown>>;
  target_correlations: Array<{ field: string; correlation: number }>;
  warnings: ProfileWarning[];
}

export interface DatasetSample {
  dataset_id?: string | null;
  row_count: number;
  columns: string[];
  rows: Array<Record<string, unknown>>;
}

/** POST /v1/training-studies (PRED-103): one job per algorithm on one dataset. */
export interface TrainingStudyRequest {
  dataset_ref: string;
  algorithms: string[];
  configuration_ref?: string;
  search_spaces?: Record<string, SearchSpace>;
}

export interface TrainingStudy {
  study_id: string;
  dataset_ref: string;
  task_code?: string | null;
  jobs: TrainingJob[];
}

/** GET /v1/models/compare (PRED-105). Test metrics are informative; selection uses validation only. */
export interface ModelComparison {
  task_kind: 'classification' | 'regression';
  decision_status: 'APTO' | 'EVIDENCIA_INSUFICIENTE';
  decision_reason: string;
  selection_rule: string;
  candidate_selection_status: 'SELECTED_BY_VALIDATION' | 'NO_UNIQUE_WINNER';
  selected_candidate_by_validation: string | null;
  top_candidates_by_validation: string[];
  evidence_kind: string;
  crisp_dm_next_step: { phase: string; reason: string; deployment_allowed: boolean };
  models: Array<{
    model_id: string;
    version: string;
    algorithm: string;
    artifact_digest: string;
    validation: Record<string, unknown>;
    test_metrics_final_only: Record<string, unknown>;
  }>;
  [key: string]: unknown;
}

/** POST /v1/models/rollback (PRED-105). */
export interface ModelRollbackRequest {
  event_code: string;
  cadence: MlCadence;
  reason: string;
}

export interface RegistryEvent {
  action: 'ACTIVATE' | 'PROMOTE' | 'ROLLBACK' | 'DEACTIVATE';
  scope_key: string | null;
  previous: (ModelReference & Record<string, unknown>) | null;
  active: (ModelReference & Record<string, unknown>) | null;
  approved_by?: string;
  reason?: string;
  at?: string;
}

export interface ModelHistory {
  model_id: string;
  version?: string | null;
  algorithm?: string | null;
  event_code?: string | null;
  cadence?: MlCadence | null;
  lifecycle_state?: string | null;
  events: RegistryEvent[];
}

/** Program forecast series (PRED-104). */
export const FORECAST_SERIES = [
  'APPLICATIONS_BY_PROGRAM',
  'ADMITTED_BY_PROGRAM',
  'ENROLLED_BY_PROGRAM',
] as const;
export type ForecastSeries = (typeof FORECAST_SERIES)[number];

export interface ForecastJobRequest {
  cadence: MlCadence;
  series_codes?: ForecastSeries[];
  programs?: string[];
  horizon?: number;
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
  cadence: MlCadence;
  horizon: number;
  model_kind: string;
  model: Record<string, unknown>;
  selection: Record<string, unknown>;
  backtest: Record<string, unknown>;
  history_points: number;
  created_at: string;
  points?: ForecastPoint[];
}

export interface ForecastQuery {
  series: ForecastSeries;
  programRef?: string;
  cadence?: MlCadence;
}
