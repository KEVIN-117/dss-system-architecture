export interface AdminUserDirectoryEntry {
  id: string;
  username: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  isActive: boolean;
  roles: string[];
  academicContexts: AcademicContext[];
}

export interface AcademicContext {
  id: string;
  userId: string;
  facultyId: number | null;
  careerId: string | null;
}

export interface AcademicContextAssignment {
  facultyId: number;
  careerId: string | null;
}

export interface AcademicFacultyOption {
  id: number;
  name: string;
}

export interface AcademicCareerOption {
  id: string;
  name: string;
  facultyId: number;
}

export interface AcademicCatalog {
  faculties: AcademicFacultyOption[];
  careers: AcademicCareerOption[];
}

export interface AdminUserDirectoryPage {
  content: AdminUserDirectoryEntry[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

export interface AdminUserDirectoryQuery {
  q?: string;
  role?: string;
  active?: boolean;
  page: number;
  size: number;
}

const BFF_BASE_URL =
  process.env.NEXT_PUBLIC_BFF_URL?.trim().replace(/\/$/, '') ?? '';

function directoryUrl(query: AdminUserDirectoryQuery): string {
  const params = new URLSearchParams({
    page: String(query.page),
    size: String(query.size),
  });
  if (query.q?.trim()) params.set('q', query.q.trim());
  if (query.role) params.set('role', query.role);
  if (query.active !== undefined) params.set('active', String(query.active));
  return `${BFF_BASE_URL}/api/admin/users?${params.toString()}`;
}

async function requestError(
  response: Response,
  fallback: string,
): Promise<Error> {
  try {
    const body: unknown = await response.json();
    if (isRecord(body) && typeof body.error === 'string')
      return new Error(body.error);
  } catch {
    // Keep a safe local error when the BFF does not return JSON.
  }
  return new Error(fallback);
}

export async function listAdminUsers(
  query: AdminUserDirectoryQuery,
  signal?: AbortSignal,
): Promise<AdminUserDirectoryPage> {
  const response = await fetch(directoryUrl(query), {
    credentials: 'include',
    cache: 'no-store',
    headers: { Accept: 'application/json' },
    signal,
  });
  if (!response.ok)
    throw await requestError(
      response,
      `No se pudo cargar el directorio (${response.status}).`,
    );
  return (await response.json()) as AdminUserDirectoryPage;
}

export async function replaceAdminUserContexts(
  userId: string,
  contexts: AcademicContextAssignment[],
  signal?: AbortSignal,
): Promise<AcademicContext[]> {
  const response = await fetch(
    `${BFF_BASE_URL}/api/admin/users/${encodeURIComponent(userId)}/academic-contexts`,
    {
      method: 'PUT',
      credentials: 'include',
      cache: 'no-store',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ contexts }),
      signal,
    },
  );
  if (!response.ok)
    throw await requestError(
      response,
      `No se pudo guardar el contexto (${response.status}).`,
    );
  return (await response.json()) as AcademicContext[];
}

export async function getAcademicCatalog(
  signal?: AbortSignal,
): Promise<AcademicCatalog> {
  const response = await fetch(`${BFF_BASE_URL}/api/admin/academic-catalog`, {
    credentials: 'include',
    cache: 'no-store',
    headers: { Accept: 'application/json' },
    signal,
  });
  if (!response.ok)
    throw await requestError(
      response,
      `No se pudo cargar el catálogo académico (${response.status}).`,
    );
  return (await response.json()) as AcademicCatalog;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
