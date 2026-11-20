import type { AdminUserDirectoryEntry } from '../data-access/auth-admin';

/** Academic roles from narrowest to broadest; the broadest one decides the academic-context rules. */
export const ROLE_PRECEDENCE = ['DIRECTOR', 'DECANO', 'RECTOR', 'SUPERADMIN'] as const;

export type ContextRole = (typeof ROLE_PRECEDENCE)[number];

export function effectiveRole(roles: readonly string[]): ContextRole | null {
  return [...ROLE_PRECEDENCE].reverse().find((role) => roles.includes(role)) ?? null;
}

export function personName(user: Pick<AdminUserDirectoryEntry, 'firstName' | 'lastName' | 'username'>): string {
  return [user.firstName, user.lastName].filter(Boolean).join(' ').trim() || user.username;
}
