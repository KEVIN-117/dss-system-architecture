const BFF_BASE_URL =
  process.env.NEXT_PUBLIC_BFF_URL?.trim().replace(/\/$/, '') ?? '';
const OLAP_ADMIN_BASE = '/api/olap/rest/saiku/admin';
const OLAP_REPOSITORY_BASE = '/api/olap/rest/saiku/api/repository';

export interface OlapAdminSchema {
  id?: string;
  name: string;
  path?: string;
  type?: string;
}

function schemaPath(path: string): string {
  return `${BFF_BASE_URL}${OLAP_ADMIN_BASE}${path}`;
}

function requestError(status: number): Error {
  return new Error(`OLAP administration request failed (${status})`);
}

async function get<T>(path: string): Promise<T> {
  const response = await fetch(schemaPath(path), {
    credentials: 'include',
    cache: 'no-store',
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) throw requestError(response.status);
  return (await response.json()) as T;
}

async function send(
  path: string,
  method: 'POST' | 'PUT' | 'DELETE',
  body?: unknown,
): Promise<void> {
  const response = await fetch(schemaPath(path), {
    method,
    credentials: 'include',
    cache: 'no-store',
    headers: body
      ? { 'Content-Type': 'application/json', Accept: 'application/json' }
      : { Accept: 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) throw requestError(response.status);
}

export const listOlapSchemas = () => get<OlapAdminSchema[]>('/schema');

export async function getOlapSchemaXml(id: string): Promise<string> {
  const schemas = await listOlapSchemas();
  const schema = schemas.find((candidate) => candidate.name === id);
  if (!schema?.path) {
    throw new Error(`Saiku did not return a repository path for "${id}".`);
  }

  // Some Saiku builds prepend the last two characters of the workspace name
  // to repository paths (for example, "n/datasources/schema.xml"). Resolve
  // from the repository's datasources folder so those builds can still serve
  // the schema through the ACL-protected repository resource endpoint.
  const listedPath = schema.path.replaceAll('\\', '/');
  const datasourceSegment = listedPath.indexOf('datasources/');
  if (datasourceSegment < 0) {
    throw new Error(`Saiku returned an invalid repository path for "${id}".`);
  }
  const repositoryPath = `/${listedPath.slice(datasourceSegment)}`;
  const query = new URLSearchParams({ file: repositoryPath });
  const response = await fetch(
    `${BFF_BASE_URL}${OLAP_REPOSITORY_BASE}/resource?${query.toString()}`,
    {
      credentials: 'include',
      cache: 'no-store',
      headers: { Accept: 'text/plain, application/xml, text/xml' },
    },
  );
  if (!response.ok) throw requestError(response.status);
  const xml = await response.text();
  if (!xml.trim()) {
    throw new Error(
      `Saiku returned an empty schema document for "${id}". Check the schema name in the repository.`,
    );
  }
  return xml.replace(/^\uFEFF/, '');
}

export async function uploadOlapSchema(
  name: string,
  xml: string,
): Promise<void> {
  const body = new FormData();
  body.append(
    'file',
    new Blob([xml], { type: 'application/xml' }),
    `${name}.xml`,
  );
  body.append('name', name);
  const response = await fetch(
    schemaPath(`/schema/${encodeURIComponent(name)}`),
    {
      method: 'POST',
      credentials: 'include',
      cache: 'no-store',
      body,
    },
  );
  if (!response.ok) throw requestError(response.status);
}

export const deleteOlapSchema = (id: string) =>
  send(`/schema/${encodeURIComponent(id)}`, 'DELETE');
