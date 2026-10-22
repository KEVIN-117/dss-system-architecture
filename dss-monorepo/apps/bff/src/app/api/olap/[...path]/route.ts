import { NextResponse } from 'next/server';

import { authenticateRequest, requireRoles } from '../../_lib/auth-guard';
import {
  BffConfigurationError,
  getOlapServiceUrl,
} from '../../../../lib/bff-config';
import { withCors } from '../../../../lib/cors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ path: string[] }> };
const REQUEST_HEADERS = [
  'accept',
  'content-type',
  'if-match',
  'if-none-match',
  'range',
];
const RESPONSE_HEADERS = [
  'content-type',
  'content-disposition',
  'cache-control',
  'etag',
  'last-modified',
];
const OLAP_UPSTREAM_TIMEOUT_MS = 30_000;

async function proxy(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  const authentication = await authenticateRequest(request);
  if (!authentication.authenticated)
    return withCors(request, authentication.response);

  const { path } = await context.params;
  const safeSegments = path.filter(
    (segment) => segment && segment !== '.' && segment !== '..',
  );
  if (
    safeSegments.length < 3 ||
    safeSegments[0] !== 'rest' ||
    safeSegments[1] !== 'saiku' ||
    safeSegments.some((segment) => segment.includes('\\'))
  ) {
    return withCors(
      request,
      NextResponse.json({ error: 'Invalid OLAP path' }, { status: 400 }),
    );
  }

  // Saiku's administrative API manages OLAP infrastructure. Keep those
  // operations restricted to SUPERADMIN even when the user has a valid DSS
  // session; ordinary OLAP queries remain available to their authorized roles.
  if (safeSegments[2] === 'admin') {
    const forbidden = requireRoles(authentication.value, ['SUPERADMIN']);
    if (forbidden) return withCors(request, forbidden);
  }

  let targetBase: string;
  try {
    targetBase = getOlapServiceUrl();
  } catch (error) {
    if (error instanceof BffConfigurationError) {
      console.error('[bff] invalid OLAP configuration', error.message);
      return withCors(
        request,
        NextResponse.json(
          { error: 'OLAP service is unavailable' },
          { status: 503 },
        ),
      );
    }
    throw error;
  }

  const incoming = new URL(request.url);
  const target = new URL(
    `/${safeSegments.map(encodeURIComponent).join('/')}${incoming.search}`,
    targetBase,
  );
  const headers = new Headers({
    Authorization: `Bearer ${authentication.value.token}`,
  });
  for (const name of REQUEST_HEADERS) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }

  const timeoutController = new AbortController();
  const timeout = setTimeout(
    () => timeoutController.abort(),
    OLAP_UPSTREAM_TIMEOUT_MS,
  );
  const signal = AbortSignal.any([request.signal, timeoutController.signal]);

  try {
    const upstream = await fetch(target, {
      method: request.method,
      headers,
      body: ['GET', 'HEAD'].includes(request.method)
        ? undefined
        : await request.arrayBuffer(),
      cache: 'no-store',
      redirect: 'manual',
      signal,
    });
    const responseHeaders = new Headers();
    for (const name of RESPONSE_HEADERS) {
      const value = upstream.headers.get(name);
      if (value) responseHeaders.set(name, value);
    }
    responseHeaders.set('Cache-Control', 'no-store');
    const response = new Response(
      request.method === 'HEAD' || upstream.status === 204
        ? null
        : await upstream.arrayBuffer(),
      {
        status: upstream.status,
        statusText: upstream.statusText,
        headers: responseHeaders,
      },
    );
    return withCors(request, response);
  } catch (error) {
    if (timeoutController.signal.aborted && !request.signal.aborted) {
      return withCors(
        request,
        NextResponse.json({ error: 'OLAP service timed out' }, { status: 504 }),
      );
    }
    console.error('[bff] OLAP upstream request failed', error);
    return withCors(
      request,
      NextResponse.json(
        { error: 'OLAP service is unavailable' },
        { status: 502 },
      ),
    );
  } finally {
    clearTimeout(timeout);
  }
}

export const GET = proxy;
export const HEAD = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
