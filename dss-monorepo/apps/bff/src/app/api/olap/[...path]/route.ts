import { NextResponse } from 'next/server';

import { authenticateRequest, requireRoles } from '../../_lib/auth-guard';
import {
  BffConfigurationError,
  getOlapServiceUrl,
} from '../../../../lib/bff-config';
import { withCors } from '../../../../lib/cors';
import {
  AcademicScopePolicyError,
  buildAcademicScopeFilter,
  deriveAcademicScope,
} from '../../_lib/academic-scope';

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
const PRIVACY_COUNT_MEASURE = 'attempt count';

async function proxy(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  const authentication = await authenticateRequest(request);
  if (!authentication.authenticated)
    return withCors(request, authentication.response);

  const { path } = await context.params;
  // Reject malformed segments instead of silently normalizing them. Filtering
  // dot segments could turn a forbidden path into a different allowed route.
  const safeSegments = path;
  if (
    safeSegments.length < 3 ||
    safeSegments[0] !== 'rest' ||
    safeSegments[1] !== 'saiku' ||
    safeSegments.some(
      (segment) =>
        !segment ||
        segment === '.' ||
        segment === '..' ||
        segment.includes('/') ||
        segment.includes('\\') ||
        [...segment].some((character) => {
          const code = character.charCodeAt(0);
          return code < 32 || code === 127;
        }),
    )
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

  let proxiedBody: BodyInit | undefined;
  const isSuperadmin = authentication.value.roles.includes('SUPERADMIN');
  if (!isSuperadmin) {
    const roleDenied = requireRoles(authentication.value, [
      'RECTOR',
      'DECANO',
      'DIRECTOR',
    ]);
    if (roleDenied) return withCors(request, roleDenied);

    let scope;
    try {
      scope = deriveAcademicScope(
        authentication.value.roles,
        authentication.value.user.academicContexts ?? [],
      );
    } catch (error) {
      if (error instanceof AcademicScopePolicyError) {
        return withCors(
          request,
          NextResponse.json(
            { error: error.message, code: error.code },
            { status: error.code === 'SCOPE_CONFIGURATION_ERROR' ? 503 : 403 },
          ),
        );
      }
      throw error;
    }

    const isMetadataRead =
      request.method === 'GET' &&
      safeSegments[2] === authentication.value.user.username &&
      safeSegments[3] === 'discover' &&
      ((safeSegments.length === 4) ||
        (safeSegments.length === 9 && safeSegments[8] === 'metadata'));
    const isQueryExecution =
      request.method === 'POST' &&
      safeSegments.join('/') === 'rest/saiku/api/query/execute';

    if (!isMetadataRead && !isQueryExecution) {
      return withCors(
        request,
        NextResponse.json(
          { error: 'This OLAP operation is not available for this role' },
          { status: 403 },
        ),
      );
    }

    if (isQueryExecution) {
      let query: unknown;
      let rawBody: string;
      try {
        rawBody = await request.text();
        query = JSON.parse(rawBody) as unknown;
      } catch {
        return withCors(
          request,
          NextResponse.json({ error: 'Invalid OLAP query JSON' }, { status: 400 }),
        );
      }
      try {
        rejectPrivacyMeasure(query);
        proxiedBody = scope.kind === 'global'
          ? rawBody
          : JSON.stringify(
              applyScopeToQueryModel(query, buildAcademicScopeFilter(scope)),
            );
      } catch (error) {
        if (error instanceof ScopeQueryError) {
          return withCors(
            request,
            NextResponse.json(
              { error: error.message, code: error.code },
              { status: 400 },
            ),
          );
        }
        if (error instanceof AcademicScopePolicyError) {
          return withCors(
            request,
            NextResponse.json(
              { error: error.message, code: error.code },
              { status: 503 },
            ),
          );
        }
        throw error;
      }
    }
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
  const upstreamPath = `/${safeSegments.map(encodeURIComponent).join('/')}${
    incoming.pathname.endsWith('/') ? '/' : ''
  }`;
  const target = new URL(
    `${upstreamPath}${incoming.search}`,
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
        : proxiedBody ?? (await request.arrayBuffer()),
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
    let responseBody: ArrayBuffer | null =
      request.method === 'HEAD' || upstream.status === 204
        ? null
        : await upstream.arrayBuffer();
    if (
      !isSuperadmin &&
      request.method === 'GET' &&
      safeSegments.at(-1) === 'metadata' &&
      upstream.ok &&
      responseBody
    ) {
      responseBody = hidePrivacyMeasure(responseBody, upstream.headers.get('content-type'));
    }
    const response = new Response(
      responseBody,
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

class ScopeQueryError extends Error {
  constructor(message: string, readonly code: string) {
    super(message);
    this.name = 'ScopeQueryError';
  }
}

function applyScopeToQueryModel(
  value: unknown,
  scopeFilter: ReturnType<typeof buildAcademicScopeFilter>,
): unknown {
  if (!scopeFilter) return value;
  if (!isRecord(value) || value.type !== 'QUERYMODEL' || !isRecord(value.queryModel)) {
    throw new ScopeQueryError(
      'Scoped roles can execute only structured OLAP queries',
      'SCOPED_QUERY_MODEL_REQUIRED',
    );
  }
  const model = value.queryModel;
  if (!isRecord(model.axes)) {
    throw new ScopeQueryError('OLAP query axes are required', 'INVALID_QUERY');
  }
  const axes = model.axes;
  const allAxes = ['FILTER', 'COLUMNS', 'ROWS', 'PAGES'];
  for (const axisName of allAxes) {
    const axis = axes[axisName];
    if (!isRecord(axis)) {
      throw new ScopeQueryError('OLAP query axes are invalid', 'INVALID_QUERY');
    }
    if (typeof axis.mdx === 'string' && axis.mdx.trim()) {
      throw new ScopeQueryError(
        'Raw MDX is not allowed for faculty or career scoped roles',
        'SCOPED_MDX_NOT_ALLOWED',
      );
    }
    if (!Array.isArray(axis.hierarchies)) {
      throw new ScopeQueryError('OLAP query hierarchies are invalid', 'INVALID_QUERY');
    }
    const overridden = axis.hierarchies.some((item) => {
      if (!isRecord(item)) return false;
      const dimension = typeof item.dimension === 'string' ? item.dimension : '';
      const hierarchy = typeof item.name === 'string' ? item.name : '';
      return (
        dimension.toLocaleLowerCase() === scopeFilter.dimension.toLocaleLowerCase() ||
        hierarchy.toLocaleLowerCase() === scopeFilter.hierarchy.toLocaleLowerCase() ||
        hierarchy.toLocaleLowerCase() === scopeFilter.hierarchyUniqueName.toLocaleLowerCase()
      );
    });
    if (overridden) {
      throw new ScopeQueryError(
        'Academic scope is controlled by the server',
        'SCOPE_FILTER_IMMUTABLE',
      );
    }
  }

  const filterAxis = axes.FILTER as Record<string, unknown>;
  const hierarchies = filterAxis.hierarchies as unknown[];
  hierarchies.push({
    name: scopeFilter.hierarchyUniqueName,
    caption: scopeFilter.hierarchy,
    dimension: scopeFilter.dimension,
    levels: {
      [scopeFilter.level]: {
        name: scopeFilter.level,
        selection: {
          type: 'INCLUSION',
          members: scopeFilter.members.map((uniqueName) => ({
            name: uniqueName,
            uniqueName,
            caption: uniqueName,
          })),
        },
      },
    },
    cmembers: {},
  });
  return value;
}

function rejectPrivacyMeasure(value: unknown): void {
  if (!isRecord(value)) return;
  const queryModel = isRecord(value.queryModel) ? value.queryModel : null;
  const details = queryModel && isRecord(queryModel.details)
    ? queryModel.details
    : null;
  const measures = details && Array.isArray(details.measures)
    ? details.measures
    : [];
  const requested = measures.some(
    (measure) =>
      isRecord(measure) &&
      ((typeof measure.name === 'string' &&
        measure.name.trim().toLocaleLowerCase() === PRIVACY_COUNT_MEASURE) ||
        (typeof measure.uniqueName === 'string' &&
          measure.uniqueName.toLocaleLowerCase().includes(PRIVACY_COUNT_MEASURE))),
  );
  const mdx = typeof value.mdx === 'string' ? value.mdx : '';
  if (requested || mdx.toLocaleLowerCase().includes(PRIVACY_COUNT_MEASURE)) {
    throw new ScopeQueryError(
      'The internal privacy measure is not available to portal users',
      'MEASURE_FORBIDDEN',
    );
  }
}

function hidePrivacyMeasure(body: ArrayBuffer, contentType: string | null): ArrayBuffer {
  if (!contentType?.includes('application/json')) return body;
  try {
    const metadata = JSON.parse(new TextDecoder().decode(body)) as unknown;
    if (!isRecord(metadata)) return body;
    if (Array.isArray(metadata.measures)) {
      metadata.measures = metadata.measures.filter(
        (measure) =>
          !isRecord(measure) ||
          (typeof measure.name === 'string' &&
            measure.name.trim().toLocaleLowerCase() !== PRIVACY_COUNT_MEASURE &&
            (typeof measure.uniqueName !== 'string' ||
              !measure.uniqueName.toLocaleLowerCase().includes(PRIVACY_COUNT_MEASURE))),
      );
    } else if (isRecord(metadata.measures)) {
      metadata.measures = Object.fromEntries(
        Object.entries(metadata.measures).filter(([key, measure]) => {
          const name = isRecord(measure) && typeof measure.name === 'string'
            ? measure.name
            : key;
          const uniqueName = isRecord(measure) && typeof measure.uniqueName === 'string'
            ? measure.uniqueName
            : '';
          return name.trim().toLocaleLowerCase() !== PRIVACY_COUNT_MEASURE &&
            !uniqueName.toLocaleLowerCase().includes(PRIVACY_COUNT_MEASURE);
        }),
      );
    } else {
      return body;
    }
    const encoded = new TextEncoder().encode(JSON.stringify(metadata));
    return encoded.buffer.slice(
      encoded.byteOffset,
      encoded.byteOffset + encoded.byteLength,
    ) as ArrayBuffer;
  } catch {
    // Preserve the upstream response if its metadata envelope is unexpected.
    return body;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
