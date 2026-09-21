import Keycloak, { type KeycloakConfig, type KeycloakInitOptions } from 'keycloak-js';

import type { DSSRole } from './types';

let instance: Keycloak | null = null;
let initialization: Promise<boolean> | null = null;

export function getKeycloak(config?: KeycloakConfig): Keycloak {
    if (typeof window === 'undefined') {
        throw new Error('Keycloak can only be initialized in the browser');
    }

    if (!instance) {
        if (!config)
            throw new Error('Keycloak configuration is required');

        instance = new Keycloak(config);
    }

    return instance;
}

/** Invoca Keycloak.init una sola vez, incluso con React Strict Mode. */
export function initializeKeycloak(
  keycloak: Keycloak,
  options: KeycloakInitOptions,
): Promise<boolean> {
  if (!initialization) {
    initialization = keycloak.init(options);
  }

  return initialization;
}

export function extractRoles(keycloak: Keycloak, clientId: string): string[] {
    const realmRoles = keycloak.realmAccess?.roles ?? [];
    const clientRoles = keycloak.resourceAccess?.[clientId]?.roles ?? [];
    const allRoles = [...new Set([...realmRoles, ...clientRoles])] ;

    return allRoles;
}

const DSS_ROLES = new Set([
    'SUPERADMIN',
    'RECTOR',
    'DECANO',
    'DIRECTOR'
]);

export function filterDSSRoles(roles: string[]): DSSRole[] {
    return roles
        .filter(r => DSS_ROLES.has(r))
        .map(r => r as DSSRole);
}
