'use client';

import { useEffect, useMemo } from 'react';

/** Callback errors the landing login knows how to explain to the user. */
const FORWARDED_ERRORS = new Set(['authentication_failed']);

export interface LandingLoginTarget {
  /** Callback error to show on the landing login (only known codes pass). */
  error?: string | null;
  /** Absolute portal URL to reopen after signing in. */
  returnTo?: string | null;
}

/**
 * Builds the landing `/login` URL, the single sign-in entry point for every
 * portal. Returns `null` when the landing origin is missing or not HTTP(S).
 * The landing decides whether `returnTo` is honoured; this only carries it.
 */
export function landingLoginUrl(
  landingUrl: string | undefined,
  { error, returnTo }: LandingLoginTarget = {},
): string | null {
  if (!landingUrl?.trim()) return null;

  let target: URL;
  try {
    target = new URL('/login', landingUrl.trim());
  } catch {
    return null;
  }
  if (!['http:', 'https:'].includes(target.protocol)) return null;

  if (error && FORWARDED_ERRORS.has(error)) {
    target.searchParams.set('error', error);
  }
  if (returnTo) {
    target.searchParams.set('returnTo', returnTo);
  }
  return target.toString();
}

/**
 * Resolves the page to come back to: the current location for a protected
 * page, or the same-origin `?returnTo=` the BFF appends when it sends a failed
 * callback to the portal `/login` route. Never points back at `/login`.
 */
export function portalReturnTo(
  location: Pick<Location, 'href' | 'origin' | 'search'>,
  source: LandingLoginRedirectProps['source'],
): string | null {
  let candidate: URL;
  try {
    if (source === 'login-route') {
      const requested = new URLSearchParams(location.search).get('returnTo');
      if (!requested) return null;
      candidate = new URL(requested, location.origin);
    } else {
      candidate = new URL(location.href);
    }
  } catch {
    return null;
  }

  if (candidate.origin !== location.origin) return null;
  if (candidate.pathname === '/login') return null;
  return candidate.toString();
}

export interface LandingLoginRedirectProps {
  /** Public origin of the landing app (`NEXT_PUBLIC_LANDING_URL`). */
  landingUrl: string | undefined;
  /**
   * `guard` (default): a protected page; come back to it after signing in.
   * `login-route`: the portal `/login` route the BFF returns failed callbacks
   * to; forwards its `?error=` and `?returnTo=` to the landing.
   */
  source?: 'guard' | 'login-route';
}

/**
 * Sends a visitor without a session to the landing login instead of showing a
 * per-portal sign-in screen. After signing in, the landing brings the user
 * back to the requested page when it belongs to the portal of their role.
 */
export function LandingLoginRedirect({
  landingUrl,
  source = 'guard',
}: LandingLoginRedirectProps) {
  // Rendered on the server too, so the location is only read on the client.
  const target = useMemo(() => landingLoginUrl(landingUrl), [landingUrl]);

  useEffect(() => {
    if (!target) return;
    const error =
      source === 'login-route'
        ? new URLSearchParams(window.location.search).get('error')
        : null;
    const returnTo = portalReturnTo(window.location, source);
    window.location.replace(
      landingLoginUrl(landingUrl, { error, returnTo }) ?? target,
    );
  }, [landingUrl, source, target]);

  if (!target) {
    return (
      <main
        role="alert"
        className="flex min-h-screen flex-col items-center justify-center gap-2 p-6 text-center"
      >
        <h1 className="text-xl font-semibold">
          Inicio de sesión no configurado
        </h1>
        <p className="text-sm opacity-70">
          Este portal no tiene configurada la dirección pública de la landing
          (NEXT_PUBLIC_LANDING_URL).
        </p>
      </main>
    );
  }

  return (
    <main
      aria-busy="true"
      className="flex min-h-screen flex-col items-center justify-center gap-3 p-6 text-center"
    >
      <p className="text-sm opacity-70">Redirigiendo al inicio de sesión…</p>
      <a className="text-sm underline underline-offset-4" href={target}>
        Ir al inicio de sesión
      </a>
    </main>
  );
}
