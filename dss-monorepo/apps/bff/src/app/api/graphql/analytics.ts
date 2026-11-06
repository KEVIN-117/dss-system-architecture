import { GraphQLError, GraphQLScalarType, Kind } from 'graphql';
import type { AuthenticatedRequest } from '../_lib/auth-guard';
import { getOlapServiceUrl, getPredictionServiceUrl } from '../../../lib/bff-config';
import {
  executeServerOlapQuery,
  getServerOlapCubeSchema,
  listServerOlapCubes,
  searchServerOlapMembers,
  OlapServerClientError,
  type OlapQueryRequest,
  type OlapServerConfig,
} from '@dss-monorepo/olap-connector/server';
import { resolvePermissions } from '@dss-monorepo/rbac-server';
import type { AcademicContext, DSSRole } from '@dss-monorepo/auth-models';

export interface AcademicScope {
  kind: 'global' | 'faculty' | 'career';
  contexts: AcademicContext[];
}

interface ScopeFilterBinding {
  dimension: string;
  hierarchy: string;
  level: string;
  memberTemplate: string;
}

const JSONScalar = new GraphQLScalarType({
  name: 'JSON',
  description: 'JSON value returned by a live OLAP schema or result.',
  serialize: (value) => value,
  parseValue: (value) => value,
  parseLiteral: (node) => parseJsonLiteral(node),
});

// Saiku masks every measure in cells with fewer than k rows when this count
// measure is present. Keep it in the server-to-server query and strip it from
// the public GraphQL response unless the caller explicitly asked for it.
const PRIVACY_COUNT_MEASURE = 'Attempt Count';

export const analyticsTypeDefs = `#graphql
  scalar JSON
  enum CubeFilterOperator { IN NOT_IN BETWEEN DESCENDANTS_OF RELATIVE }
  enum SortDirection { ASC DESC }
  type AcademicScope {
    kind: String!
    facultyIds: [Int!]!
    careerIds: [String!]!
  }
  type Viewer {
    id: ID!
    username: String!
    displayName: String!
    roles: [String!]!
    academicScope: AcademicScope!
  }
  type OlapCube {
    cubeId: ID!
    connectionName: String!
    catalog: String!
    schema: String!
    cubeName: String!
    cubeCaption: String
    defaultMeasure: String
    measureCount: Int
  }
  type OlapCubeMember {
    name: String!
    uniqueName: String!
    caption: String
  }
  type AnalyticResult {
    status: String!
    queryId: ID
    data: [JSON!]!
    metadata: JSON
    totalRows: Int
    runtimeMs: Int
  }
  type PredictionPublicationResult {
    publication: JSON
  }
  input CubeAxisInput {
    dimension: String!
    hierarchy: String
    level: String!
    members: [String!]
  }
  input CubeFilterInput {
    dimension: String!
    hierarchy: String
    level: String!
    op: CubeFilterOperator
    members: [String!]
    value: String
    n: Int
  }
  input MeasureInput { name: String! }
  input SortInput { by: String!, direction: SortDirection }
  input AnalyticQueryInput {
    cubeId: ID!
    measures: [MeasureInput!]!
    rows: [CubeAxisInput!]
    columns: [CubeAxisInput!]
    filters: [CubeFilterInput!]
    order: [SortInput!]
    limit: Int
  }
  extend type Query {
    viewer: Viewer!
    olapCubes: [OlapCube!]!
    olapCubeSchema(cubeId: ID!): JSON!
    olapCubeMembers(cubeId: ID!, dimension: String!, hierarchy: String!, level: String!, limit: Int): [OlapCubeMember!]!
    analyticQuery(input: AnalyticQueryInput!): AnalyticResult!
    predictionPublication(programRef: String!, cutId: String!, limit: Int, offset: Int): PredictionPublicationResult!
  }
`;

export function createAnalyticsResolvers() {
  return {
    JSON: JSONScalar,
    Query: {
      viewer: (_: unknown, __: unknown, context: { authentication: AuthenticatedRequest }) => {
        const { user, roles } = context.authentication;
        const scope = deriveAcademicScope(roles, user.academicContexts ?? []);
        return {
          id: user.id,
          username: user.username,
          displayName: [user.firstName, user.lastName].filter(Boolean).join(' '),
          roles,
          academicScope: {
            kind: scope.kind,
            facultyIds: [...new Set(scope.contexts.flatMap((item) => item.facultyId === null ? [] : [item.facultyId]))],
            careerIds: [...new Set(scope.contexts.flatMap((item) => item.careerId === null ? [] : [item.careerId]))],
          },
        };
      },
      olapCubes: async (_: unknown, __: unknown, context: { authentication: AuthenticatedRequest }) => {
        requireAnalyticsRead(context.authentication.roles);
        const cubes = await olapCall(() => listServerOlapCubes(serverConfig(context.authentication)));
        return cubes.map((cube) => ({ ...cube, cubeId: toCubeId(cube) }));
      },
      olapCubeSchema: async (_: unknown, args: { cubeId: string }, context: { authentication: AuthenticatedRequest }) => {
        requireAnalyticsRead(context.authentication.roles);
        validateCubeId(args.cubeId);
        await requireVisibleCube(context.authentication, args.cubeId);
        return olapCall(() => getServerOlapCubeSchema(serverConfig(context.authentication), args.cubeId));
      },
      olapCubeMembers: async (
        _: unknown,
        args: { cubeId: string; dimension: string; hierarchy: string; level: string; limit?: number | null },
        context: { authentication: AuthenticatedRequest },
      ) => {
        requireAnalyticsRead(context.authentication.roles);
        validateCubeId(args.cubeId);
        for (const value of [args.dimension, args.hierarchy, args.level]) {
          if (!validName(value)) throw new GraphQLError('A published cube dimension, hierarchy, and level are required', { extensions: { code: 'BAD_USER_INPUT' } });
        }
        const limit = args.limit ?? 100;
        if (!Number.isInteger(limit) || limit < 1 || limit > 500) {
          throw new GraphQLError('Member limit must be between 1 and 500', { extensions: { code: 'BAD_USER_INPUT' } });
        }
        await requireVisibleCube(context.authentication, args.cubeId);
        const config = serverConfig(context.authentication);
        const schema = await olapCall(() => getServerOlapCubeSchema(config, args.cubeId));
        if (!hasPublishedCubeLevel(schema, args.dimension, args.hierarchy, args.level)) {
          throw new GraphQLError('The requested level is not part of the published cube schema', { extensions: { code: 'BAD_USER_INPUT' } });
        }
        return olapCall(() => searchServerOlapMembers(config, {
          cubeId: args.cubeId,
          dimension: args.dimension,
          hierarchy: args.hierarchy,
          level: args.level,
          limit,
        }));
      },
      predictionPublication: async (
        _: unknown,
        args: { programRef: string; cutId: string; limit?: number | null; offset?: number | null },
        context: { authentication: AuthenticatedRequest },
      ) => {
        // Resolve the analytics role/scope from trusted Auth Service data first.
        // Prediction Service repeats the scope check against the selected program/cut.
        deriveAcademicScope(context.authentication.roles, context.authentication.user.academicContexts ?? []);
        if (!args.programRef.trim() || !args.cutId.trim()) {
          throw new GraphQLError('Program and academic cut are required', { extensions: { code: 'BAD_USER_INPUT' } });
        }
        let baseUrl: string;
        try { baseUrl = getPredictionServiceUrl(); }
        catch { throw new GraphQLError('Prediction Service is unavailable', { extensions: { code: 'PREDICTION_UNAVAILABLE', http: { status: 503 } } }); }
        const query = new URLSearchParams({
          program_ref: args.programRef,
          cut_id: args.cutId,
          limit: String(Math.min(Math.max(args.limit ?? 100, 1), 1000)),
          offset: String(Math.min(Math.max(args.offset ?? 0, 0), 25000)),
        });
        try {
          const response = await fetch(`${baseUrl.replace(/\/$/, '')}/v1/prediction-publications?${query}`, {
            headers: { Authorization: `Bearer ${context.authentication.token}` },
            cache: 'no-store',
            signal: AbortSignal.timeout(15000),
          });
          if (!response.ok) {
            const code = response.status === 403 ? 'FORBIDDEN' : response.status === 404 ? 'NOT_FOUND' : 'PREDICTION_QUERY_FAILED';
            throw new GraphQLError('Prediction publication query failed', { extensions: { code, http: { status: response.status } } });
          }
          return await response.json() as { publication: unknown };
        } catch (error) {
          if (error instanceof GraphQLError) throw error;
          throw new GraphQLError('Prediction Service is unavailable', { extensions: { code: 'PREDICTION_UNAVAILABLE', http: { status: 503 } } });
        }
      },
      analyticQuery: async (_: unknown, args: { input: AnalyticQueryInput }, context: { authentication: AuthenticatedRequest }) => {
        const { authentication } = context;
        const scope = deriveAcademicScope(authentication.roles, authentication.user.academicContexts ?? []);
        validateAnalyticInput(args.input);
        const config = serverConfig(authentication);
        await requireVisibleCube(authentication, args.input.cubeId);
        const scopeFilter = buildScopeFilter(scope);
        rejectClientScopeOverrides(args.input, scopeFilter);

        const exposesPrivacyCount = args.input.measures.some(
          (measure) => normalizeMeasureName(measure.name) === normalizeMeasureName(PRIVACY_COUNT_MEASURE),
        );
        const measures = exposesPrivacyCount
          ? args.input.measures
          : [...args.input.measures, { name: PRIVACY_COUNT_MEASURE }];
        const request: OlapQueryRequest = {
          cube: args.input.cubeId,
          measures,
          rows: args.input.rows,
          columns: args.input.columns,
          filters: [
            ...(args.input.filters ?? []).map((filter) => ({
              ...filter,
              op: filter.op?.toLowerCase() as NonNullable<NonNullable<OlapQueryRequest['filters']>[number]['op']> | undefined,
            })),
            ...(scopeFilter ? [scopeFilter] : []),
          ],
          order: args.input.order?.map((sort) => ({
            ...sort,
            direction: sort.direction?.toLowerCase() as 'asc' | 'desc' | undefined,
          })),
          limit: args.input.limit ?? 0,
          nonEmpty: true,
        };
        const result = await olapCall(() => executeServerOlapQuery(config, request));
        if (result.error || (result.status && result.status !== 'SUCCESS')) {
          throw queryResultError(result);
        }
        return {
          status: result.status ?? 'SUCCESS',
          queryId: result.queryId,
          data: exposesPrivacyCount ? result.data ?? [] : stripPrivacyCount(result.data ?? []),
          metadata: result.metadata ?? null,
          totalRows: result.totalRows ?? result.data?.length ?? 0,
          runtimeMs: result.runtimeMs ?? null,
        };
      },
    },
  };
}

function hasPublishedCubeLevel(schema: Record<string, unknown>, dimensionName: string, hierarchyName: string, levelName: string): boolean {
  const dimensions = schema.dimensions;
  if (!isRecord(dimensions)) return false;
  const dimension = Object.values(dimensions).find((item) => isRecord(item) && sameName(item.name, dimensionName));
  if (!isRecord(dimension) || !isRecord(dimension.hierarchies)) return false;
  const hierarchy = Object.values(dimension.hierarchies).find((item) => isRecord(item) && sameName(item.name, hierarchyName));
  if (!isRecord(hierarchy) || !isRecord(hierarchy.levels)) return false;
  return Object.values(hierarchy.levels).some((item) => isRecord(item) && sameName(item.name, levelName));
}

function sameName(left: unknown, right: string): boolean {
  return typeof left === 'string' && left.toLocaleLowerCase() === right.toLocaleLowerCase();
}

function normalizeMeasureName(name: string): string {
  return name.trim().toLocaleLowerCase();
}

function stripPrivacyCount(rows: Array<Record<string, unknown>>): Array<Record<string, unknown>> {
  return rows.map((row) => Object.fromEntries(
    Object.entries(row).filter(([key]) => normalizeMeasureName(key) !== normalizeMeasureName(PRIVACY_COUNT_MEASURE)),
  ));
}

export interface AnalyticQueryInput {
  cubeId: string;
  measures: Array<{ name: string }>;
  rows?: Array<{ dimension: string; hierarchy?: string; level: string; members?: string[] }>;
  columns?: Array<{ dimension: string; hierarchy?: string; level: string; members?: string[] }>;
  filters?: Array<{ dimension: string; hierarchy?: string; level: string; op?: 'in' | 'not_in' | 'between' | 'descendants_of' | 'relative' | 'IN' | 'NOT_IN' | 'BETWEEN' | 'DESCENDANTS_OF' | 'RELATIVE'; members?: string[]; value?: string; n?: number }>;
  order?: Array<{ by: string; direction?: 'asc' | 'desc' | 'ASC' | 'DESC' }>;
  limit?: number | null;
}

export function deriveAcademicScope(roles: readonly DSSRole[], contexts: readonly AcademicContext[]): AcademicScope {
  const permissions = resolvePermissions(roles);
  if (!permissions.has('analytics:read')) throw authorizationError('Analytics access is not permitted', 'FORBIDDEN');
  if (roles.includes('RECTOR')) return { kind: 'global', contexts: [] };
  if (roles.includes('DECANO')) {
    const scoped = contexts.filter((item) => item.facultyId !== null && item.careerId === null);
    if (!scoped.length) throw authorizationError('Academic faculty context is required', 'ACADEMIC_CONTEXT_REQUIRED');
    return { kind: 'faculty', contexts: scoped };
  }
  if (roles.includes('DIRECTOR')) {
    const scoped = contexts.filter((item) => item.facultyId !== null && item.careerId !== null);
    if (!scoped.length) throw authorizationError('Academic career context is required', 'ACADEMIC_CONTEXT_REQUIRED');
    return { kind: 'career', contexts: scoped };
  }
  throw authorizationError('Analytics access is not permitted', 'FORBIDDEN');
}

function requireAnalyticsRead(roles: readonly DSSRole[]): void {
  if (!resolvePermissions(roles).has('analytics:read')) throw authorizationError('Analytics access is not permitted', 'FORBIDDEN');
}

function serverConfig(authentication: AuthenticatedRequest): OlapServerConfig {
  try {
    return { baseUrl: getOlapServiceUrl(), accessToken: authentication.token };
  } catch {
    throw new GraphQLError('OLAP service is unavailable', { extensions: { code: 'OLAP_UNAVAILABLE' } });
  }
}

async function requireVisibleCube(authentication: AuthenticatedRequest, cubeId: string): Promise<void> {
  const cubes = await olapCall(() => listServerOlapCubes(serverConfig(authentication)));
  if (!cubes.some((cube) => toCubeId(cube) === cubeId)) {
    throw authorizationError('Cube is not available to this account', 'CUBE_FORBIDDEN');
  }
}

function buildScopeFilter(scope: AcademicScope): NonNullable<OlapQueryRequest['filters']>[number] | null {
  if (scope.kind === 'global') return null;
  const binding = readScopeBinding(scope.kind);
  const ids = scope.kind === 'faculty'
    ? scope.contexts.flatMap((item) => item.facultyId === null ? [] : [String(item.facultyId)])
    : scope.contexts.flatMap((item) => item.careerId === null ? [] : [item.careerId]);
  if (scope.kind === 'career' && ids.some((id) => !/^[A-Za-z0-9]{3}$/.test(id))) {
    throw authorizationError('Academic career context is invalid', 'ACADEMIC_CONTEXT_INVALID');
  }
  const members = [...new Set(ids)].map((id) => binding.memberTemplate.replaceAll('{id}', id));
  if (!members.length) throw authorizationError('No academic scope is available', 'ACADEMIC_CONTEXT_REQUIRED');
  return { dimension: binding.dimension, hierarchy: binding.hierarchy, level: binding.level, op: 'in', members };
}

function readScopeBinding(kind: 'faculty' | 'career'): ScopeFilterBinding {
  let value: unknown;
  try { value = JSON.parse(process.env.OLAP_ACADEMIC_SCOPE_FILTERS ?? 'null') as unknown; }
  catch { throw authorizationError('Academic analytics scope is not configured', 'SCOPE_CONFIGURATION_ERROR'); }
  const candidate = isRecord(value) ? value[kind] : undefined;
  if (!isRecord(candidate) || !['dimension', 'hierarchy', 'level', 'memberTemplate'].every((key) => typeof candidate[key] === 'string' && candidate[key].trim())) {
    throw authorizationError('Academic analytics scope is not configured', 'SCOPE_CONFIGURATION_ERROR');
  }
  const binding = candidate as unknown as ScopeFilterBinding;
  if (!binding.memberTemplate.includes('{id}')) throw authorizationError('Academic analytics scope is invalid', 'SCOPE_CONFIGURATION_ERROR');
  return binding;
}

function rejectClientScopeOverrides(input: AnalyticQueryInput, binding: ReturnType<typeof buildScopeFilter>): void {
  if (!binding) return;
  const hierarchy = binding.hierarchy?.toLocaleLowerCase();
  const dimension = binding.dimension.toLocaleLowerCase();
  const selections = [...(input.rows ?? []), ...(input.columns ?? []), ...(input.filters ?? [])];
  if (selections.some((item) => item.dimension.toLocaleLowerCase() === dimension || item.hierarchy?.toLocaleLowerCase() === hierarchy)) {
    throw new GraphQLError('The academic scope filter is controlled by the server', {
      extensions: { code: 'SCOPE_FILTER_IMMUTABLE' },
    });
  }
}

function validateAnalyticInput(input: AnalyticQueryInput): void {
  validateCubeId(input?.cubeId);
  if (!Array.isArray(input.measures) || input.measures.length < 1 || input.measures.length > 12 || input.measures.some((item) => !validName(item?.name))) {
    throw new GraphQLError('One to twelve valid measures are required', { extensions: { code: 'INVALID_ARGUMENT' } });
  }
  if ((input.rows?.length ?? 0) > 6 || (input.columns?.length ?? 0) > 6 || (input.filters?.length ?? 0) > 20 || (input.order?.length ?? 0) > 4) {
    throw new GraphQLError('The query exceeds the supported axis or filter limits', { extensions: { code: 'INVALID_ARGUMENT' } });
  }
  for (const axis of [...(input.rows ?? []), ...(input.columns ?? [])]) {
    if (!validName(axis.dimension) || !validName(axis.level) || (axis.hierarchy !== undefined && !validName(axis.hierarchy)) || (axis.members?.length ?? 0) > 100) {
      throw new GraphQLError('Invalid query axis', { extensions: { code: 'INVALID_ARGUMENT' } });
    }
  }
  for (const filter of input.filters ?? []) {
    if (!validName(filter.dimension) || !validName(filter.level) || (filter.hierarchy !== undefined && !validName(filter.hierarchy)) || (filter.members?.length ?? 0) > 100 || (filter.op !== undefined && !['in', 'not_in', 'between', 'descendants_of', 'relative'].includes(filter.op.toLowerCase()))) {
      throw new GraphQLError('Invalid query filter', { extensions: { code: 'INVALID_ARGUMENT' } });
    }
  }
  if (input.limit !== null && input.limit !== undefined && (!Number.isInteger(input.limit) || input.limit < 0 || input.limit > 500)) {
    throw new GraphQLError('Query limit must be between 0 and 500', { extensions: { code: 'INVALID_ARGUMENT' } });
  }
}

function validateCubeId(value: string): void {
  if (typeof value !== 'string' || value.split('/').length !== 4 || value.split('/').some((part) => !validName(part))) {
    throw new GraphQLError('Cube identifier must contain connection/catalog/schema/cube', { extensions: { code: 'INVALID_ARGUMENT' } });
  }
}

function validName(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= 180 && !/[\r\n]/.test(value) && !value.includes(String.fromCharCode(0));
}

function toCubeId(cube: { connectionName: string; catalog: string; schema: string; cubeName: string }): string {
  return [cube.connectionName, cube.catalog, cube.schema, cube.cubeName].join('/');
}

async function olapCall<T>(operation: () => Promise<T>): Promise<T> {
  try { return await operation(); }
  catch (error) {
    if (error instanceof OlapServerClientError) {
      const code = error.status === 504 ? 'OLAP_TIMEOUT' : error.code;
      throw new GraphQLError(error.message, { extensions: { code, http: { status: error.status } } });
    }
    throw new GraphQLError('OLAP service is unavailable', { extensions: { code: 'OLAP_UNAVAILABLE' } });
  }
}

function authorizationError(message: string, code: string): GraphQLError {
  return new GraphQLError(message, { extensions: { code, http: { status: 403 } } });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseJsonLiteral(node: Parameters<NonNullable<GraphQLScalarType['parseLiteral']>>[0]): unknown {
  switch (node.kind) {
    case Kind.STRING:
    case Kind.BOOLEAN: return node.value;
    case Kind.INT: return Number.parseInt(node.value, 10);
    case Kind.FLOAT: return Number.parseFloat(node.value);
    case Kind.NULL: return null;
    case Kind.LIST: return node.values.map(parseJsonLiteral);
    case Kind.OBJECT: return Object.fromEntries(node.fields.map((field) => [field.name.value, parseJsonLiteral(field.value)]));
    default: return undefined;
  }
}

function queryResultError(result: { status?: string; error?: string; field?: string; available?: string[] }): GraphQLError {
  const status = result.status?.toUpperCase();
  const normalized = status === 'TIMEOUT'
    ? { code: 'OLAP_TIMEOUT', httpStatus: 504, message: 'OLAP query timed out' }
    : status === 'VALIDATION_ERROR'
      ? { code: 'OLAP_INVALID_QUERY', httpStatus: 400, message: 'OLAP rejected the query definition' }
      : status === 'PERMISSION_DENIED'
        ? { code: 'OLAP_FORBIDDEN', httpStatus: 403, message: 'The OLAP user cannot access this query' }
        : status === 'RATE_LIMITED'
          ? { code: 'OLAP_RATE_LIMITED', httpStatus: 429, message: 'OLAP query rate limit exceeded' }
          : status === 'CUBE_NOT_FOUND'
            ? { code: 'CUBE_FORBIDDEN', httpStatus: 404, message: 'The requested OLAP cube is unavailable' }
            : { code: 'OLAP_QUERY_FAILED', httpStatus: 502, message: 'OLAP could not execute the requested query' };

  return new GraphQLError(normalized.message, {
    extensions: {
      code: normalized.code,
      http: { status: normalized.httpStatus },
      ...(validName(result.field) ? { field: result.field } : {}),
      ...(Array.isArray(result.available) && result.available.every(validName) ? { available: result.available } : {}),
    },
  });
}
