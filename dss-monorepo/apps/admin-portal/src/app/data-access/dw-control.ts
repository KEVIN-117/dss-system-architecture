export type ClosureStatus = 'PENDIENTE' | 'CERRADO' | 'REABIERTO' | 'PROCESADO';

export interface AcademicClosure {
  closureId: number;
  gestion: number;
  periodo: number;
  status: ClosureStatus;
  effectiveAt: string | null;
  authorizedBySubject: string | null;
  createdBySubject: string;
  closureReason: string;
  version: number;
  processedRunId: string | null;
  processedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AcademicClosureEvent {
  eventId: number;
  closureId: number;
  fromStatus: ClosureStatus | null;
  toStatus: ClosureStatus;
  actorSubject: string;
  reason: string;
  runId: string | null;
  occurredAt: string;
}

export interface Page<T> {
  items: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

export interface ClosureFilters {
  gestion?: number;
  periodo?: number;
  status?: ClosureStatus;
  page: number;
  size: number;
}

export interface DwClosureCapabilities {
  canReadClosures: boolean;
  canManageClosures: boolean;
}

const BFF_BASE_URL =
  process.env.NEXT_PUBLIC_BFF_URL?.trim().replace(/\/$/, '') ?? '';
const CLOSURES_URL = `${BFF_BASE_URL}/api/admin/dw/academic-closures`;

async function requestError(
  response: Response,
  fallback: string,
): Promise<Error> {
  try {
    const body: unknown = await response.json();
    if (isRecord(body) && typeof body.error === 'string')
      return new Error(body.error);
  } catch {
    // Preserve a safe fallback for non-JSON BFF responses.
  }
  return new Error(fallback);
}

async function getJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, {
    credentials: 'include',
    cache: 'no-store',
    headers: { Accept: 'application/json' },
    signal,
  });
  if (!response.ok)
    throw await requestError(
      response,
      `Solicitud fallida (${response.status}).`,
    );
  return (await response.json()) as T;
}

async function postJson<T>(
  url: string,
  body: unknown,
  signal?: AbortSignal,
): Promise<T> {
  const response = await fetch(url, {
    method: 'POST',
    credentials: 'include',
    cache: 'no-store',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    signal,
  });
  if (!response.ok)
    throw await requestError(
      response,
      `Solicitud fallida (${response.status}).`,
    );
  return (await response.json()) as T;
}

export function getDwClosureCapabilities(
  signal?: AbortSignal,
): Promise<DwClosureCapabilities> {
  return getJson(`${BFF_BASE_URL}/api/admin/dw/capabilities`, signal);
}

export function listAcademicClosures(
  filters: ClosureFilters,
  signal?: AbortSignal,
): Promise<Page<AcademicClosure>> {
  const params = new URLSearchParams({
    page: String(filters.page),
    size: String(filters.size),
  });
  if (filters.gestion !== undefined)
    params.set('gestion', String(filters.gestion));
  if (filters.periodo !== undefined)
    params.set('periodo', String(filters.periodo));
  if (filters.status) params.set('status', filters.status);
  return getJson(`${CLOSURES_URL}?${params.toString()}`, signal);
}

export function getAcademicClosure(
  closureId: number,
  signal?: AbortSignal,
): Promise<AcademicClosure> {
  return getJson(`${CLOSURES_URL}/${closureId}`, signal);
}

export function listAcademicClosureEvents(
  closureId: number,
  page = 0,
  size = 20,
  signal?: AbortSignal,
): Promise<Page<AcademicClosureEvent>> {
  const params = new URLSearchParams({
    page: String(page),
    size: String(size),
  });
  return getJson(`${CLOSURES_URL}/${closureId}/events?${params}`, signal);
}

export function createAcademicClosure(input: {
  gestion: number;
  periodo: number;
  reason: string;
}): Promise<AcademicClosure> {
  return postJson(CLOSURES_URL, input);
}

export function closeAcademicPeriod(
  closureId: number,
  input: { effectiveAt: string; reason: string },
): Promise<AcademicClosure> {
  return postJson(`${CLOSURES_URL}/${closureId}/close`, input);
}

export function reopenAcademicPeriod(
  closureId: number,
  input: { reason: string },
): Promise<AcademicClosure> {
  return postJson(`${CLOSURES_URL}/${closureId}/reopen`, input);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
