/**
 * Server-only Keycloak OIDC client. It deliberately accepts configuration as
 * arguments so applications, never this connector, own environment access.
 */
export interface KeycloakOidcClientConfig {
  keycloakUrl: string;
  realm: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export interface AuthorizationRequest {
  state: string;
  nonce: string;
  codeChallenge: string;
  action?: 'register';
}

export interface AuthorizationCodeExchange {
  code: string;
  codeVerifier: string;
}

export interface KeycloakTokenSet {
  accessToken: string;
  idToken: string;
  refreshToken?: string;
  expiresIn: number;
  refreshExpiresIn?: number;
}

export class KeycloakOidcClientError extends Error {
  constructor(message = 'Keycloak authentication exchange failed') {
    super(message);
    this.name = 'KeycloakOidcClientError';
  }
}

/** Creates a standards-compliant authorization request; no browser token is involved. */
export function createAuthorizationUrl(
  config: KeycloakOidcClientConfig,
  request: AuthorizationRequest,
): URL {
  const url = endpointUrl(config, 'auth');
  url.searchParams.set('client_id', config.clientId);
  url.searchParams.set('redirect_uri', config.redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', 'openid profile email');
  url.searchParams.set('state', request.state);
  url.searchParams.set('nonce', request.nonce);
  url.searchParams.set('code_challenge', request.codeChallenge);
  url.searchParams.set('code_challenge_method', 'S256');
  if (request.action === 'register') {
    url.searchParams.set('kc_action', 'REGISTER');
  }
  return url;
}

/** Exchanges an authorization code only from a trusted server runtime. */
export async function exchangeAuthorizationCode(
  config: KeycloakOidcClientConfig,
  exchange: AuthorizationCodeExchange,
): Promise<KeycloakTokenSet> {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: config.clientId,
    client_secret: config.clientSecret,
    redirect_uri: config.redirectUri,
    code: exchange.code,
    code_verifier: exchange.codeVerifier,
  });

  let response: Response;
  try {
    response = await fetch(endpointUrl(config, 'token'), {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
    });
  } catch {
    throw new KeycloakOidcClientError();
  }

  if (!response.ok) {
    throw new KeycloakOidcClientError();
  }

  return parseTokenSet(await response.json());
}

export function createLogoutUrl(
  config: KeycloakOidcClientConfig,
  idTokenHint: string,
  postLogoutRedirectUri: string,
): URL {
  const url = endpointUrl(config, 'logout');
  url.searchParams.set('id_token_hint', idTokenHint);
  url.searchParams.set('post_logout_redirect_uri', postLogoutRedirectUri);
  url.searchParams.set('client_id', config.clientId);
  return url;
}

function endpointUrl(config: Pick<KeycloakOidcClientConfig, 'keycloakUrl' | 'realm'>, endpoint: string): URL {
  const base = new URL(config.keycloakUrl);
  const basePath = base.pathname.endsWith('/') ? base.pathname : `${base.pathname}/`;
  base.pathname = `${basePath}realms/${encodeURIComponent(config.realm)}/protocol/openid-connect/${endpoint}`;
  base.search = '';
  base.hash = '';
  return base;
}

function parseTokenSet(value: unknown): KeycloakTokenSet {
  if (!isRecord(value) ||
    typeof value.access_token !== 'string' ||
    typeof value.id_token !== 'string' ||
    !isPositiveNumber(value.expires_in) ||
    (value.refresh_token !== undefined && typeof value.refresh_token !== 'string') ||
    (value.refresh_expires_in !== undefined && !isPositiveNumber(value.refresh_expires_in))) {
    throw new KeycloakOidcClientError('Keycloak returned an invalid token response');
  }

  return {
    accessToken: value.access_token,
    idToken: value.id_token,
    refreshToken: value.refresh_token,
    expiresIn: value.expires_in,
    refreshExpiresIn: value.refresh_expires_in,
  };
}

function isPositiveNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
