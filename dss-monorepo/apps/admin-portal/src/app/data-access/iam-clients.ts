/**
 * Applications (Keycloak clients) through the BFF IAM routes (IAM-008/IAM-015/IAM-018). Secrets come back
 * only from create and rotate, once; the portal shows them and never stores them.
 */
import { iamRequest } from './iam-users';

export type IamClientType = 'PUBLIC' | 'CONFIDENTIAL' | 'BEARER_ONLY';

export interface IamClient {
  clientId: string;
  name: string | null;
  description: string | null;
  type: IamClientType;
  enabled: boolean;
  standardFlowEnabled?: boolean;
  serviceAccountsEnabled?: boolean;
  redirectUris?: string[];
  webOrigins?: string[];
  postLogoutRedirectUris?: string[];
  /** The platform depends on it: read-only, except `dss-bff` (name, description and URIs). */
  system: boolean;
}

export interface IamClientUris {
  redirectUris: string[];
  webOrigins: string[];
  postLogoutRedirectUris: string[];
}

export interface IamClientDraft extends IamClientUris {
  clientId: string;
  name: string;
  description: string;
  type: 'PUBLIC' | 'CONFIDENTIAL';
  enabled: boolean;
  serviceAccountsEnabled: boolean;
}

export interface IamClientChange extends IamClientUris {
  name: string;
  description: string;
  /** Omitted for `dss-bff`, which cannot be disabled. */
  enabled?: boolean;
}

export interface IamCreatedClient {
  client: IamClient;
  /** Only for CONFIDENTIAL clients, shown once. */
  secret: string | null;
}

export interface IamIssuedSecret {
  clientId: string;
  secret: string;
}

/** Same rule as auth-service and the BFF. */
export const CLIENT_ID_PATTERN = /^[a-z][a-z0-9-]{2,63}$/;
/** The one system client whose name, description and URIs can still be edited. */
export const EDITABLE_SYSTEM_CLIENT = 'dss-bff';
export const MAX_URIS = 50;

const client = (clientId: string) => `clients/${encodeURIComponent(clientId)}`;

/** Whether the portal may edit the client at all (auth-service answers 409 otherwise). */
export const isEditable = (item: IamClient) => !item.system || item.clientId === EDITABLE_SYSTEM_CLIENT;
/** Only non-system confidential clients rotate their secret here. */
export const canRotateSecret = (item: IamClient) => !item.system && item.type === 'CONFIDENTIAL';

export function listClients(search = '', signal?: AbortSignal): Promise<IamClient[]> {
  const params = new URLSearchParams({ size: '200' });
  if (search.trim()) params.set('search', search.trim());
  return iamRequest('GET', `clients?${params}`, 'No se pudieron cargar las aplicaciones', undefined, signal);
}

export function createClient(draft: IamClientDraft): Promise<IamCreatedClient> {
  return iamRequest('POST', 'clients', 'No se pudo registrar la aplicación', {
    clientId: draft.clientId.trim(),
    type: draft.type,
    enabled: draft.enabled,
    ...(draft.name.trim() ? { name: draft.name.trim() } : {}),
    ...(draft.description.trim() ? { description: draft.description.trim() } : {}),
    ...(draft.type === 'CONFIDENTIAL' ? { serviceAccountsEnabled: draft.serviceAccountsEnabled } : {}),
    redirectUris: draft.redirectUris,
    webOrigins: draft.webOrigins,
    postLogoutRedirectUris: draft.postLogoutRedirectUris,
  });
}

export function updateClient(clientId: string, change: IamClientChange): Promise<IamClient> {
  return iamRequest('PATCH', client(clientId), 'No se pudo actualizar la aplicación', {
    name: change.name.trim(),
    description: change.description.trim(),
    ...(change.enabled === undefined ? {} : { enabled: change.enabled }),
    redirectUris: change.redirectUris,
    webOrigins: change.webOrigins,
    postLogoutRedirectUris: change.postLogoutRedirectUris,
  });
}

/** The previous secret stops working immediately. */
export function rotateClientSecret(clientId: string): Promise<IamIssuedSecret> {
  return iamRequest('POST', `${client(clientId)}/secret`, 'No se pudo rotar el secreto');
}

/** One URI per line; blank lines and repeats are dropped. */
export function parseUriList(value: string): string[] {
  return [...new Set(value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean))];
}
