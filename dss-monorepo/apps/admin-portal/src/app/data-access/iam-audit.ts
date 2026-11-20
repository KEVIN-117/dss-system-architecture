/**
 * Administrative audit (`admin_audit_log`, IAM-005) through the BFF IAM routes (IAM-015/IAM-018). Secrets,
 * passwords and tokens already arrive as `[REDACTED]`.
 */
import { iamRequest } from './iam-users';

export type AuditTargetType = 'USER' | 'ROLE' | 'PERMISSION' | 'CLIENT';
export type AuditOutcome = 'PENDING' | 'SUCCESS' | 'FAILURE';

export interface AuditEntry {
  id: string;
  occurredAt: string;
  actor: { keycloakId?: string | null; username?: string | null; ipAddress?: string | null };
  action: string;
  targetType: AuditTargetType;
  targetId: string | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  outcome: AuditOutcome;
  failureReason: string | null;
  completedAt: string | null;
}

export interface AuditPage {
  content: AuditEntry[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

export interface AuditFilters {
  actor?: string;
  action?: string;
  targetType?: AuditTargetType | '';
  targetId?: string;
  outcome?: AuditOutcome | '';
  /** `YYYY-MM-DD`, local day, included. */
  from?: string;
  /** `YYYY-MM-DD`, local day, included (sent as the next day, excluded). */
  to?: string;
}

/** Actions auth-service records (contract `x-audit-action`), with readable labels. */
export const AUDIT_ACTIONS: Readonly<Record<string, string>> = {
  USER_CREATED: 'Usuario creado',
  USER_UPDATED: 'Usuario actualizado',
  USER_ACTIONS_EMAIL_SENT: 'Correo de acciones enviado',
  USER_ROLES_REPLACED: 'Roles de usuario reemplazados',
  USER_PERMISSIONS_REPLACED: 'Permisos de usuario reemplazados',
  USER_ACADEMIC_CONTEXTS_REPLACED: 'Contextos académicos reemplazados',
  USERS_RESYNCED: 'Usuarios resincronizados',
  ROLE_CREATED: 'Rol creado',
  ROLE_UPDATED: 'Rol actualizado',
  ROLE_DELETED: 'Rol eliminado',
  ROLE_PERMISSIONS_REPLACED: 'Permisos de rol reemplazados',
  PERMISSION_CREATED: 'Permiso creado',
  PERMISSION_UPDATED: 'Permiso actualizado',
  PERMISSION_DELETED: 'Permiso eliminado',
  CLIENT_CREATED: 'Aplicación registrada',
  CLIENT_UPDATED: 'Aplicación actualizada',
  CLIENT_SECRET_ROTATED: 'Secreto rotado',
};

export const TARGET_TYPES: Readonly<Record<AuditTargetType, string>> = {
  USER: 'Usuario',
  ROLE: 'Rol',
  PERMISSION: 'Permiso',
  CLIENT: 'Aplicación',
};

export const OUTCOMES: Readonly<Record<AuditOutcome, string>> = {
  SUCCESS: 'Correcto',
  FAILURE: 'Fallido',
  PENDING: 'Pendiente',
};

/** Local midnight of a `YYYY-MM-DD` day as an ISO instant, optionally shifted by whole days. */
function dayStart(day: string, shift = 0): string {
  const [year, month, date] = day.split('-').map(Number);
  return new Date(year, month - 1, date + shift).toISOString();
}

export function auditQuery(filters: AuditFilters, page: number, size: number): URLSearchParams {
  const params = new URLSearchParams({ page: String(page), size: String(size) });
  const text = (key: 'actor' | 'action' | 'targetId') => filters[key]?.trim();
  for (const key of ['actor', 'action', 'targetId'] as const) {
    const value = text(key);
    if (value) params.set(key, value);
  }
  if (filters.targetType) params.set('targetType', filters.targetType);
  if (filters.outcome) params.set('outcome', filters.outcome);
  if (filters.from) params.set('from', dayStart(filters.from));
  if (filters.to) params.set('to', dayStart(filters.to, 1));
  return params;
}

export function listAudit(filters: AuditFilters, page: number, size: number, signal?: AbortSignal): Promise<AuditPage> {
  return iamRequest('GET', `audit?${auditQuery(filters, page, size)}`, 'No se pudo cargar la auditoría', undefined, signal);
}

export interface AuditDiffRow {
  key: string;
  before: unknown;
  after: unknown;
  changed: boolean;
}

/** Top-level keys of `before` and `after`, sorted, marking which changed. */
export function auditDiff(before: Record<string, unknown> | null, after: Record<string, unknown> | null): AuditDiffRow[] {
  const keys = [...new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})])].sort();
  return keys.map((key) => {
    const left = before?.[key];
    const right = after?.[key];
    return { key, before: left, after: right, changed: JSON.stringify(left) !== JSON.stringify(right) };
  });
}
