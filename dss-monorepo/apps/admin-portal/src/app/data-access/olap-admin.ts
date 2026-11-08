const BFF_BASE_URL =
  process.env.NEXT_PUBLIC_BFF_URL?.trim().replace(/\/$/, '') ?? '';
const OLAP_ADMIN_BASE = '/api/olap/rest/saiku/admin';
const OLAP_REPOSITORY_BASE = '/api/olap/rest/saiku/api/repository';
const OLAP_DATASOURCES_PATH = '/datasources';

export interface OlapAdminSchema {
  id?: string;
  name: string;
  path?: string;
  type?: string;
}

export interface OlapAdminDatasource {
  id: string;
  name: string;
  connectiontype?: string;
  location?: string;
  driver?: string;
  schemaName?: string | null;
  username?: string;
  password?: string;
  ossieYaml?: string | null;
}

async function requestDatasources<T>(
  path = '',
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
  body?: unknown,
): Promise<T> {
  const response = await fetch(schemaPath(`${OLAP_DATASOURCES_PATH}${path}`), {
    method,
    credentials: 'include',
    cache: 'no-store',
    headers: body
      ? { 'Content-Type': 'application/json', Accept: 'application/json' }
      : { Accept: 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;
    throw new Error(
      payload?.error ?? `OLAP administration failed (${response.status}).`,
    );
  }
  if (response.status === 204) return undefined as T;
  const text = await response.text();
  if (!text.trim()) return undefined as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    // Saiku mutation endpoints may return a plain-text acknowledgement.
    return text as T;
  }
}

interface DatasourceWire {
  id?: string;
  connectionname?: string;
  connectiontype?: string;
  jdbcurl?: string;
  schema?: string;
  driver?: string;
  username?: string;
  password?: string;
  ossieYaml?: string | null;
}

function fromDatasourceWire(wire: DatasourceWire): OlapAdminDatasource {
  return {
    id: wire.id ?? '',
    name: wire.connectionname ?? '',
    connectiontype: wire.connectiontype,
    location: wire.jdbcurl ?? '',
    schemaName: wire.schema ?? null,
    driver: wire.driver ?? '',
    username: wire.username ?? '',
    ossieYaml: wire.ossieYaml ?? null,
  };
}

function toDatasourceWire(datasource: OlapAdminDatasource): DatasourceWire {
  return {
    id: datasource.id || undefined,
    connectionname: datasource.name,
    connectiontype: datasource.connectiontype,
    jdbcurl: datasource.location,
    schema: datasource.schemaName ?? undefined,
    driver: datasource.driver,
    username: datasource.username,
    password: datasource.password || undefined,
    ossieYaml: datasource.ossieYaml ?? undefined,
  };
}

export async function listOlapDatasources(): Promise<OlapAdminDatasource[]> {
  const rows = await requestDatasources<DatasourceWire[]>();
  return rows.map(fromDatasourceWire);
}

export async function createOlapDatasource(
  datasource: OlapAdminDatasource,
): Promise<void> {
  await requestDatasources('', 'POST', toDatasourceWire(datasource));
}

export async function updateOlapDatasource(
  datasource: OlapAdminDatasource,
): Promise<void> {
  await requestDatasources(
    `/${encodeURIComponent(datasource.id)}`,
    'PUT',
    toDatasourceWire(datasource),
  );
}

export async function deleteOlapDatasource(id: string): Promise<void> {
  await requestDatasources(`/${encodeURIComponent(id)}`, 'DELETE');
}

export async function refreshOlapDatasource(name: string): Promise<void> {
  await requestDatasources(`/${encodeURIComponent(name)}/refresh`, 'GET');
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
