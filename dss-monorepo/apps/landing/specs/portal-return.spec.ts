import { describe, expect, it } from 'vitest';

import {
  authCallbackPath,
  pickPortalDestination,
  portalReturnToFromLocation,
  resolvePortalReturnTo,
} from '../src/components/auth/portal-return';

const portals = {
  RECTOR: 'http://localhost:3004/',
  DECANO: 'http://localhost:3002/',
};

describe('resolvePortalReturnTo', () => {
  it('accepts absolute URLs on a configured portal origin', () => {
    expect(
      resolvePortalReturnTo(
        'http://localhost:3002/reportes/admision/sexo',
        portals,
      ),
    ).toBe('http://localhost:3002/reportes/admision/sexo');
  });

  it('rejects other hosts, relative paths and non-HTTP schemes', () => {
    expect(resolvePortalReturnTo('https://evil.test/', portals)).toBeNull();
    expect(resolvePortalReturnTo('/reportes', portals)).toBeNull();
    expect(resolvePortalReturnTo('javascript:alert(1)', portals)).toBeNull();
    expect(resolvePortalReturnTo(null, portals)).toBeNull();
  });
});

describe('pickPortalDestination', () => {
  it('reopens the requested page inside the user portal', () => {
    expect(
      pickPortalDestination(
        'http://localhost:3002/',
        'http://localhost:3002/reportes/admision/sexo',
      ),
    ).toBe('http://localhost:3002/reportes/admision/sexo');
  });

  it('falls back to the portal home for another portal or no deep link', () => {
    expect(
      pickPortalDestination(
        'http://localhost:3004/',
        'http://localhost:3002/reportes',
      ),
    ).toBe('http://localhost:3004/');
    expect(pickPortalDestination('http://localhost:3004/', null)).toBe(
      'http://localhost:3004/',
    );
  });
});

describe('portalReturnToFromLocation', () => {
  const origin = 'http://localhost:3000';

  it('reads the returnTo a portal sends to the landing login', () => {
    const search = `?returnTo=${encodeURIComponent('http://localhost:3002/reportes')}`;
    expect(portalReturnToFromLocation({ origin, search }, portals)).toBe(
      'http://localhost:3002/reportes',
    );
  });

  it('unwraps the callback URL the BFF returns after a failed sign-in', () => {
    const callback = `${origin}${authCallbackPath('http://localhost:3002/reportes')}`;
    const search = `?error=authentication_failed&returnTo=${encodeURIComponent(callback)}`;
    expect(portalReturnToFromLocation({ origin, search }, portals)).toBe(
      'http://localhost:3002/reportes',
    );
  });
});

describe('authCallbackPath', () => {
  it('only adds returnTo when there is one', () => {
    expect(authCallbackPath(null)).toBe('/auth/callback');
    expect(authCallbackPath('http://localhost:3002/x')).toBe(
      '/auth/callback?returnTo=http%3A%2F%2Flocalhost%3A3002%2Fx',
    );
  });
});
