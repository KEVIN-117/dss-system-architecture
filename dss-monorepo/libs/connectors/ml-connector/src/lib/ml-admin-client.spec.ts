import { describe, expect, it, vi } from 'vitest';

import {
  cancelMlJob,
  compareModels,
  getDatasetProfile,
  getDatasetSample,
  getForecasts,
  getModelHistory,
  listMlJobs,
  listMlTasks,
  rollbackModel,
  submitDatasetExtraction,
  submitForecastJob,
  submitTrainingStudy,
} from './ml-admin-client.js';
import {
  isPredictionRequest,
  isTrainingJobRequest,
  MlRequestValidationError,
  MlServiceClientError,
  predict,
} from './ml-service-client.js';

const URL_BASE = 'http://prediction-service:8000';
const TOKEN = 'verified-jwt';
const JOB_ID = '6f1c5d2a-1111-4c8b-9f9c-2f5e3d4c6b01';

const job = {
  job_id: JOB_ID,
  contract_version: '1.0',
  dataset_ref: 'custom:0b4f7c1e-1d2a-4f5b-8c6d-7e8f9a0b1c01',
  algorithm: '',
  status: 'QUEUED',
  created_at: '2026-11-24T00:00:00Z',
  submitted_by: 'operator-1',
  job_kind: 'EXTRACT_DATASET',
  params: { task_code: 'STUDENT_GPA_NEXT_CUT' },
  result_ref: null,
  study_id: null,
};

function fetcherReturning(body: unknown, status = 200) {
  return vi.fn<typeof fetch>().mockResolvedValue(Response.json(body, { status }));
}

function call(fetcher: ReturnType<typeof fetcherReturning>): [URL, RequestInit] {
  return fetcher.mock.calls[0] as [URL, RequestInit];
}

describe('ML Studio connector (PRED-106)', () => {
  it('lists the task catalog and jobs with validated filters', async () => {
    const tasks = fetcherReturning([{ code: 'STUDENT_GPA_NEXT_CUT', kind: 'regression' }]);
    await expect(listMlTasks(URL_BASE, TOKEN, { fetcher: tasks })).resolves.toHaveLength(1);
    expect(call(tasks)[0].toString()).toBe(`${URL_BASE}/v1/ml-tasks`);

    const jobs = fetcherReturning([job]);
    await listMlJobs(URL_BASE, TOKEN, { kind: 'EXTRACT_DATASET', status: 'QUEUED', limit: 20 }, { fetcher: jobs });
    expect(call(jobs)[0].toString()).toBe(`${URL_BASE}/v1/jobs?kind=EXTRACT_DATASET&status=QUEUED&limit=20`);
    await expect(listMlJobs(URL_BASE, TOKEN, { limit: 500 }, { fetcher: jobs })).rejects.toBeInstanceOf(MlRequestValidationError);
    await expect(listMlJobs(URL_BASE, TOKEN, { studyId: '../x' }, { fetcher: jobs })).rejects.toBeInstanceOf(MlRequestValidationError);
  });

  it('queues an extraction with its Idempotency-Key and only the documented fields', async () => {
    const fetcher = fetcherReturning(job, 202);
    await submitDatasetExtraction(URL_BASE, TOKEN,
      { task_code: 'STUDENT_GPA_NEXT_CUT', cadence: 'SEMESTRAL', programs: ['SIS'], ...({ injected: 1 } as object) },
      'extract-key-000001', { fetcher });
    const [url, init] = call(fetcher);
    expect(url.toString()).toBe(`${URL_BASE}/v1/dataset-extractions`);
    expect(new Headers(init.headers).get('Idempotency-Key')).toBe('extract-key-000001');
    expect(JSON.parse(String(init.body))).toEqual({ task_code: 'STUDENT_GPA_NEXT_CUT', cadence: 'SEMESTRAL', programs: ['SIS'] });
    await expect(submitDatasetExtraction(URL_BASE, TOKEN, { task_code: 'x', cadence: 'SEMESTRAL' }, 'extract-key-000001', { fetcher }))
      .rejects.toBeInstanceOf(MlRequestValidationError);
    await expect(submitDatasetExtraction(URL_BASE, TOKEN, { task_code: 'COURSE_FAILURE', cadence: 'SEMESTRAL' }, 'short', { fetcher }))
      .rejects.toBeInstanceOf(MlRequestValidationError);
  });

  it('cancels jobs by UUID only', async () => {
    const fetcher = fetcherReturning({ ...job, status: 'CANCELLED' });
    await expect(cancelMlJob(URL_BASE, TOKEN, JOB_ID, { fetcher })).resolves.toMatchObject({ status: 'CANCELLED' });
    expect(call(fetcher)[1].method).toBe('POST');
    await expect(cancelMlJob(URL_BASE, TOKEN, 'not-a-uuid', { fetcher })).rejects.toBeInstanceOf(MlRequestValidationError);
  });

  it('reads dataset profiles and samples by encoded reference', async () => {
    const profile = fetcherReturning({ row_count: 10, features: [], warnings: [] });
    await getDatasetProfile(URL_BASE, TOKEN, 'custom:0b4f7c1e-1d2a-4f5b-8c6d-7e8f9a0b1c01', { fetcher: profile });
    expect(call(profile)[0].toString()).toBe(`${URL_BASE}/v1/datasets/custom%3A0b4f7c1e-1d2a-4f5b-8c6d-7e8f9a0b1c01/profile`);
    const sample = fetcherReturning({ columns: ['student_ref'], rows: [], row_count: 0 });
    await getDatasetSample(URL_BASE, TOKEN, 'fixture:pred003_synthetic-v1', 5, { fetcher: sample });
    expect(call(sample)[0].toString()).toContain('/sample?limit=5');
    await expect(getDatasetProfile(URL_BASE, TOKEN, '../etc', { fetcher: profile })).rejects.toBeInstanceOf(MlRequestValidationError);
    await expect(getDatasetSample(URL_BASE, TOKEN, 'custom:x', 500, { fetcher: sample })).rejects.toBeInstanceOf(MlRequestValidationError);
  });

  it('submits training studies with per-algorithm search spaces', async () => {
    const fetcher = fetcherReturning({ study_id: 'a'.repeat(32), dataset_ref: 'custom:gpa', jobs: [{ ...job, algorithm: 'ridge', job_kind: 'TRAIN' }] }, 202);
    const study = await submitTrainingStudy(URL_BASE, TOKEN,
      { dataset_ref: 'custom:gpa', algorithms: ['ridge', 'xgboost'], search_spaces: { ridge: { alpha: [0.1, 1] } } },
      'study-key-0000001', { fetcher });
    expect(study.jobs[0].algorithm).toBe('ridge');
    for (const bad of [
      { dataset_ref: 'custom:gpa', algorithms: ['ridge', 'ridge'] },
      { dataset_ref: 'custom:gpa', algorithms: ['svm'] },
      { dataset_ref: 'custom:gpa', algorithms: ['ridge'], search_spaces: { xgboost: { max_depth: [3] } } },
    ]) {
      await expect(submitTrainingStudy(URL_BASE, TOKEN, bad, 'study-key-0000001', { fetcher })).rejects.toBeInstanceOf(MlRequestValidationError);
    }
  });

  it('compares, rolls back and reads model history', async () => {
    const compare = fetcherReturning({ decision_status: 'APTO', models: [] });
    await compareModels(URL_BASE, TOKEN, ['model-a', 'model-b', 'model-a'], { fetcher: compare });
    expect(call(compare)[0].toString()).toBe(`${URL_BASE}/v1/models/compare?ids=model-a%2Cmodel-b`);
    await expect(compareModels(URL_BASE, TOKEN, ['only-one'], { fetcher: compare })).rejects.toBeInstanceOf(MlRequestValidationError);

    const rollback = fetcherReturning({ active: { model_id: 'model-a' } });
    await rollbackModel(URL_BASE, TOKEN, { event_code: 'STUDENT_GPA_NEXT_CUT', cadence: 'SEMESTRAL', reason: 'peor RMSE' }, { fetcher: rollback });
    expect(JSON.parse(String(call(rollback)[1].body))).toEqual({ event_code: 'STUDENT_GPA_NEXT_CUT', cadence: 'SEMESTRAL', reason: 'peor RMSE' });
    await expect(rollbackModel(URL_BASE, TOKEN, { event_code: 'STUDENT_GPA_NEXT_CUT', cadence: 'SEMESTRAL', reason: '' }, { fetcher: rollback }))
      .rejects.toBeInstanceOf(MlRequestValidationError);

    const history = fetcherReturning({ model_id: 'model-a', events: [] });
    await expect(getModelHistory(URL_BASE, TOKEN, 'model-a', { fetcher: history })).resolves.toMatchObject({ events: [] });
  });

  it('launches and reads forecasts', async () => {
    const launch = fetcherReturning({ ...job, job_kind: 'FORECAST', dataset_ref: 'forecast:SEMESTRAL' }, 202);
    await submitForecastJob(URL_BASE, TOKEN, { cadence: 'SEMESTRAL', series_codes: ['APPLICATIONS_BY_PROGRAM'], horizon: 4 },
      'forecast-key-00001', { fetcher: launch });
    await expect(submitForecastJob(URL_BASE, TOKEN, { cadence: 'SEMESTRAL', horizon: 9 }, 'forecast-key-00001', { fetcher: launch }))
      .rejects.toBeInstanceOf(MlRequestValidationError);
    const one = fetcherReturning({ series_code: 'ENROLLED_BY_PROGRAM', program_ref: 'SIS', points: [] });
    await getForecasts(URL_BASE, TOKEN, { series: 'ENROLLED_BY_PROGRAM', programRef: 'SIS', cadence: 'SEMESTRAL' }, { fetcher: one });
    expect(call(one)[0].toString()).toBe(`${URL_BASE}/v1/forecasts?series=ENROLLED_BY_PROGRAM&program_ref=SIS&cadence=SEMESTRAL`);
    const wrongShape = fetcherReturning({ series: 'ENROLLED_BY_PROGRAM' });
    await expect(getForecasts(URL_BASE, TOKEN, { series: 'ENROLLED_BY_PROGRAM', programRef: 'SIS' }, { fetcher: wrongShape }))
      .rejects.toBeInstanceOf(MlServiceClientError);
  });

  it('keeps prediction-service problem codes and details', async () => {
    const fetcher = fetcherReturning({ type: 'about:blank', title: 'Invalid training request', status: 422,
      code: 'INVALID_TRAINING_REQUEST', detail: 'Unknown hyperparameter', request_id: 'req-1' }, 422);
    const failure = submitForecastJob(URL_BASE, TOKEN, { cadence: 'ANUAL' }, 'forecast-key-00002', { fetcher });
    await expect(failure).rejects.toMatchObject({ status: 422, problem: { code: 'INVALID_TRAINING_REQUEST', detail: 'Unknown hyperparameter' } });
  });
});

describe('Prediction contract after PRED-103 (compatibility fix)', () => {
  const base = {
    contract_version: '1.0' as const,
    prediction_id: 'e41806b7-751b-44c5-8d14-11833646fb8b',
    subject_ref: '100',
    program_ref: 'SIS',
    course_ref: null,
    model: { model_id: 'm', version: 'v' },
    academic_cut: { cut_id: '42' },
    generated_at: '2026-11-24T00:00:00Z',
  };

  it('accepts regression responses and fields added by newer services', async () => {
    const regression = { ...base, event_type: 'student_gpa', event_code: 'STUDENT_GPA_NEXT_CUT', task_kind: 'regression',
      predicted_class: null, event_probability: null, predicted_value: 63.2,
      prediction_interval: { '0.8': { lower: 60, upper: 66 } }, unit: 'puntos de PPA' };
    const fetcher = fetcherReturning(regression);
    await expect(predict(URL_BASE, TOKEN,
      { contract_version: '1.0', event_type: 'student_gpa', subject_ref: '100', program_ref: 'SIS', academic_cut: { cut_id: '42' } },
      { fetcher })).resolves.toMatchObject({ predicted_value: 63.2 });
    const classification = fetcherReturning({ ...base, event_type: 'program_dropout', event_code: 'PROGRAM_DROPOUT_NEXT_EXPECTED_CLOSURE',
      task_kind: 'classification', predicted_class: 'POSITIVE_EVENT', event_probability: 0.8, predicted_value: null,
      prediction_interval: null, unit: null });
    await expect(predict(URL_BASE, TOKEN, { contract_version: '1.0', subject_ref: '100', program_ref: 'SIS', academic_cut: { cut_id: '42' } },
      { fetcher: classification })).resolves.toMatchObject({ predicted_class: 'POSITIVE_EVENT' });
    const broken = fetcherReturning({ ...base, event_type: 'student_gpa', event_code: 'X', task_kind: 'regression', predicted_class: 'POSITIVE_EVENT' });
    await expect(predict(URL_BASE, TOKEN, { contract_version: '1.0', subject_ref: '100', program_ref: 'SIS', academic_cut: { cut_id: '42' } },
      { fetcher: broken })).rejects.toBeInstanceOf(MlServiceClientError);
  });

  it('accepts every catalog event type and enforces the course_ref rule', () => {
    const request = { contract_version: '1.0', subject_ref: '1', program_ref: 'SIS', academic_cut: { cut_id: '1' } };
    expect(isPredictionRequest({ ...request, event_type: 'student_backlog' })).toBe(true);
    expect(isPredictionRequest({ ...request, event_type: 'course_final_grade', course_ref: '10' })).toBe(true);
    expect(isPredictionRequest({ ...request, event_type: 'course_failure' })).toBe(false);
    expect(isPredictionRequest({ ...request, event_type: 'student_gpa', course_ref: '10' })).toBe(false);
    expect(isPredictionRequest({ ...request, event_type: 'unknown' })).toBe(false);
  });

  it('accepts ridge and inline search spaces in training requests', () => {
    expect(isTrainingJobRequest({ dataset_ref: 'custom:gpa', algorithm: 'ridge', search_space: { alpha: [0.1, 1] } })).toBe(true);
    expect(isTrainingJobRequest({ dataset_ref: 'custom:gpa', algorithm: 'ridge', search_space: { alpha: [] } })).toBe(false);
    expect(isTrainingJobRequest({ dataset_ref: 'custom:gpa', algorithm: 'ridge', search_space: { alpha: 'x' } })).toBe(false);
  });
});
