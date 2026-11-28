import type { AdminUserDirectoryEntry } from '../data-access/auth-admin';

/** Institutional roles offered by the role filter. They do not decide academic-context rules (see `academicScope`). */
export const ROLE_PRECEDENCE = ['DIRECTOR', 'DECANO', 'RECTOR', 'SUPERADMIN'] as const;

export function personName(user: Pick<AdminUserDirectoryEntry, 'firstName' | 'lastName' | 'username'>): string {
  return [user.firstName, user.lastName].filter(Boolean).join(' ').trim() || user.username;
}
