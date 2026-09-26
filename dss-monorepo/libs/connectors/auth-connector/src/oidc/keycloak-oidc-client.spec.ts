import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  createAuthorizationUrl,
  createLogoutUrl,
  exchangeAuthorizationCode,
} from './keycloak-oidc-client.js';

const config = {
  keycloakUrl: 'https://keycloak.example.edu/auth',
  realm: 'uatf-dss-realm',
  clientId: 'dss-bff',
  clientSecret: 'confidential-client-secret',
  redirectUri: 'https://bff.example.edu/api/auth/callback',
};

afterEach(() => vi.unstubAllGlobals());

describe('Keycloak OIDC client', () => {
  it('creates an Authorization Code request with PKCE, state and nonce', () => {
    const url = createAuthorizationUrl(config, {
      state: 'state-value',
      nonce: 'nonce-value',
      codeChallenge: 'pkce-challenge',
      action: 'register',
    });

    expect(url.toString()).toContain('/auth/realms/uatf-dss-realm/protocol/openid-connect/auth?');
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('scope')).toBe('openid profile email');
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(url.searchParams.get('code_challenge')).toBe('pkce-challenge');
    expect(url.searchParams.get('state')).toBe('state-value');
    expect(url.searchParams.get('nonce')).toBe('nonce-value');
    expect(url.searchParams.get('kc_action')).toBe('REGISTER');
  });

  it('exchanges a code only with the authorization_code grant on the server', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      access_token: 'access-token',
      id_token: 'id-token',
      refresh_token: 'refresh-token',
      expires_in: 300,
      refresh_expires_in: 1800,
    }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(exchangeAuthorizationCode(config, {
      code: 'authorization-code',
      codeVerifier: 'pkce-verifier',
    })).resolves.toEqual({
      accessToken: 'access-token',
      idToken: 'id-token',
      refreshToken: 'refresh-token',
      expiresIn: 300,
      refreshExpiresIn: 1800,
    });

    const [url, options] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(url.toString()).toBe(
      'https://keycloak.example.edu/auth/realms/uatf-dss-realm/protocol/openid-connect/token',
    );
    expect(options.method).toBe('POST');
    expect(options.body).toBeInstanceOf(URLSearchParams);
    const body = options.body as URLSearchParams;
    expect(body.get('grant_type')).toBe('authorization_code');
    expect(body.get('code')).toBe('authorization-code');
    expect(body.get('code_verifier')).toBe('pkce-verifier');
    expect(body.get('client_secret')).toBe('confidential-client-secret');
  });

  it('builds RP-initiated logout with the ID token hint', () => {
    const url = createLogoutUrl(config, 'id-token', 'https://admin.example.edu/login');

    expect(url.pathname).toBe('/auth/realms/uatf-dss-realm/protocol/openid-connect/logout');
    expect(url.searchParams.get('id_token_hint')).toBe('id-token');
    expect(url.searchParams.get('post_logout_redirect_uri')).toBe('https://admin.example.edu/login');
    expect(url.searchParams.get('client_id')).toBe('dss-bff');
  });
});
