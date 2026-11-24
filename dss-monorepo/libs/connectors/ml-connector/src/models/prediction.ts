/** Wire DTOs from the Prediction API v1 draft contract. */
export interface AcademicCutRef {
  cut_id: string;
}

export interface ModelReference {
  model_id: string;
  version: string;
}

/** Serving event types of the prediction-service task catalog (PRED-101/PRED-103). */
export const PREDICTION_EVENT_TYPES = [
  'program_dropout',
  'student_backlog',
  'student_gpa',
  'course_abandonment',
  'course_failure',
  'course_final_grade',
] as const;
export type PredictionEventType = (typeof PREDICTION_EVENT_TYPES)[number];
/** Course-level events require a course_ref; student-level events forbid it. */
export const COURSE_EVENT_TYPES: readonly PredictionEventType[] = [
  'course_abandonment',
  'course_failure',
  'course_final_grade',
];

export interface PredictionRequest {
  contract_version: '1.0';
  event_type?: PredictionEventType;
  subject_ref: string;
  program_ref: string;
  course_ref?: string;
  academic_cut: AcademicCutRef;
}

export interface PredictionInterval {
  lower: number;
  upper: number;
}

export type PredictedClass = 'POSITIVE_EVENT' | 'NEGATIVE_EVENT';

export interface PredictionResponse {
  contract_version: '1.0';
  prediction_id: string;
  subject_ref: string;
  program_ref: string;
  event_type: PredictionEventType;
  course_ref?: string | null;
  event_code: string;
  /** classification or regression (PRED-103). */
  task_kind?: 'classification' | 'regression';
  /** Classification tasks only. */
  predicted_class?: PredictedClass | null;
  event_probability?: number | null;
  /** Regression tasks only: value and bands by level ("0.8", "0.95"). */
  predicted_value?: number | null;
  prediction_interval?: Record<string, PredictionInterval> | null;
  unit?: string | null;
  model: ModelReference;
  academic_cut: AcademicCutRef;
  generated_at: string;
}

export type MlAlgorithm = 'random_forest' | 'xgboost' | 'ridge';
export type TrainingJobStatus =
  | 'QUEUED'
  | 'RUNNING'
  | 'SUCCEEDED'
  | 'FAILED'
  | 'CANCELLED';

/** Inline hyperparameter grid: parameter name to candidate values. */
export type SearchSpace = Record<string, Array<number | string | null>>;

export interface TrainingJobRequest {
  dataset_ref: string;
  algorithm: MlAlgorithm;
  configuration_ref?: string;
  search_space?: SearchSpace;
}

export interface MlProblem {
  type: string;
  title: string;
  status: number;
  /** Machine-readable code, e.g. JOB_CAPACITY, INVALID_TRAINING_REQUEST, NO_PREVIOUS_MODEL. */
  code: string;
  request_id: string;
  detail?: string;
}

export type MlJobKind = 'TRAIN' | 'EXTRACT_DATASET' | 'FORECAST';

export interface TrainingJob {
  job_id: string;
  contract_version: '1.0';
  dataset_ref: string;
  /** Empty for EXTRACT_DATASET and FORECAST jobs. */
  algorithm: MlAlgorithm | '';
  status: TrainingJobStatus;
  progress?: number | null;
  created_at: string;
  started_at?: string | null;
  finished_at?: string | null;
  submitted_by: string;
  model_candidate?: ModelReference | null;
  error?: MlProblem | null;
  /** PRED-102+: every ML job kind shares this shape. */
  job_kind?: MlJobKind;
  params?: Record<string, unknown> | null;
  result_ref?: string | null;
  study_id?: string | null;
}
