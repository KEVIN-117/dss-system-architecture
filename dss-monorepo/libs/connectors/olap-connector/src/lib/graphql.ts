import { olapFetch } from './http.js';

const GRAPHQL_ENDPOINT = '/rest/saiku/api/graphql';
const GRAPHQL_SCHEMA_ENDPOINT = `${GRAPHQL_ENDPOINT}/schema.graphql`;

export interface OlapGraphQLRequest<TVariables extends Record<string, unknown> = Record<string, unknown>> {
  query?: string;
  operationName?: string;
  variables?: TVariables;
  extensions?: Record<string, unknown>;
}

export interface OlapGraphQLError {
  message: string;
  path?: readonly (string | number)[];
  locations?: readonly { line: number; column: number }[];
  extensions?: Record<string, unknown>;
}

export interface OlapGraphQLResponse<TData> {
  data?: TData | null;
  errors?: OlapGraphQLError[];
  extensions?: Record<string, unknown>;
}

export class OlapGraphQLClientError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly errors: readonly OlapGraphQLError[] = [],
    public readonly responseBody?: unknown,
  ) {
    super(message);
    this.name = 'OlapGraphQLClientError';
  }
}

/**
 * Calls Saiku's GraphQL API through the authenticated BFF OLAP proxy.
 * The browser sends only the HttpOnly session cookie; the BFF validates the
 * session and forwards its verified Keycloak token to olap-service.
 */
export async function executeOlapGraphQL<
  TData,
  TVariables extends Record<string, unknown> = Record<string, unknown>,
>(
  request: OlapGraphQLRequest<TVariables>,
  signal?: AbortSignal,
): Promise<OlapGraphQLResponse<TData>> {
  if (request.query !== undefined && request.query.trim().length === 0) {
    throw new TypeError('GraphQL query must not be empty');
  }

  const response = await olapFetch(GRAPHQL_ENDPOINT, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
    signal,
  });

  const text = await response.text().catch(() => '');
  const body = parseJson(text);

  if (!response.ok) {
    const errors = isGraphQLResponse<TData>(body) ? body.errors ?? [] : [];
    throw new OlapGraphQLClientError(
      response.status,
      errors[0]?.message ?? `OLAP GraphQL request failed with HTTP ${response.status}`,
      errors,
      body ?? text,
    );
  }

  if (!isGraphQLResponse<TData>(body)) {
    throw new OlapGraphQLClientError(502, 'olap-service returned an invalid GraphQL response', [], body ?? text);
  }

  return body;
}

/** Fetches the running, cube-aware SDL through the authenticated BFF proxy. */
export async function fetchOlapGraphQLSchema(signal?: AbortSignal): Promise<string> {
  const response = await olapFetch(GRAPHQL_SCHEMA_ENDPOINT, {
    method: 'GET',
    headers: { Accept: 'text/plain' },
    signal,
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new OlapGraphQLClientError(
      response.status,
      `Unable to load OLAP GraphQL schema (HTTP ${response.status})`,
      [],
      detail || undefined,
    );
  }

  return response.text();
}

/**
 * Rebuilds the dynamic GraphQL schema after cube discovery. The OLAP service
 * enforces ROLE_ADMIN for this operation, using the token forwarded by the BFF.
 */
export async function refreshOlapGraphQLSchema(signal?: AbortSignal): Promise<void> {
  const response = await olapFetch(`${GRAPHQL_ENDPOINT}/refresh`, {
    method: 'POST',
    headers: { Accept: 'application/json' },
    signal,
  });

  const text = await response.text().catch(() => '');
  if (!response.ok) {
    const body = parseJson(text);
    const errors = isGraphQLResponse<unknown>(body) ? body.errors ?? [] : [];
    throw new OlapGraphQLClientError(
      response.status,
      errors[0]?.message ?? `Unable to refresh OLAP GraphQL schema (HTTP ${response.status})`,
      errors,
      body ?? text,
    );
  }

  const body = parseJson(text);
  if (!isRecord(body) || body.status !== 'ok') {
    throw new OlapGraphQLClientError(502, 'olap-service returned an invalid GraphQL refresh response', [], body ?? text);
  }
}

function parseJson(text: string): unknown {
  if (!text) return undefined;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}

function isGraphQLResponse<TData>(value: unknown): value is OlapGraphQLResponse<TData> {
  if (!isRecord(value)) return false;

  const validData = !('data' in value) || value.data === null || isRecord(value.data);
  const validErrors = !('errors' in value) || (
    Array.isArray(value.errors) &&
    value.errors.every((error) => isRecord(error) && typeof error.message === 'string')
  );

  return validData && validErrors && ('data' in value || 'errors' in value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
