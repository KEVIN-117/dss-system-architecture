import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { parse } from 'yaml';

export type ApiParameter = {
  name: string;
  location: string;
  required: boolean;
  description?: string;
  schemaType?: string;
};

export type ApiSchemaField = {
  name: string;
  type: string;
  required: boolean;
  description?: string;
};

export type ApiResponse = {
  status: string;
  description: string;
  contentTypes: string[];
};

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
  permission?: string;
  parameters: ApiParameter[];
  requestContentType?: string;
  requestFields: ApiSchemaField[];
  requestRequired: boolean;
  responses: ApiResponse[];
};

export type ApiService = {
  id: string;
  name: string;
  version: string;
  sourcePath: string;
  operations: ApiOperation[];
};

function findRepositoryRoot(): string {
  const candidates = [
    path.resolve(process.cwd(), '..', '..', '..'),
    path.resolve(process.cwd(), '..'),
    process.cwd(),
  ];

  const root = candidates.find((candidate) => existsSync(path.join(candidate, 'docs')));

  if (!root) {
    throw new Error('No se encontró el directorio docs del repositorio.');
  }

  return root;
}

function discoverOpenApiContracts(root: string): Array<{ id: string; sourcePath: string }> {
  const docsRoot = path.join(root, 'docs');
  const files: string[] = [];
  const visit = (directory: string) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const absolutePath = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(absolutePath);
      else if (/\.ya?ml$/i.test(entry.name)) files.push(absolutePath);
    }
  };

  visit(docsRoot);

  return files.flatMap((absolutePath) => {
    const document = parse(readFileSync(absolutePath, 'utf8'));
    if (typeof document?.openapi !== 'string' || !document.paths) return [];
    const sourcePath = path.relative(root, absolutePath).split(path.sep).join('/');
    return [{ id: sourcePath.replace(/^docs\//, '').replace(/\.ya?ml$/i, '').replace(/[^a-z0-9]+/gi, '-'), sourcePath }];
  }).sort((left, right) => left.sourcePath.localeCompare(right.sourcePath));
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
  if (resolved?.type) {
    return Array.isArray(resolved.type) ? resolved.type.join(' | ') : resolved.type;
  }
  return resolved?.enum ? resolved.enum.join(' | ') : 'object';
}

function fieldsForSchema(document: any, schema: any): ApiSchemaField[] {
  const resolved = resolveSchemaRef(document, schema);
  const required = new Set<string>(resolved?.required ?? []);

  return Object.entries(resolved?.properties ?? {}).map(([name, field]: [string, any]) => {
    const property = resolveSchemaRef(document, field);
    return {
      name,
      type: schemaType(field, document),
      required: required.has(name),
      description: property?.description,
    };
  });
}

function joinPath(serverUrl: string | undefined, endpointPath: string): string {
  const prefix = serverUrl?.startsWith('http') ? new URL(serverUrl).pathname : serverUrl;
  const combined = `${prefix ?? ''}/${endpointPath}`.replace(/\/{2,}/g, '/');
  return combined.startsWith('/') ? combined : `/${combined}`;
}

function operationAuth(document: any, operation: any): string {
  const requirements = operation.security ?? document.security ?? [];
  if (requirements.length === 0) return 'Sin autenticación declarada';

  return requirements
    .flatMap((requirement: Record<string, string[]>) => Object.keys(requirement))
    .map((name: string) => {
      const scheme = document.components?.securitySchemes?.[name];
      if (scheme?.type === 'http' && scheme.scheme === 'bearer') return 'Bearer token';
      if (scheme?.type === 'openIdConnect') return 'OpenID Connect';
      return name;
    })
    .join(', ');
}

function parseContract(id: string, sourcePath: string, root: string): ApiService {
  const document = parse(readFileSync(path.join(root, sourcePath), 'utf8'));
  const serverUrl = document.servers?.[0]?.url;
  const operations: ApiOperation[] = [];

  for (const [route, pathItem] of Object.entries<any>(document.paths ?? {})) {
    for (const [method, operation] of Object.entries<any>(pathItem)) {
      if (!['get', 'post', 'put', 'patch', 'delete', 'options', 'head'].includes(method)) continue;

      const body = resolveSchemaRef(document, operation.requestBody);
      const content = body?.content ?? {};
      const requestContentType = Object.keys(content)[0];
      const requestSchema = content[requestContentType]?.schema;
      const responses = Object.entries<any>(operation.responses ?? {}).map(([status, unresolvedResponse]) => {
        const response = resolveSchemaRef(document, unresolvedResponse);
        return {
          status,
          description: response.description ?? 'Sin descripción en el contrato.',
          contentTypes: Object.keys(response.content ?? {}),
        };
      });

      operations.push({
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
        auth: operationAuth(document, operation),
        permission: operation['x-required-permission'],
        parameters: [...(pathItem.parameters ?? []), ...(operation.parameters ?? [])]
          .map((parameter: any) => resolveSchemaRef(document, parameter))
          .map((parameter: any) => ({
            name: parameter.name,
            location: parameter.in,
            required: Boolean(parameter.required),
            description: parameter.description,
            schemaType: schemaType(parameter.schema, document),
          })),
        requestContentType,
        requestFields: fieldsForSchema(document, requestSchema),
        requestRequired: Boolean(body?.required),
        responses,
      });
    }
  }

  return {
    id,
    name: document.info?.title ?? id,
    version: document.info?.version ?? 'sin versión',
    sourcePath,
    operations,
  };
}

export function getApiCatalog(): ApiService[] {
  const root = findRepositoryRoot();
  return discoverOpenApiContracts(root).map(({ id, sourcePath }) => parseContract(id, sourcePath, root));
}
