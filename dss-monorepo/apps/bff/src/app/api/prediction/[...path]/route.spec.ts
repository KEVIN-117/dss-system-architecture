import { NextResponse } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

const { authenticateRequest, requireRoles, predict } = vi.hoisted(() => ({
  authenticateRequest: vi.fn(),
  requireRoles: vi.fn(() => null),
  predict: vi.fn(),
}));

vi.mock('../../_lib/auth-guard', () => ({ authenticateRequest, requireRoles }));
vi.mock('@dss-monorepo/ml-connector', () => ({
  getTrainingJob: vi.fn(),
  isPredictionRequest: (value: unknown) =>
    typeof value === 'object' &&
    value !== null &&
    'contract_version' in value &&
    'subject_ref' in value &&
    'program_ref' in value &&
    'academic_cut' in value,
  isTrainingJobRequest: () => false,
  MlServiceClientError: class MlServiceClientError extends Error {},
  MlServiceTimeoutError: class MlServiceTimeoutError extends Error {},
  predict,
  submitTrainingJob: vi.fn(),
}));

import { GET, POST } from './route';

const authentication = {
  authenticated: true as const,
  value: {
    token: 'verified-access-token',
    user: { id: 'user-1', isActive: true, roles: ['DIRECTOR'] },
    roles: ['DIRECTOR'],
  },
};

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
  delete process.env.PREDICTION_SERVICE_URL;
});

describe('Prediction BFF route', () => {
  it('requires a valid BFF session before invoking the connector', async () => {
    authenticateRequest.mockResolvedValue({
      authenticated: false,
      response: NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 },
      ),
    });
    const request = new Request(
      'http://localhost:3006/api/prediction/v1/predictions',
      {
        method: 'POST',
        body: JSON.stringify({}),
      },
    );

    const response = await POST(request, {
      params: Promise.resolve({ path: ['v1', 'predictions'] }),
    });
    expect(response.status).toBe(401);
    expect(predict).not.toHaveBeenCalled();
  });

  it('forwards only a validated prediction request with the verified token', async () => {
    process.env.PREDICTION_SERVICE_URL = 'http://prediction-service:8000';
    authenticateRequest.mockResolvedValue(authentication);
    predict.mockResolvedValue({ prediction_id: 'prediction-1' });
    const body = {
      contract_version: '1.0',
      subject_ref: 'student-1',
      program_ref: 'program-1',
      academic_cut: { cut_id: 'cut-2026' },
    };
    const request = new Request(
      'http://localhost:3006/api/prediction/v1/predictions',
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-request-id': 'req-1',
        },
        body: JSON.stringify(body),
      },
    );

    const response = await POST(request, {
      params: Promise.resolve({ path: ['v1', 'predictions'] }),
    });
    expect(response.status).toBe(200);
    expect(predict).toHaveBeenCalledWith(
      'http://prediction-service:8000',
      'verified-access-token',
      body,
      expect.objectContaining({ requestId: 'req-1' }),
    );
    expect(response.headers.get('cache-control')).toBe('no-store');
  });

  it('does not expose arbitrary upstream paths through the BFF', async () => {
    authenticateRequest.mockResolvedValue(authentication);
    const request = new Request(
      'http://localhost:3006/api/prediction/admin/secrets',
      { method: 'POST', body: '{}' },
    );

    const response = await POST(request, {
      params: Promise.resolve({ path: ['admin', 'secrets'] }),
    });
    expect(response.status).toBe(404);
    expect(predict).not.toHaveBeenCalled();
  });

  it('forwards a population batch request only with the authenticated token', async () => {
    process.env.PREDICTION_SERVICE_URL = 'http://prediction-service:8000';
    authenticateRequest.mockResolvedValue(authentication);
    const upstream = vi.fn().mockResolvedValue(new Response(JSON.stringify({ batch_id: 'batch-1', status: 'QUEUED' }), { status: 202 }));
    vi.stubGlobal('fetch', upstream);
    const request = new Request('http://localhost:3006/api/prediction/v1/prediction-batches', {
      method: 'POST', headers: { 'Idempotency-Key': 'population-batch-key-001', 'content-type': 'application/json' },
      body: JSON.stringify({ contract_version: '1.0', program_ref: 'P01', academic_cut: { cut_id: '42' } }),
    });

    const response = await POST(request, { params: Promise.resolve({ path: ['v1', 'prediction-batches'] }) });
    expect(response.status).toBe(202);
    expect(upstream).toHaveBeenCalledTimes(1);
    const [url, options] = upstream.mock.calls[0] as [URL, RequestInit];
    expect(url.toString()).toBe('http://prediction-service:8000/v1/prediction-batches');
    expect(new Headers(options.headers).get('authorization')).toBe('Bearer verified-access-token');
    expect(new Headers(options.headers).get('idempotency-key')).toBe('population-batch-key-001');
  });

  it('forwards authorized publication reads and preserves selection filters', async () => {
    process.env.PREDICTION_SERVICE_URL = 'http://prediction-service:8000';
    authenticateRequest.mockResolvedValue(authentication);
    const upstream = vi.fn().mockResolvedValue(new Response(JSON.stringify({ publication: null }), { status: 200 }));
    vi.stubGlobal('fetch', upstream);
    const response = await GET(new Request('http://localhost:3006/api/prediction/v1/prediction-publications?program_ref=P01&cut_id=42'), {
      params: Promise.resolve({ path: ['v1', 'prediction-publications'] }),
    });
    expect(response.status).toBe(200);
    const [url, options] = upstream.mock.calls[0] as [URL, RequestInit];
    expect(url.toString()).toBe('http://prediction-service:8000/v1/prediction-publications?program_ref=P01&cut_id=42');
    expect(new Headers(options.headers).get('authorization')).toBe('Bearer verified-access-token');
  });

  it('keeps the model registry behind the SUPERADMIN role', async () => {
    process.env.PREDICTION_SERVICE_URL = 'http://prediction-service:8000';
    authenticateRequest.mockResolvedValue(authentication);
    requireRoles.mockReturnValueOnce(NextResponse.json({ error: 'Forbidden' }, { status: 403 }) as never);
    const upstream = vi.fn();
    vi.stubGlobal('fetch', upstream);
    const response = await GET(new Request('http://localhost:3006/api/prediction/v1/models'), {
      params: Promise.resolve({ path: ['v1', 'models'] }),
    });
    expect(response.status).toBe(403);
    expect(requireRoles).toHaveBeenCalledWith(authentication.value, ['SUPERADMIN']);
    expect(upstream).not.toHaveBeenCalled();
  });

  it('forwards model listing, activation and deactivation with the verified token', async () => {
    process.env.PREDICTION_SERVICE_URL = 'http://prediction-service:8000';
    authenticateRequest.mockResolvedValue(authentication);
    const upstream = vi.fn().mockImplementation(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }));
    vi.stubGlobal('fetch', upstream);

    expect((await GET(new Request('http://localhost:3006/api/prediction/v1/models'), {
      params: Promise.resolve({ path: ['v1', 'models'] }),
    })).status).toBe(200);
    for (const action of ['activate', 'deactivate']) {
      const body = JSON.stringify({ reason: 'Revisión de métricas' });
      const response = await POST(new Request(`http://localhost:3006/api/prediction/v1/models/${action}`, {
        method: 'POST', headers: { 'content-type': 'application/json' }, body,
      }), { params: Promise.resolve({ path: ['v1', 'models', action] }) });
      expect(response.status).toBe(200);
    }
    const urls = upstream.mock.calls.map(([url]) => (url as URL).toString());
    expect(urls).toEqual([
      'http://prediction-service:8000/v1/models',
      'http://prediction-service:8000/v1/models/activate',
      'http://prediction-service:8000/v1/models/deactivate',
    ]);
    const [, activateOptions] = upstream.mock.calls[1] as [URL, RequestInit];
    expect(activateOptions.method).toBe('POST');
    expect(activateOptions.body).toBe(JSON.stringify({ reason: 'Revisión de métricas' }));
    expect(new Headers(activateOptions.headers).get('authorization')).toBe('Bearer verified-access-token');
  });

  it('rejects other model paths and methods', async () => {
    authenticateRequest.mockResolvedValue(authentication);
    const deleteModels = await POST(new Request('http://localhost:3006/api/prediction/v1/models/delete', { method: 'POST', body: '{}' }), {
      params: Promise.resolve({ path: ['v1', 'models', 'delete'] }),
    });
    expect(deleteModels.status).toBe(404);
    const activateViaGet = await GET(new Request('http://localhost:3006/api/prediction/v1/models/activate'), {
      params: Promise.resolve({ path: ['v1', 'models', 'activate'] }),
    });
    expect(activateViaGet.status).toBe(404);
  });
});
