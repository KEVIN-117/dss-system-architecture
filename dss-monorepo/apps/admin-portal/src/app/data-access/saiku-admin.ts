const BFF_BASE_URL =
  process.env.NEXT_PUBLIC_BFF_URL?.trim().replace(/\/$/, '') ?? '';
const ADMIN_BASE = '/api/olap/rest/saiku/admin';

export interface SaikuAdminUser {
  id: number;
  username: string;
  email?: string | null;
  password?: string;
  roles: string[];
}

export interface SaikuAdminSchema {
  id?: string;
  name: string;
  path?: string;
  type?: string;
}

async function get<T>(path: string): Promise<T> {
  const response = await fetch(`${BFF_BASE_URL}${ADMIN_BASE}${path}`, {
    credentials: 'include',
    cache: 'no-store',
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) throw new Error(`${path} -> ${response.status}`);
  return (await response.json()) as T;
}

async function send(
  path: string,
  method: 'POST' | 'PUT' | 'DELETE',
  body?: unknown,
): Promise<void> {
  const response = await fetch(`${BFF_BASE_URL}${ADMIN_BASE}${path}`, {
    method,
    credentials: 'include',
    cache: 'no-store',
    headers: body
      ? { 'Content-Type': 'application/json', Accept: 'application/json' }
      : { Accept: 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) {
    const detail = (await response.text()).trim();
    throw new Error(
      detail
        ? `${path} -> ${response.status}\n${detail}`
        : `${path} -> ${response.status}`,
    );
  }
}

export const listSaikuUsers = () => get<SaikuAdminUser[]>('/users');
export const createSaikuUser = (user: SaikuAdminUser) =>
  send('/users', 'POST', user);
export const updateSaikuUser = (user: SaikuAdminUser) =>
  send(`/users/${encodeURIComponent(user.username)}`, 'PUT', user);
export const deleteSaikuUser = (username: string) =>
  send(`/users/${encodeURIComponent(username)}`, 'DELETE');

export const listSaikuSchemas = () => get<SaikuAdminSchema[]>('/schema');

export async function uploadSaikuSchema(
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
    `${BFF_BASE_URL}${ADMIN_BASE}/schema/${encodeURIComponent(name)}`,
    {
      method: 'POST',
      credentials: 'include',
      cache: 'no-store',
      body,
    },
  );
  if (!response.ok) throw new Error(`schema upload -> ${response.status}`);
}

export const deleteSaikuSchema = (id: string) =>
  send(`/schema/${encodeURIComponent(id)}`, 'DELETE');
