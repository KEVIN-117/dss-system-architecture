import { MlRequestValidationError, MlServiceClientError, MlServiceTimeoutError } from '@dss-monorepo/ml-connector';
import type { DSSPermission } from '@dss-monorepo/rbac-server';
import { NextResponse } from 'next/server';

import { BffConfigurationError, getPredictionServiceUrl } from '../../../../../lib/bff-config';
import { withCors } from '../../../../../lib/cors';
import {
  authenticateRequest,
  requirePermissions,
  type AuthenticatedRequest,
} from '../../../_lib/auth-guard';

/**
 * dss-permissions of the ML Studio routes (PRED-106). prediction-service enforces the same
 * permissions on every call; the BFF checks them first so unauthorized calls never leave it.
 */
export const ML_PERMISSIONS = {
  /** Extract datasets, train, compare, activate, roll back and launch forecasts. */
  TRAIN: 'prediction:train',
  /** Read program forecasts (aggregated counts), granted to academic authorities. */
  FORECAST_READ: 'prediction:forecast:read',
} as const satisfies Record<string, DSSPermission>;

export interface MlCallContext {
  serviceUrl: string;
  token: string;
  options: { signal: AbortSignal; requestId?: string };
  authentication: AuthenticatedRequest;
}

/**
 * Authenticate, require any of ``permissions``, call prediction-service and map its errors.
 * The response is never cached and carries the BFF CORS policy.
 */
export async function withPrediction<T>(
  request: Request,
  permissions: readonly DSSPermission[],
  action: (context: MlCallContext) => Promise<T>,
  successStatus = 200,
): Promise<Response> {
  const authentication = await authenticateRequest(request);
  if (!authentication.authenticated) return withCors(request, authentication.response);
  const forbidden = requirePermissions(authentication.value, permissions, 'any');
  if (forbidden) return withCors(request, forbidden);
  try {
    const result = await action({
      serviceUrl: getPredictionServiceUrl(),
      token: authentication.value.token,
      options: { signal: request.signal, requestId: request.headers.get('x-request-id') ?? undefined },
      authentication: authentication.value,
    });
    return withCors(request, NextResponse.json(result, { status: successStatus, headers: { 'Cache-Control': 'no-store' } }));
  } catch (error) {
    return withCors(request, mapMlError(error));
  }
}

const SAFE_DETAIL = /^[\p{L}\p{N}\s.,;:()'"%/_\-[\]{}|<>=+*!?áéíóúñÁÉÍÓÚÑ]{1,500}$/u;

/** prediction-service problems keep their status and code; 5xx and unexpected failures become 502. */
export function mapMlError(error: unknown): NextResponse {
  if (error instanceof BffConfigurationError) {
    console.error('[bff-ml] invalid Prediction Service configuration', error.message);
    return NextResponse.json({ error: 'Prediction Service is unavailable', code: 'PREDICTION_CONFIGURATION_ERROR' }, { status: 503 });
  }
  if (error instanceof MlRequestValidationError) {
    // Input validation: the request never reached prediction-service. Network
    // failures (fetch's TypeError) fall through to 502 below.
    return NextResponse.json({ error: error.message, code: 'ML_INVALID_REQUEST' }, { status: 400 });
  }
  if (error instanceof MlServiceTimeoutError) {
    return NextResponse.json({ error: 'Prediction Service timed out', code: 'PREDICTION_TIMEOUT' }, { status: 504 });
  }
  if (error instanceof MlServiceClientError) {
    const forwarded = [400, 401, 403, 404, 409, 422, 429].includes(error.status);
    const status = forwarded ? error.status : 502;
    const detail = error.problem?.detail;
    return NextResponse.json(
      {
        error: forwarded ? error.message : 'Prediction Service request failed',
        ...(error.problem?.code ? { code: error.problem.code } : {}),
        // Detail explains 409/422 (for example a search space outside its ranges); it is
        // forwarded only when it is plain text.
        ...(forwarded && typeof detail === 'string' && SAFE_DETAIL.test(detail) ? { detail } : {}),
        ...(error.problem?.request_id ? { requestId: error.problem.request_id } : {}),
      },
      { status },
    );
  }
  console.error('[bff-ml] Prediction Service request failed', error instanceof Error ? error.name : 'unknown');
  return NextResponse.json({ error: 'Prediction Service is unavailable', code: 'PREDICTION_UNAVAILABLE' }, { status: 502 });
}

export async function readJsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new MlRequestValidationError('Request body must be valid JSON');
  }
}

/** Idempotency-Key required by the operations that create jobs. */
export function idempotencyKey(request: Request): string {
  const key = request.headers.get('idempotency-key');
  if (!key) throw new MlRequestValidationError('Idempotency-Key header is required');
  return key;
}
