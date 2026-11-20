import {
  AuthServiceClientError,
  AuthServiceIamError,
  callAuthServiceIam,
  type IamHttpMethod,
} from '@dss-monorepo/auth-connector';
import { NextResponse } from 'next/server';

import { BffConfigurationError, getBffAuthConfig } from '../../../../../lib/bff-config';
import { withCors } from '../../../../../lib/cors';
import { authenticateRequest, requirePermissions } from '../../../_lib/auth-guard';
import { matchIamOperation, validateIamQuery } from '../../../_lib/iam-operations';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ path: string[] }> };

const NO_STORE = { 'Cache-Control': 'no-store' };

/**
 * `/api/admin/iam/**` → auth-service `/api/v1/admin/iam/**` (IAM-015).
 *
 * The browser never sees an administrative token: the BFF forwards the user's own access token, after
 * requiring the operation's `iam:*` permission and validating its path, query and body. auth-service
 * authorizes the user again. Responses are never cached; client secrets (create, rotate) pass through
 * once and are never logged.
 */
async function handle(request: Request, context: RouteContext, method: IamHttpMethod): Promise<Response> {
  const authentication = await authenticateRequest(request);
  if (!authentication.authenticated) return withCors(request, authentication.response);

  const { path } = await context.params;
  const match = matchIamOperation(method, path);
  if (match.kind === 'not-found') {
    return reply(request, 404, { error: 'IAM route or method not found' });
  }
  if (match.kind === 'invalid-param') {
    return reply(request, 400, { error: `Invalid ${match.param}`, code: 'INVALID_PARAMETER' });
  }
  const { operation, upstreamPath } = match;

  const forbidden = requirePermissions(authentication.value, [operation.permission]);
  if (forbidden) return withCors(request, withNoStore(forbidden));

  const query = validateIamQuery(operation, new URL(request.url).searchParams);
  if (!query) return reply(request, 400, { error: 'Invalid IAM query parameters', code: 'INVALID_QUERY' });

  let body: unknown;
  if (operation.body) {
    try {
      body = await request.json();
    } catch {
      return reply(request, 400, { error: 'Request body must be valid JSON', code: 'INVALID_JSON' });
    }
    if (!operation.body(body)) {
      return reply(request, 400, { error: 'Invalid IAM request body', code: 'INVALID_BODY' });
    }
  }

  try {
    const config = getBffAuthConfig();
    const result = await callAuthServiceIam(
      config.authServiceUrl,
      authentication.value.token,
      { method, path: upstreamPath, query, body },
      request.signal,
    );
    if (result.status === 204 || result.body === null) {
      return withCors(request, new NextResponse(null, { status: result.status === 200 ? 204 : result.status, headers: NO_STORE }));
    }
    return reply(request, result.status, result.body);
  } catch (error) {
    return withCors(request, mapIamError(error));
  }
}

/** Uniform errors: auth-service's 4xx keep their status and domain message; 5xx never leak upstream bodies. */
export function mapIamError(error: unknown): NextResponse {
  if (error instanceof BffConfigurationError) {
    console.error('[bff-iam] invalid auth-service configuration', error.message);
    return NextResponse.json({ error: 'IAM administration is unavailable' }, { status: 500, headers: NO_STORE });
  }
  if (error instanceof AuthServiceIamError && error.status >= 400 && error.status < 500) {
    return NextResponse.json(
      {
        error: 'IAM request rejected',
        ...(error.title ? { code: error.title } : {}),
        ...(error.detail ? { detail: error.detail } : {}),
      },
      { status: error.status, headers: NO_STORE },
    );
  }
  if (error instanceof AuthServiceClientError) {
    const status = error.status === 504 ? 504 : error.status === 503 ? 503 : 502;
    return NextResponse.json({ error: 'Auth service is unavailable', upstreamStatus: error.status }, { status, headers: NO_STORE });
  }
  console.error('[bff-iam] auth-service IAM request failed', error instanceof Error ? error.name : 'unknown');
  return NextResponse.json({ error: 'Auth service is unavailable' }, { status: 502, headers: NO_STORE });
}

function reply(request: Request, status: number, body: unknown): Response {
  return withCors(request, NextResponse.json(body, { status, headers: NO_STORE }));
}

function withNoStore(response: NextResponse): NextResponse {
  response.headers.set('Cache-Control', 'no-store');
  return response;
}

export const GET = (request: Request, context: RouteContext) => handle(request, context, 'GET');
export const POST = (request: Request, context: RouteContext) => handle(request, context, 'POST');
export const PUT = (request: Request, context: RouteContext) => handle(request, context, 'PUT');
export const PATCH = (request: Request, context: RouteContext) => handle(request, context, 'PATCH');
export const DELETE = (request: Request, context: RouteContext) => handle(request, context, 'DELETE');
