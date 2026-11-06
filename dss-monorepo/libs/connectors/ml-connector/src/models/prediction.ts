/** Wire DTOs from the Prediction API v1 draft contract. */
export interface AcademicCutRef {
  cut_id: string;
}

export interface ModelReference {
  model_id: string;
  version: string;
}

export interface PredictionRequest {
  contract_version: '1.0';
  subject_ref: string;
  program_ref: string;
  academic_cut: AcademicCutRef;
}

export type PredictedClass = 'POSITIVE_EVENT' | 'NEGATIVE_EVENT';

export interface PredictionResponse {
  contract_version: '1.0';
  prediction_id: string;
  subject_ref: string;
  program_ref: string;
  event_type: 'course_abandonment' | 'program_dropout';
  course_ref?: string | null;
  event_code: string;
  predicted_class: PredictedClass;
  event_probability?: number | null;
  model: ModelReference;
  academic_cut: AcademicCutRef;
  generated_at: string;
}

export type MlAlgorithm = 'random_forest' | 'xgboost';
export type TrainingJobStatus =
  | 'QUEUED'
  | 'RUNNING'
  | 'SUCCEEDED'
  | 'FAILED'
  | 'CANCELLED';

export interface TrainingJobRequest {
  dataset_ref: string;
  algorithm: MlAlgorithm;
  configuration_ref?: string;
}

export interface MlProblem {
  type: string;
  title: string;
  status: number;
  code:
    | 'INVALID_REQUEST'
    | 'INVALID_TOKEN'
    | 'INSUFFICIENT_SCOPE'
    | 'RESOURCE_NOT_FOUND'
    | 'INCOMPATIBLE_SCHEMA'
    | 'INELIGIBLE_PROFILE'
    | 'DATA_UNAVAILABLE'
    | 'NO_ACTIVE_MODEL'
    | 'JOB_CAPACITY'
    | 'JOB_FAILED'
    | 'CONFLICT'
    | 'TIMEOUT'
    | 'INTERNAL_ERROR';
  request_id: string;
  detail?: string;
}

export interface TrainingJob {
  job_id: string;
  contract_version: '1.0';
  dataset_ref: string;
  algorithm: MlAlgorithm;
  status: TrainingJobStatus;
  progress?: number | null;
  created_at: string;
  started_at?: string | null;
  finished_at?: string | null;
  submitted_by: string;
  model_candidate?: ModelReference | null;
  error?: MlProblem | null;
}
