/* eslint-disable @typescript-eslint/no-explicit-any -- OpenAPI YAML is untyped input; every access is guarded. */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { parse } from 'yaml';

export type ApiParameter = {
  name: string;
  location: string;
  required: boolean;
  description?: string;
  schemaType?: string;
  minimum?: number;
  maximum?: number;
  defaultValue?: unknown;
  enum?: string[];
};

export type ApiSchemaField = {
  name: string;
  type: string;
  required: boolean;
  description?: string;
  children?: ApiSchemaField[];
  enum?: string[];
};

export type ApiResponse = {
  status: string;
  description: string;
  contentTypes: string[];
  schemaFields: ApiSchemaField[];
  example?: unknown;
};

export type AuthKind = 'bearer' | 'cookie' | 'none';

export type ApiOperation = {
  id: string;
  serviceId: string;
  serviceName: string;
  serviceVersion: string;
  sourcePath: string;
  method: string;
  path: string;
  summary: string;
  description?: string;
  tags: string[];
  auth: string;
  authKinds: AuthKind[];
  permission?: string;
  parameters: ApiParameter[];
  requestContentType?: string;
  requestFields: ApiSchemaField[];
  requestRequired: boolean;
  requestExample?: unknown;
  responses: ApiResponse[];
  referenceSlug: string;
};

export type ApiService = {
  id: string;
  name: string;
  version: string;
  description?: string;
  sourcePath: string;
  operations: ApiOperation[];
};

export function apiOperationSlug(operation: Pick<ApiOperation, 'method' | 'path'>): string {
  const suffix = createHash('sha1')
    .update(`${operation.method}:${operation.path}`)
    .digest('hex')
    .slice(0, 8);
  return `${operation.method.toLowerCase()}-${suffix}`;
}

/**
 * Contracts are read from the app-local snapshot (`openapi/`), produced by
 * `scripts/sync-openapi.mjs` from `<repo>/docs`. The snapshot lives inside the
 * app so it is available in the Docker context and in the standalone output
 * (see `outputFileTracingIncludes` in next.config.mjs).
 */
function findSnapshotRoot(): string {
  const candidates = [
    path.join(process.cwd(), 'openapi'),
    path.join(process.cwd(), 'apps', 'docs-portal', 'openapi'),
  ];
  const root = candidates.find((candidate) => existsSync(candidate));
  if (!root) {
    throw new Error(
      'No se encontró openapi/. Ejecuta `bun nx run @dss-monorepo/docs-portal:sync-openapi`.',
    );
  }
  return root;
}

function discoverContracts(root: string): Array<{ id: string; file: string; sourcePath: string }> {
  const files: string[] = [];
  const visit = (directory: string) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const absolutePath = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(absolutePath);
      else if (/\.ya?ml$/i.test(entry.name)) files.push(absolutePath);
    }
  };
  visit(root);

  return files
    .map((file) => {
      const relative = path.relative(root, file).split(path.sep).join('/');
      return {
        id: relative.replace(/\.ya?ml$/i, '').replace(/[^a-z0-9]+/gi, '-'),
        file,
        sourcePath: `docs/${relative}`,
      };
    })
    .sort((left, right) => left.sourcePath.localeCompare(right.sourcePath));
}

function resolveSchemaRef(document: any, schema: any): any {
  if (!schema?.$ref || !schema.$ref.startsWith('#/')) return schema;
  return schema.$ref
    .slice(2)
    .split('/')
    .reduce((current: any, key: string) => current?.[key], document);
}

function schemaType(schema: any, document: any): string {
  const resolved = resolveSchemaRef(document, schema);
  if (resolved?.type === 'array') return `array<${schemaType(resolved.items, document)}>`;
  const composed = resolved?.oneOf ?? resolved?.anyOf;
  if (composed?.length) return composed.map((item: any) => schemaType(item, document)).join(' | ');
  if (resolved?.type) {
    return Array.isArray(resolved.type) ? resolved.type.join(' | ') : resolved.type;
  }
  return resolved?.enum ? resolved.enum.join(' | ') : 'object';
}

function fieldsForSchema(document: any, schema: any, depth = 0): ApiSchemaField[] {
  if (depth > 5) return [];
  const resolved = resolveSchemaRef(document, schema);
  // A top-level array (e.g. a list response) documents its item properties.
  if (depth === 0 && resolved?.type === 'array') return fieldsForSchema(document, resolved.items, depth + 1);
  const composedSchemas = (resolved?.allOf ?? []).map((part: any) => resolveSchemaRef(document, part));
  const properties = Object.assign(
    {},
    ...composedSchemas.map((part: any) => part?.properties ?? {}),
    resolved?.properties ?? {},
  );
  const required = new Set<string>([
    ...(resolved?.required ?? []),
    ...composedSchemas.flatMap((part: any) => part?.required ?? []),
  ]);

  return Object.entries(properties).map(([name, field]: [string, any]) => {
    const property = resolveSchemaRef(document, field);
    const nestedSchema = property?.type === 'array' ? property.items : field;
    return {
      name,
      type: schemaType(field, document),
      required: required.has(name),
      description: property?.description,
      enum: property?.enum?.map(String),
      children: fieldsForSchema(document, nestedSchema, depth + 1),
    };
  });
}

function declaredExample(document: any, media: any): unknown {
  if (media?.example !== undefined) return media.example;
  const first = Object.values<any>(media?.examples ?? {})[0];
  return resolveSchemaRef(document, first)?.value;
}

function joinPath(serverUrl: string | undefined, endpointPath: string): string {
  const prefix = serverUrl?.startsWith('http') ? new URL(serverUrl).pathname : serverUrl;
  const combined = `${prefix ?? ''}/${endpointPath}`.replace(/\/{2,}/g, '/');
  return combined.startsWith('/') ? combined : `/${combined}`;
}

function operationSecurity(document: any, operation: any): { label: string; kinds: AuthKind[] } {
  const requirements: Array<Record<string, string[]>> = operation.security ?? document.security ?? [];
  const names = requirements.flatMap((requirement) => Object.keys(requirement));
  if (names.length === 0) return { label: 'Sin autenticación', kinds: ['none'] };

  const described = names.map((name) => {
    const scheme = document.components?.securitySchemes?.[name];
    if (scheme?.type === 'http' && scheme.scheme === 'bearer') {
      return { label: 'Bearer token (JWT de Keycloak)', kind: 'bearer' as const };
    }
    if (scheme?.type === 'apiKey' && scheme.in === 'cookie') {
      return { label: `Cookie de sesión \`${scheme.name}\``, kind: 'cookie' as const };
    }
    if (scheme?.type === 'openIdConnect') return { label: 'OpenID Connect', kind: 'bearer' as const };
    return { label: name, kind: 'bearer' as const };
  });
  return {
    label: described.map((item) => item.label).join(' o '),
    kinds: [...new Set(described.map((item) => item.kind))],
  };
}

function parseContract(id: string, file: string, sourcePath: string): ApiService {
  const document = parse(readFileSync(file, 'utf8'));
  const serverUrl = document.servers?.[0]?.url;
  const operations: ApiOperation[] = [];

  for (const [route, pathItem] of Object.entries<any>(document.paths ?? {})) {
    for (const [method, operation] of Object.entries<any>(pathItem)) {
      if (!['get', 'post', 'put', 'patch', 'delete', 'options', 'head'].includes(method)) continue;

      const body = resolveSchemaRef(document, operation.requestBody);
      const content = body?.content ?? {};
      const requestContentType = Object.keys(content)[0];
      const requestSchema = content[requestContentType]?.schema;
      const responses = Object.entries<any>(operation.responses ?? {}).map(([status, unresolved]) => {
        const response = resolveSchemaRef(document, unresolved) ?? {};
        const responseContent = response.content ?? {};
        const responseMedia = Object.values<any>(responseContent)[0];
        return {
          status,
          description: response.description ?? 'Sin descripción en el contrato.',
          contentTypes: Object.keys(responseContent),
          schemaFields: fieldsForSchema(document, responseMedia?.schema),
          example: declaredExample(document, responseMedia),
        };
      });
      const security = operationSecurity(document, operation);

      const parsed = {
        id: `${id}:${method}:${route}`,
        serviceId: id,
        serviceName: document.info?.title ?? id,
        serviceVersion: document.info?.version ?? 'sin versión',
        sourcePath,
        method: method.toUpperCase(),
        path: joinPath(serverUrl, route),
        summary: operation.summary ?? operation.operationId ?? `${method.toUpperCase()} ${route}`,
        description: operation.description,
        tags: operation.tags ?? [],
        auth: security.label,
        authKinds: security.kinds,
        permission: operation['x-required-permission'],
        parameters: [...(pathItem.parameters ?? []), ...(operation.parameters ?? [])]
          .map((parameter: any) => resolveSchemaRef(document, parameter))
          .map((parameter: any) => ({
            name: parameter.name,
            location: parameter.in,
            required: Boolean(parameter.required),
            description: parameter.description,
            schemaType: schemaType(parameter.schema, document),
            minimum: parameter.schema?.minimum,
            maximum: parameter.schema?.maximum,
            defaultValue: parameter.schema?.default,
            enum: parameter.schema?.enum?.map(String),
          })),
        requestContentType,
        requestFields: fieldsForSchema(document, requestSchema),
        requestRequired: Boolean(body?.required),
        requestExample: declaredExample(document, content[requestContentType]),
        responses,
      };
      operations.push({ ...parsed, referenceSlug: apiOperationSlug(parsed) });
    }
  }

  return {
    id,
    name: document.info?.title ?? id,
    version: document.info?.version ?? 'sin versión',
    description: document.info?.description,
    sourcePath,
    operations,
  };
}

let cachedCatalog: ApiService[] | undefined;

export function getApiCatalog(): ApiService[] {
  if (cachedCatalog && process.env.NODE_ENV === 'production') return cachedCatalog;
  const root = findSnapshotRoot();
  cachedCatalog = discoverContracts(root).map(({ id, file, sourcePath }) => parseContract(id, file, sourcePath));
  return cachedCatalog;
}

export function findOperation(serviceId: string, slug: string) {
  const service = getApiCatalog().find((item) => item.id === serviceId);
  const operation = service?.operations.find((item) => item.referenceSlug === slug);
  return service && operation ? { service, operation } : undefined;
}
