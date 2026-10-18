import { NextResponse } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

const { authenticateRequest, predict } = vi.hoisted(() => ({
  authenticateRequest: vi.fn(),
  predict: vi.fn(),
}));

vi.mock('../../_lib/auth-guard', () => ({ authenticateRequest }));
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

import { POST } from './route';

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
});
