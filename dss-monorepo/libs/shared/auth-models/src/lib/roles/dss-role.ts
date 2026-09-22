export type DSSRole = 'SUPERADMIN' | 'RECTOR' | 'DECANO' | 'DIRECTOR';

export const DSS_ROLES = [
  'SUPERADMIN',
  'RECTOR',
  'DECANO',
  'DIRECTOR',
] as const satisfies readonly DSSRole[];

export function isDSSRole(value: string): value is DSSRole {
  return (DSS_ROLES as readonly string[]).includes(value);
}
