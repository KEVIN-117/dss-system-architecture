import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  getTrainingJob,
  isPredictionRequest,
  isTrainingJobRequest,
  MlServiceTimeoutError,
  predict,
  submitTrainingJob,
} from './ml-service-client.js';

const predictionRequest = {
  contract_version: '1.0' as const,
  subject_ref: 'student-ref',
  program_ref: 'program-ref',
  academic_cut: { cut_id: 'cut-2026' },
};

const predictionResponse = {
  contract_version: '1.0' as const,
  prediction_id: 'e41806b7-751b-44c5-8d14-11833646fb8b',
  subject_ref: 'student-ref',
  program_ref: 'program-ref',
  event_type: 'program_dropout' as const,
  course_ref: null,
  event_code: 'WITHDRAWAL',
  predicted_class: 'NEGATIVE_EVENT' as const,
  event_probability: 0.2,
  model: { model_id: 'model-1', version: 'v1' },
  academic_cut: { cut_id: 'cut-2026' },
  generated_at: '2026-10-18T12:00:00Z',
};

afterEach(() => vi.restoreAllMocks());

describe('ML connector contract validation', () => {
  it('accepts only the documented prediction and training request shapes', () => {
    expect(isPredictionRequest(predictionRequest)).toBe(true);
    expect(isPredictionRequest({ ...predictionRequest, extra: true })).toBe(
      false,
    );
    expect(
      isTrainingJobRequest({ dataset_ref: 'snapshot-1', algorithm: 'xgboost' }),
    ).toBe(true);
    expect(
      isTrainingJobRequest({ dataset_ref: 'snapshot-1', algorithm: 'other' }),
    ).toBe(false);
  });
});

describe('Prediction Service client', () => {
  it('sends the verified bearer token and validates the prediction response', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json(predictionResponse));

    await expect(
      predict(
        'http://prediction-service:8000',
        'verified-jwt',
        predictionRequest,
        {
          fetcher,
          requestId: 'req-123',
        },
      ),
    ).resolves.toEqual(predictionResponse);

    const [url, init] = fetcher.mock.calls[0];
    expect(String(url)).toBe('http://prediction-service:8000/v1/predictions');
    expect(new Headers(init?.headers).get('authorization')).toBe(
      'Bearer verified-jwt',
    );
    expect(new Headers(init?.headers).get('x-request-id')).toBe('req-123');
    expect(JSON.parse(String(init?.body))).toEqual(predictionRequest);
  });

  it('rejects non-HTTP URLs before making a request', async () => {
    const fetcher = vi.fn<typeof fetch>();
    await expect(
      predict('file:///tmp/ml', 'token', predictionRequest, { fetcher }),
    ).rejects.toThrow(
      'Prediction service URL must be an HTTP(S) origin/base path',
    );
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('requires the idempotency header for training submission', async () => {
    const fetcher = vi.fn<typeof fetch>();
    await expect(
      submitTrainingJob(
        'http://prediction-service:8000',
        'verified-jwt',
        { dataset_ref: 'snapshot-1', algorithm: 'random_forest' },
        'short',
        { fetcher },
      ),
    ).rejects.toThrow(
      'Idempotency-Key must contain between 16 and 128 characters',
    );
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('forwards the idempotency key and encodes a job id in the request path', async () => {
    const job = {
      job_id: 'e41806b7-751b-44c5-8d14-11833646fb8b',
      contract_version: '1.0',
      dataset_ref: 'snapshot-1',
      algorithm: 'xgboost',
      status: 'QUEUED',
      created_at: '2026-10-18T12:00:00Z',
      submitted_by: 'actor-ref',
    };
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json(job, { status: 202 }))
      .mockResolvedValueOnce(Response.json(job));

    await submitTrainingJob(
      'http://prediction-service:8000',
      'token',
      {
        dataset_ref: 'snapshot-1',
        algorithm: 'xgboost',
      },
      'idempotency-key-123456',
      { fetcher },
    );
    expect(
      new Headers(fetcher.mock.calls[0][1]?.headers).get('idempotency-key'),
    ).toBe('idempotency-key-123456');

    await getTrainingJob(
      'http://prediction-service:8000',
      'token',
      'e41806b7-751b-44c5-8d14-11833646fb8b',
      { fetcher },
    );
    expect(String(fetcher.mock.calls[1][0])).toBe(
      'http://prediction-service:8000/v1/training-jobs/e41806b7-751b-44c5-8d14-11833646fb8b',
    );
  });

  it('surfaces typed upstream errors without losing the service status', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json(
        {
          type: 'about:blank',
          title: 'Forbidden',
          status: 403,
          code: 'INSUFFICIENT_SCOPE',
          request_id: 'req-9',
        },
        { status: 403 },
      ),
    );

    await expect(
      predict('http://prediction-service:8000', 'token', predictionRequest, {
        fetcher,
      }),
    ).rejects.toMatchObject({
      status: 403,
      problem: { code: 'INSUFFICIENT_SCOPE' },
    });
  });

  it('rejects a successful response that does not match the prediction DTO', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json({ prediction: 0.95 }));

    await expect(
      predict('http://prediction-service:8000', 'token', predictionRequest, {
        fetcher,
      }),
    ).rejects.toMatchObject({ status: 502 });
  });

  it('maps connector timeout to a dedicated error', async () => {
    const fetcher = vi.fn<typeof fetch>().mockImplementation(
      (_input, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () =>
            reject(new DOMException('Aborted', 'AbortError')),
          );
        }),
    );

    await expect(
      predict('http://prediction-service:8000', 'token', predictionRequest, {
        fetcher,
        timeoutMs: 1,
      }),
    ).rejects.toBeInstanceOf(MlServiceTimeoutError);
  });
});
