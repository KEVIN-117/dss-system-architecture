import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  LandingLoginRedirect,
  landingLoginUrl,
  portalReturnTo,
} from './LandingLoginRedirect';

describe('landingLoginUrl', () => {
  it('points to the landing login and forwards only known callback errors', () => {
    expect(landingLoginUrl('https://dss.example.edu/')).toBe(
      'https://dss.example.edu/login',
    );
    expect(
      landingLoginUrl('https://dss.example.edu', {
        error: 'authentication_failed',
      }),
    ).toBe('https://dss.example.edu/login?error=authentication_failed');
    expect(
      landingLoginUrl('https://dss.example.edu', { error: '<script>' }),
    ).toBe('https://dss.example.edu/login');
  });

  it('carries the page to return to', () => {
    expect(
      landingLoginUrl('https://dss.example.edu', {
        returnTo: 'https://decano.example.edu/reportes/admision/sexo',
      }),
    ).toBe(
      'https://dss.example.edu/login?returnTo=https%3A%2F%2Fdecano.example.edu%2Freportes%2Fadmision%2Fsexo',
    );
  });

  it('rejects missing or non-HTTP landing origins', () => {
    expect(landingLoginUrl(undefined)).toBeNull();
    expect(landingLoginUrl('  ')).toBeNull();
    expect(landingLoginUrl('ftp://dss.example.edu')).toBeNull();
    expect(landingLoginUrl('not a url')).toBeNull();
  });
});

describe('portalReturnTo', () => {
  const origin = 'http://localhost:3002';

  it('keeps the protected page a guard is shown on', () => {
    expect(
      portalReturnTo(
        {
          href: `${origin}/reportes/admision/sexo?corte=2026`,
          origin,
          search: '?corte=2026',
        },
        'guard',
      ),
    ).toBe(`${origin}/reportes/admision/sexo?corte=2026`);
  });

  it('reads a same-origin returnTo on the login route', () => {
    expect(
      portalReturnTo(
        {
          href: `${origin}/login`,
          origin,
          search: '?returnTo=%2Freportes%2Fadmision',
        },
        'login-route',
      ),
    ).toBe(`${origin}/reportes/admision`);
  });

  it('drops foreign origins and loops back to /login', () => {
    expect(
      portalReturnTo(
        {
          href: `${origin}/login`,
          origin,
          search: '?returnTo=https%3A%2F%2Fevil.test%2F',
        },
        'login-route',
      ),
    ).toBeNull();
    expect(
      portalReturnTo(
        { href: `${origin}/login`, origin, search: '?returnTo=%2Flogin' },
        'login-route',
      ),
    ).toBeNull();
    expect(
      portalReturnTo(
        { href: `${origin}/login`, origin, search: '' },
        'login-route',
      ),
    ).toBeNull();
  });
});

describe('LandingLoginRedirect', () => {
  const originalLocation = window.location;

  afterEach(() => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: originalLocation,
    });
  });

  function mockLocation(path: string) {
    const replace = vi.fn();
    const url = new URL(path, 'http://localhost:3002');
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        href: url.href,
        origin: url.origin,
        search: url.search,
        replace,
      },
    });
    return replace;
  }

  it('sends a protected page to the landing login and back', () => {
    const replace = mockLocation('/reportes/admision/sexo');
    render(<LandingLoginRedirect landingUrl="http://localhost:3000" />);

    const target = new URL(replace.mock.calls[0][0]);
    expect(target.origin + target.pathname).toBe('http://localhost:3000/login');
    expect(target.searchParams.get('returnTo')).toBe(
      'http://localhost:3002/reportes/admision/sexo',
    );
  });

  it('forwards the BFF callback error and returnTo from the login route', () => {
    const replace = mockLocation(
      '/login?error=authentication_failed&returnTo=%2Freportes',
    );
    render(
      <LandingLoginRedirect
        landingUrl="http://localhost:3000"
        source="login-route"
      />,
    );

    const target = new URL(replace.mock.calls[0][0]);
    expect(target.searchParams.get('error')).toBe('authentication_failed');
    expect(target.searchParams.get('returnTo')).toBe(
      'http://localhost:3002/reportes',
    );
  });

  it('explains the missing configuration instead of redirecting', () => {
    const replace = mockLocation('/');
    render(<LandingLoginRedirect landingUrl={undefined} />);

    expect(replace).not.toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent).toContain(
      'NEXT_PUBLIC_LANDING_URL',
    );
  });
});
