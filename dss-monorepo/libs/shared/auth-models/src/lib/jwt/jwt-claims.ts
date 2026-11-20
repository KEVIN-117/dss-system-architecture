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
  /** Portal roles: known DSS roles, plus realm roles mapped to one through configuration. */
  roles: DSSRole[];
  /**
   * Permissions of the catalog client (`resource_access.dss-permissions.roles`, IAM-014). An open set:
   * a permission created from the admin portal reaches the BFF without a deployment.
   */
  permissions: string[];
}
