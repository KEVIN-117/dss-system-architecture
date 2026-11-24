import { NextResponse } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { authenticateRequest, requirePermissions } = vi.hoisted(() => ({
  authenticateRequest: vi.fn(),
  requirePermissions: vi.fn(),
}));

vi.mock('../../_lib/auth-guard', () => ({ authenticateRequest, requirePermissions }));

import { GET as listTasks } from './tasks/route';
import { GET as listJobs } from './jobs/route';
import { POST as cancelJob } from './jobs/[jobId]/cancel/route';
import { GET as getProfile } from './datasets/[datasetRef]/profile/route';
import { POST as extract } from './dataset-extractions/route';
import { POST as study } from './training-studies/route';
import { GET as compare } from './models/compare/route';
import { POST as rollback } from './models/rollback/route';
import { GET as history } from './models/[modelId]/history/route';
import { POST as forecastJob } from './forecast-jobs/route';
import { GET as forecasts } from './forecasts/route';

const JOB_ID = '6f1c5d2a-1111-4c8b-9f9c-2f5e3d4c6b01';
const job = {
  job_id: JOB_ID, contract_version: '1.0', dataset_ref: 'custom:gpa', algorithm: '', status: 'QUEUED',
  created_at: '2026-11-24T00:00:00Z', submitted_by: 'operator-1', job_kind: 'EXTRACT_DATASET', params: {},
};
const authenticated = {
  authenticated: true as const,
  value: { token: 'verified-jwt', user: { sub: 'operator-1' }, roles: [], permissions: ['prediction:train'] },
};

function request(method: string, url: string, body?: unknown, headers: Record<string, string> = {}): Request {
  return new Request(url, {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

function params<T extends Record<string, string>>(value: T): { params: Promise<T> } {
  return { params: Promise.resolve(value) };
}

function upstream(fetchMock: ReturnType<typeof vi.fn>, index = 0): [URL, RequestInit] {
  return fetchMock.mock.calls[index] as [URL, RequestInit];
}

beforeEach(() => {
  vi.stubEnv('PREDICTION_SERVICE_URL', 'http://prediction-service:8000');
  authenticateRequest.mockResolvedValue(authenticated);
  requirePermissions.mockReturnValue(null);
});

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('ML Studio BFF routes (PRED-106)', () => {
  it('requires prediction:train and forwards the verified token', async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json([{ code: 'STUDENT_GPA_NEXT_CUT' }]));
    vi.stubGlobal('fetch', fetchMock);

    const response = await listTasks(new Request('http://bff/api/admin/ml/tasks'));

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(requirePermissions).toHaveBeenCalledWith(authenticated.value, ['prediction:train'], 'any');
    const [url, init] = upstream(fetchMock);
    expect(url.toString()).toBe('http://prediction-service:8000/v1/ml-tasks');
    expect(new Headers(init.headers).get('Authorization')).toBe('Bearer verified-jwt');
  });

  it('stops unauthenticated and unauthorized calls before prediction-service', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    authenticateRequest.mockResolvedValueOnce({ authenticated: false, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) });
    expect((await listTasks(new Request('http://bff/api/admin/ml/tasks'))).status).toBe(401);
    requirePermissions.mockReturnValueOnce(NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 }));
    expect((await listJobs(new Request('http://bff/api/admin/ml/jobs'))).status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('passes job filters and cancels by id', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(Response.json([job]))
      .mockResolvedValueOnce(Response.json({ ...job, status: 'CANCELLED' }));
    vi.stubGlobal('fetch', fetchMock);

    await listJobs(new Request('http://bff/api/admin/ml/jobs?kind=EXTRACT_DATASET&limit=10'));
    expect(upstream(fetchMock)[0].toString()).toBe('http://prediction-service:8000/v1/jobs?kind=EXTRACT_DATASET&limit=10');
    const cancelled = await cancelJob(request('POST', `http://bff/api/admin/ml/jobs/${JOB_ID}/cancel`), params({ jobId: JOB_ID }));
    expect((await cancelled.json()).status).toBe('CANCELLED');
    expect(upstream(fetchMock, 1)[1].method).toBe('POST');
  });

  it('rejects invalid input with 400 before calling prediction-service', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const badJob = await cancelJob(request('POST', 'http://bff/api/admin/ml/jobs/x/cancel'), params({ jobId: 'x' }));
    expect(badJob.status).toBe(400);
    expect((await badJob.json()).code).toBe('ML_INVALID_REQUEST');
    const noKey = await extract(request('POST', 'http://bff/api/admin/ml/dataset-extractions', { task_code: 'COURSE_FAILURE', cadence: 'SEMESTRAL' }));
    expect(noKey.status).toBe(400);
    const badJson = await extract(new Request('http://bff/api/admin/ml/dataset-extractions', {
      method: 'POST', headers: { 'Idempotency-Key': 'extract-key-000001' }, body: '{',
    }));
    expect(badJson.status).toBe(400);
    expect((await listJobs(new Request('http://bff/api/admin/ml/jobs?limit=abc'))).status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('queues extractions, studies and forecasts with 202 and the Idempotency-Key', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(Response.json(job, { status: 202 }))
      .mockResolvedValueOnce(Response.json({ study_id: 'a'.repeat(32), dataset_ref: 'custom:gpa', jobs: [{ ...job, algorithm: 'ridge', job_kind: 'TRAIN' }] }, { status: 202 }))
      .mockResolvedValueOnce(Response.json({ ...job, job_kind: 'FORECAST' }, { status: 202 }));
    vi.stubGlobal('fetch', fetchMock);
    const key = { 'Idempotency-Key': 'operation-key-00001' };

    expect((await extract(request('POST', 'http://bff/api/admin/ml/dataset-extractions',
      { task_code: 'STUDENT_GPA_NEXT_CUT', cadence: 'SEMESTRAL' }, key))).status).toBe(202);
    expect((await study(request('POST', 'http://bff/api/admin/ml/training-studies',
      { dataset_ref: 'custom:gpa', algorithms: ['ridge'] }, key))).status).toBe(202);
    expect((await forecastJob(request('POST', 'http://bff/api/admin/ml/forecast-jobs',
      { cadence: 'SEMESTRAL', horizon: 4 }, key))).status).toBe(202);
    for (let index = 0; index < 3; index += 1) {
      expect(new Headers(upstream(fetchMock, index)[1].headers).get('Idempotency-Key')).toBe('operation-key-00001');
    }
  });

  it('forwards prediction-service problems with code and plain-text detail', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({
      type: 'about:blank', title: 'No hay versión anterior', status: 409, code: 'NO_PREVIOUS_MODEL',
      detail: 'No previous approved version is available for rollback.', request_id: 'req-1',
    }, { status: 409 })));

    const response = await rollback(request('POST', 'http://bff/api/admin/ml/models/rollback',
      { event_code: 'STUDENT_GPA_NEXT_CUT', cadence: 'SEMESTRAL', reason: 'peor RMSE' }));

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ code: 'NO_PREVIOUS_MODEL', requestId: 'req-1',
      detail: 'No previous approved version is available for rollback.' });
  });

  it('maps outages to 502 and upstream 5xx to 502 without leaking details', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('fetch failed')));
    const down = await history(request('GET', 'http://bff/api/admin/ml/models/model-a/history'), params({ modelId: 'model-a' }));
    expect(down.status).toBe(502);
    expect((await down.json()).code).toBe('PREDICTION_UNAVAILABLE');

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ type: 'about:blank', title: 'Boom', status: 500,
      code: 'INTERNAL_ERROR', detail: 'trace at /app/main.py', request_id: 'r' }, { status: 500 })));
    const failed = await compare(new Request('http://bff/api/admin/ml/models/compare?ids=model-a,model-b'));
    expect(failed.status).toBe(502);
    expect(await failed.json()).not.toHaveProperty('detail');
  });

  it('reads profiles by encoded dataset reference', async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ row_count: 3, features: [], warnings: [] }));
    vi.stubGlobal('fetch', fetchMock);
    const ref = 'custom:0b4f7c1e-1d2a-4f5b-8c6d-7e8f9a0b1c01';
    const response = await getProfile(new Request(`http://bff/api/admin/ml/datasets/${encodeURIComponent(ref)}/profile`),
      params({ datasetRef: encodeURIComponent(ref) }));
    expect(response.status).toBe(200);
    expect(upstream(fetchMock)[0].toString()).toBe(`http://prediction-service:8000/v1/datasets/${encodeURIComponent(ref)}/profile`);
  });

  it('lets forecast readers or ML operators read forecasts', async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ series: 'ENROLLED_BY_PROGRAM', forecasts: [] }));
    vi.stubGlobal('fetch', fetchMock);
    const response = await forecasts(new Request('http://bff/api/admin/ml/forecasts?series=ENROLLED_BY_PROGRAM&cadence=SEMESTRAL'));
    expect(response.status).toBe(200);
    expect(requirePermissions).toHaveBeenCalledWith(authenticated.value, ['prediction:train', 'prediction:forecast:read'], 'any');
    expect(upstream(fetchMock)[0].toString()).toBe('http://prediction-service:8000/v1/forecasts?series=ENROLLED_BY_PROGRAM&cadence=SEMESTRAL');
    expect((await forecasts(new Request('http://bff/api/admin/ml/forecasts?series=OTHER'))).status).toBe(400);
  });
});
