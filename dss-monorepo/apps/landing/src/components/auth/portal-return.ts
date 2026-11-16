/**
 * Deep-link support for the shared login. A portal sends its visitor to the
 * landing with `?returnTo=<absolute portal URL>`; the landing carries it
 * through `/auth/callback` and the traffic router reopens it once the user is
 * signed in. Only origins of configured DSS portals are ever accepted, so the
 * parameter cannot be used as an open redirect.
 */

export const PORTAL_URLS = {
  SUPERADMIN: process.env.NEXT_PUBLIC_ADMIN_PORTAL_URL,
  RECTOR: process.env.NEXT_PUBLIC_RECTOR_DASHBOARD_URL,
  DECANO: process.env.NEXT_PUBLIC_DECANO_DASHBOARD_URL,
  DIRECTOR: process.env.NEXT_PUBLIC_DIRECTOR_DASHBOARD_URL,
} as const;

export type PortalRole = keyof typeof PORTAL_URLS;
export type PortalUrls = Partial<Record<PortalRole, string | undefined>>;

function httpOrigin(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) ? url.origin : null;
  } catch {
    return null;
  }
}

/**
 * Returns `returnTo` as an absolute URL when it points at one of the
 * configured portals; anything else (relative paths, other hosts, other
 * schemes) is dropped.
 */
export function resolvePortalReturnTo(
  returnTo: string | null | undefined,
  portalUrls: PortalUrls = PORTAL_URLS,
): string | null {
  const origin = httpOrigin(returnTo ?? undefined);
  if (!origin || !returnTo) return null;

  const allowed = Object.values(portalUrls).map(httpOrigin);
  return allowed.includes(origin) ? new URL(returnTo).toString() : null;
}

/**
 * Chooses where a signed-in user lands: the requested page when it belongs to
 * the portal of their role, otherwise that portal's home. A deep link into a
 * portal the user cannot open would only end on an access-denied screen.
 */
export function pickPortalDestination(
  portalUrl: string,
  returnTo: string | null,
): string {
  if (!returnTo) return portalUrl;
  return httpOrigin(returnTo) === httpOrigin(portalUrl) ? returnTo : portalUrl;
}

/** Same-origin `/auth/callback` path that carries a validated `returnTo`. */
export function authCallbackPath(returnTo: string | null): string {
  return returnTo
    ? `/auth/callback?returnTo=${encodeURIComponent(returnTo)}`
    : '/auth/callback';
}

/**
 * Validates the `returnTo` of a landing URL. After a failed sign-in the BFF
 * sends the user back with `returnTo` set to this landing's own
 * `/auth/callback?returnTo=<portal URL>`, so that wrapper is unwrapped once.
 */
export function portalReturnToFromLocation(
  location: Pick<Location, 'origin' | 'search'>,
  portalUrls: PortalUrls = PORTAL_URLS,
): string | null {
  let requested = new URLSearchParams(location.search).get('returnTo');
  try {
    const parsed = requested ? new URL(requested, location.origin) : null;
    if (
      parsed?.origin === location.origin &&
      parsed.pathname === '/auth/callback'
    ) {
      requested = parsed.searchParams.get('returnTo');
    }
  } catch {
    return null;
  }
  return resolvePortalReturnTo(requested, portalUrls);
}

/** Reads and validates `?returnTo=` from the current browser location. */
export function currentPortalReturnTo(
  portalUrls: PortalUrls = PORTAL_URLS,
): string | null {
  if (typeof window === 'undefined') return null;
  return portalReturnToFromLocation(window.location, portalUrls);
}
