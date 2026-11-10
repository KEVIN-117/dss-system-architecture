/** Server-only OLAP transport for BFF resolvers. Never import this in browser code. */

export interface OlapServerConfig {
  baseUrl: string;
  accessToken: string;
  timeoutMs?: number;
}

export interface OlapCubeSummary {
  connectionName: string;
  catalog: string;
  schema: string;
  cubeName: string;
  cubeCaption?: string;
  defaultMeasure?: string;
  measureCount?: number;
}

export interface OlapLevelMember {
  name: string;
  uniqueName: string;
  caption?: string;
}

export interface OlapQueryRequest {
  cube: string;
  measures: Array<{ name: string }>;
  rows?: Array<{
    dimension: string;
    hierarchy?: string;
    level: string;
    members?: string[];
  }>;
  columns?: Array<{
    dimension: string;
    hierarchy?: string;
    level: string;
    members?: string[];
  }>;
  filters?: Array<{
    dimension: string;
    hierarchy?: string;
    level: string;
    op?: 'in' | 'not_in' | 'between' | 'descendants_of' | 'relative';
    members?: string[];
    value?: string;
    n?: number;
  }>;
  order?: Array<{ by: string; direction?: 'asc' | 'desc' }>;
  limit?: number;
  nonEmpty?: boolean;
}

export interface OlapQueryResult {
  queryId?: string;
  status?: string;
  format?: string;
  metadata?: Record<string, unknown>;
  data?: Array<Record<string, unknown>>;
  totalRows?: number;
  runtimeMs?: number;
  error?: string;
  field?: string;
  available?: string[];
}

export class OlapServerClientError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string,
    public readonly field?: string,
  ) {
    super(message);
    this.name = 'OlapServerClientError';
  }
}

/** List only cubes already visible to the authenticated OLAP principal. */
export function listServerOlapCubes(
  config: OlapServerConfig,
): Promise<OlapCubeSummary[]> {
  return requestJson(config, '/rest/saiku/api/ai/cubes', { method: 'GET' });
}

/** Fetch the live OLAP schema for a cube visible to the authenticated principal. */
export function getServerOlapCubeSchema(
  config: OlapServerConfig,
  cubeId: string,
): Promise<Record<string, unknown>> {
  return requestJson(
    config,
    `/rest/saiku/api/ai/schema/${encodeCubeId(cubeId)}`,
    { method: 'GET' },
  );
}

/** List members from one cube level using the authenticated Saiku principal. */
export function searchServerOlapMembers(
  config: OlapServerConfig,
  input: {
    cubeId: string;
    dimension: string;
    hierarchy: string;
    level: string;
    limit?: number;
  },
): Promise<OlapLevelMember[]> {
  const params = new URLSearchParams({
    cubeId: input.cubeId,
    dimension: input.dimension,
    hierarchy: input.hierarchy,
    level: input.level,
    limit: String(input.limit ?? 1000),
  });
  return requestJson(config, `/rest/saiku/api/ai/members/search?${params}`, {
    method: 'GET',
  });
}

/** Execute a typed Saiku AI query through a server-to-server bearer request. */
export function executeServerOlapQuery(
  config: OlapServerConfig,
  query: OlapQueryRequest,
): Promise<OlapQueryResult> {
  return requestJson(config, '/rest/saiku/api/ai/query?format=records', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(query),
  });
}

async function requestJson<T>(
  config: OlapServerConfig,
  path: string,
  init: RequestInit,
): Promise<T> {
  const base = new URL(config.baseUrl);
  if (
    !['http:', 'https:'].includes(base.protocol) ||
    base.username ||
    base.password ||
    base.search ||
    base.hash
  ) {
    throw new OlapServerClientError(
      'Invalid OLAP service configuration',
      503,
      'OLAP_UNAVAILABLE',
    );
  }
  const timeoutController = new AbortController();
  const timeout = setTimeout(
    () => timeoutController.abort(),
    config.timeoutMs ?? 30_000,
  );
  try {
    const response = await fetch(new URL(path, base), {
      ...init,
      headers: {
        Accept: 'application/json',
        ...init.headers,
        Authorization: `Bearer ${config.accessToken}`,
      },
      cache: 'no-store',
      redirect: 'manual',
      signal: timeoutController.signal,
    });
    const body = (await response.json().catch(() => null)) as unknown;
    if (!response.ok) {
      const code =
        response.status === 401 || response.status === 403
          ? 'OLAP_FORBIDDEN'
          : response.status === 400
            ? 'OLAP_INVALID_QUERY'
            : 'OLAP_UPSTREAM_ERROR';
      const field =
        typeof body === 'object' &&
        body !== null &&
        'field' in body &&
        typeof body.field === 'string' &&
        body.field.length <= 180 &&
        !body.field.includes(String.fromCharCode(0)) &&
        !/[\r\n]/.test(body.field)
          ? body.field
          : undefined;
      throw new OlapServerClientError(
        response.status === 504
          ? 'OLAP request timed out'
          : 'OLAP request failed',
        response.status,
        code,
        field,
      );
    }
    if (body === null || typeof body !== 'object') {
      throw new OlapServerClientError(
        'OLAP returned an invalid response',
        502,
        'OLAP_INVALID_RESPONSE',
      );
    }
    return body as T;
  } catch (error) {
    if (error instanceof OlapServerClientError) throw error;
    if (timeoutController.signal.aborted) {
      throw new OlapServerClientError(
        'OLAP request timed out',
        504,
        'OLAP_TIMEOUT',
      );
    }
    throw new OlapServerClientError(
      'OLAP service is unavailable',
      502,
      'OLAP_UNAVAILABLE',
    );
  } finally {
    clearTimeout(timeout);
  }
}

function encodeCubeId(cubeId: string): string {
  const segments = cubeId.split('/');
  if (
    segments.length !== 4 ||
    segments.some((part) => !part || part === '.' || part === '..')
  ) {
    throw new OlapServerClientError(
      'Invalid cube identifier',
      400,
      'INVALID_ARGUMENT',
    );
  }
  return segments.map(encodeURIComponent).join('/');
}
