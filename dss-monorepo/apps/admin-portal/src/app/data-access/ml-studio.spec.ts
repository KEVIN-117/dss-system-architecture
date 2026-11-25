import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  cancelMlJob,
  getDatasetProfile,
  getProgramForecast,
  listForecasts,
  listMlJobs,
  parseGridValues,
  rollbackModel,
  submitDatasetExtraction,
  submitTrainingStudy,
} from './ml-studio';

afterEach(() => vi.unstubAllGlobals());

function respond(status: number, body?: unknown) {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function call(fetchMock: ReturnType<typeof vi.fn>, index = 0): [string, RequestInit] {
  return fetchMock.mock.calls[index] as [string, RequestInit];
}

describe('ML Studio data access (PRED-107)', () => {
  it('lists jobs with filters through the BFF ML routes and the session cookie', async () => {
    const fetchMock = vi.fn().mockResolvedValue(respond(200, []));
    vi.stubGlobal('fetch', fetchMock);

    await listMlJobs({ kind: 'TRAIN', studyId: 'study-1', limit: 20 });

    const [url, init] = call(fetchMock);
    expect(url).toContain('/api/admin/ml/jobs?kind=TRAIN&study_id=study-1&limit=20');
    expect(init.credentials).toBe('include');
    expect(init.cache).toBe('no-store');
  });

  it('sends job-creating requests with JSON and a fresh Idempotency-Key', async () => {
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(respond(202, { job_id: 'j-1', status: 'QUEUED' })));
    vi.stubGlobal('fetch', fetchMock);

    await submitDatasetExtraction({ task_code: 'STUDENT_GPA_NEXT_CUT', cadence: 'SEMESTRAL', programs: ['INF'] });
    await submitTrainingStudy({ dataset_ref: 'custom:a', algorithms: ['ridge', 'xgboost'] });

    const [url, init] = call(fetchMock);
    expect(url).toContain('/api/admin/ml/dataset-extractions');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({ task_code: 'STUDENT_GPA_NEXT_CUT', cadence: 'SEMESTRAL', programs: ['INF'] });
    const first = new Headers(init.headers).get('Idempotency-Key');
    const second = new Headers(call(fetchMock, 1)[1].headers).get('Idempotency-Key');
    expect(first).toBeTruthy();
    expect(second).toBeTruthy();
    expect(first).not.toBe(second);
  });

  it('cancels by encoded id without an Idempotency-Key', async () => {
    const fetchMock = vi.fn().mockResolvedValue(respond(200, { job_id: 'a/b', status: 'CANCELLED' }));
    vi.stubGlobal('fetch', fetchMock);

    await cancelMlJob('a/b');

    const [url, init] = call(fetchMock);
    expect(url).toContain('/api/admin/ml/jobs/a%2Fb/cancel');
    expect(new Headers(init.headers).has('Idempotency-Key')).toBe(false);
  });

  it('encodes dataset references in profile paths', async () => {
    const fetchMock = vi.fn().mockResolvedValue(respond(200, { row_count: 1 }));
    vi.stubGlobal('fetch', fetchMock);

    await getDatasetProfile('custom:0b4f7c1e');

    expect(call(fetchMock)[0]).toContain('/api/admin/ml/datasets/custom%3A0b4f7c1e/profile');
  });

  it('shows the detail of a rejected request', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respond(409, {
      error: 'No hay versión anterior', code: 'NO_PREVIOUS_MODEL', detail: 'No previous approved version is available.',
    })));

    await expect(rollbackModel({ event_code: 'STUDENT_GPA_NEXT_CUT', cadence: 'SEMESTRAL', reason: 'peor RMSE' }))
      .rejects.toThrow('No previous approved version is available.');
  });

  it('returns the restored pointer of a rollback', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respond(200, { active: { model_id: 'm-1', version: 'v1' } })));

    await expect(rollbackModel({ event_code: 'COURSE_FAILURE', cadence: 'ANUAL', reason: 'regresión' }))
      .resolves.toEqual({ model_id: 'm-1', version: 'v1' });
  });

  it('reads forecast lists and treats a missing program forecast as null', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(respond(200, { series: 'ENROLLED_BY_PROGRAM', forecasts: [{ run_id: 'r-1' }] }))
      .mockResolvedValueOnce(respond(404, { error: 'Forecast not found', code: 'RESOURCE_NOT_FOUND' }))
      .mockResolvedValueOnce(respond(503, { error: 'Prediction Service is unavailable' }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(listForecasts('ENROLLED_BY_PROGRAM', 'SEMESTRAL')).resolves.toEqual([{ run_id: 'r-1' }]);
    expect(call(fetchMock)[0]).toContain('/api/admin/ml/forecasts?series=ENROLLED_BY_PROGRAM&cadence=SEMESTRAL');
    await expect(getProgramForecast('ENROLLED_BY_PROGRAM', 'INF')).resolves.toBeNull();
    await expect(getProgramForecast('ENROLLED_BY_PROGRAM', 'INF')).rejects.toThrow('Prediction Service is unavailable');
  });

  it('parses hyperparameter grids', () => {
    expect(parseGridValues('0.1, 1, 10')).toEqual([0.1, 1, 10]);
    expect(parseGridValues('4, none')).toEqual([4, null]);
    expect(parseGridValues('')).toBeNull();
    expect(parseGridValues('1, abc')).toBeNull();
    expect(parseGridValues(Array.from({ length: 11 }, (_, i) => i).join(','))).toBeNull();
  });
});
