import type { DSSRole } from '../roles/dss-role.js';

export interface KeycloakTokenClaims {
  sub: string;
  iss: string;
  aud: string | string[];
  exp: number;
  preferred_username?: string;
  email?: string;
  given_name?: string;
  family_name?: string;

  realm_access?: {
    roles: readonly string[];
  };

  resource_access?: Record<
    string,
    {
      roles: readonly string[];
    }
  >;
}

export interface VerifiedToken {
  claims: KeycloakTokenClaims;
  roles: DSSRole[];
}
