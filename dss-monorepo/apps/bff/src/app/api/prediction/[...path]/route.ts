import {
  getTrainingJob,
  isPredictionRequest,
  isTrainingJobRequest,
  MlServiceClientError,
  MlServiceTimeoutError,
  predict,
  submitTrainingJob,
} from '@dss-monorepo/ml-connector';
import { NextResponse } from 'next/server';

import {
  BffConfigurationError,
  getPredictionServiceUrl,
} from '../../../../lib/bff-config';
import { withCors } from '../../../../lib/cors';
import { authenticateRequest } from '../../_lib/auth-guard';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ path: string[] }> };

/** Authenticated BFF facade; only the documented v1 operations are reachable. */
async function handle(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  const authentication = await authenticateRequest(request);
  if (!authentication.authenticated)
    return withCors(request, authentication.response);

  const { path } = await context.params;
  const segments = path.filter(Boolean);
  const isPrediction =
    segments.length === 2 &&
    segments[0] === 'v1' &&
    segments[1] === 'predictions';
  const isTrainingCollection =
    segments.length === 2 &&
    segments[0] === 'v1' &&
    segments[1] === 'training-jobs';
  const isTrainingItem =
    segments.length === 3 &&
    segments[0] === 'v1' &&
    segments[1] === 'training-jobs' &&
    /^[A-Za-z0-9_-]{1,128}$/.test(segments[2]);

  if (
    !(
      (request.method === 'POST' && (isPrediction || isTrainingCollection)) ||
      (request.method === 'GET' && isTrainingItem)
    )
  ) {
    return withCors(
      request,
      NextResponse.json(
        { error: 'Prediction route or method not found' },
        { status: 404 },
      ),
    );
  }

  let serviceUrl: string;
  try {
    serviceUrl = getPredictionServiceUrl();
  } catch (error) {
    if (error instanceof BffConfigurationError) {
      console.error(
        '[bff-ml] invalid Prediction Service configuration',
        error.message,
      );
      return withCors(
        request,
        NextResponse.json(
          { error: 'Prediction Service is unavailable' },
          { status: 503 },
        ),
      );
    }
    throw error;
  }

  const options = {
    signal: request.signal,
    requestId: request.headers.get('x-request-id') ?? undefined,
  };

  try {
    if (isPrediction) {
      const body = await readJson(request);
      if (!isPredictionRequest(body)) {
        return withCors(
          request,
          NextResponse.json(
            { error: 'Invalid prediction request' },
            { status: 400 },
          ),
        );
      }
      const result = await predict(
        serviceUrl,
        authentication.value.token,
        body,
        options,
      );
      return withCors(
        request,
        NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } }),
      );
    }

    if (isTrainingCollection) {
      const body = await readJson(request);
      if (!isTrainingJobRequest(body)) {
        return withCors(
          request,
          NextResponse.json(
            { error: 'Invalid training job request' },
            { status: 400 },
          ),
        );
      }
      const job = await submitTrainingJob(
        serviceUrl,
        authentication.value.token,
        body,
        request.headers.get('idempotency-key') ?? '',
        options,
      );
      return withCors(
        request,
        NextResponse.json(job, {
          status: 202,
          headers: { 'Cache-Control': 'no-store' },
        }),
      );
    }

    const job = await getTrainingJob(
      serviceUrl,
      authentication.value.token,
      segments[2],
      options,
    );
    return withCors(
      request,
      NextResponse.json(job, { headers: { 'Cache-Control': 'no-store' } }),
    );
  } catch (error) {
    if (error instanceof SyntaxError) {
      return withCors(
        request,
        NextResponse.json(
          { error: 'Request body must be valid JSON' },
          { status: 400 },
        ),
      );
    }
    if (error instanceof MlServiceTimeoutError) {
      return withCors(
        request,
        NextResponse.json(
          { error: 'Prediction Service timed out' },
          { status: 504 },
        ),
      );
    }
    if (error instanceof MlServiceClientError) {
      const status =
        error.status >= 400 && error.status < 500 ? error.status : 502;
      return withCors(
        request,
        NextResponse.json(
          {
            error: 'Prediction Service request failed',
            ...(error.problem?.code ? { code: error.problem.code } : {}),
            ...(error.problem?.request_id
              ? { requestId: error.problem.request_id }
              : {}),
          },
          { status },
        ),
      );
    }
    console.error('[bff-ml] Prediction Service request failed', error);
    return withCors(
      request,
      NextResponse.json(
        { error: 'Prediction Service is unavailable' },
        { status: 502 },
      ),
    );
  }
}

async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new SyntaxError('Invalid JSON request body');
  }
}

export const GET = handle;
export const POST = handle;
