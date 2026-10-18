type AuthListener = (status: number, path: string) => void;
type ResumeListener = () => void;
type PendingOp = () => void | Promise<void>;
const OLAP_REQUEST_TIMEOUT_MS = 30_000;

const listeners = new Set<AuthListener>();
const resumeListeners = new Set<ResumeListener>();
const pendingOps = new Set<PendingOp>();

/** Build-time public BFF origin; an empty value uses the current origin. */
function bffOrigin(): string {
  const configured =
    typeof process !== 'undefined'
      ? process.env.NEXT_PUBLIC_BFF_URL
      : undefined;
  return configured?.trim().replace(/\/$/, '') ?? '';
}

/** Subscribe to expired or unauthorized BFF/OLAP responses. */
export function onAuthFailure(fn: AuthListener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function onSessionResumed(fn: ResumeListener): () => void {
  resumeListeners.add(fn);
  return () => resumeListeners.delete(fn);
}

export function notifySessionResumed(): void {
  const ops = [...pendingOps];
  pendingOps.clear();
  for (const listener of resumeListeners) listener();
  for (const operation of ops) void operation();
}

export function registerPendingOp(operation: PendingOp): () => void {
  pendingOps.add(operation);
  return () => pendingOps.delete(operation);
}

export function hasPendingOps(): boolean {
  return pendingOps.size > 0;
}

export class OlapRequestTimeoutError extends Error {
  constructor() {
    super('OLAP request timed out');
    this.name = 'OlapRequestTimeoutError';
  }
}

/**
 * Send Saiku REST traffic through the monorepo BFF. The HttpOnly BFF session
 * cookie is sent with credentials; its JWT never enters browser JavaScript.
 */
export async function olapFetch(
  input: RequestInfo | URL,
  init: RequestInit = {},
): Promise<Response> {
  const rawUrl =
    typeof input === 'string'
      ? input
      : input instanceof URL
        ? input.toString()
        : input.url;
  const source = new URL(
    rawUrl,
    typeof location === 'undefined' ? 'http://localhost' : location.origin,
  );
  const path = `${source.pathname}${source.search}${source.hash}`;

  if (!source.pathname.startsWith('/rest/saiku/')) {
    throw new TypeError(
      `OLAP connector only accepts /rest/saiku requests: ${source.pathname}`,
    );
  }

  const target = `${bffOrigin()}/api/olap${path}`;
  const timeoutController = new AbortController();
  const timeout = setTimeout(
    () => timeoutController.abort(),
    OLAP_REQUEST_TIMEOUT_MS,
  );
  const signal = init.signal
    ? AbortSignal.any([init.signal, timeoutController.signal])
    : timeoutController.signal;

  let response: Response;
  try {
    response = await fetch(target, {
      ...init,
      signal,
      credentials: 'include',
      cache: 'no-store',
    });
  } catch (error) {
    if (timeoutController.signal.aborted && !init.signal?.aborted) {
      throw new OlapRequestTimeoutError();
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }

  if (response.status === 401 || response.status === 403) {
    const carveOut =
      /\/rest\/saiku\/(session|admin\/version|demo\/gate)(?:\/|$)/.test(
        source.pathname,
      );
    if (!carveOut)
      for (const listener of listeners) listener(response.status, path);
  }

  return response;
}
