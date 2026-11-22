/** Request validation shared by the Load Manager BFF routes (LM-006). */

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function onlyKeys(
  value: Record<string, unknown>,
  allowed: readonly string[],
): boolean {
  return Object.keys(value).every((key) => allowed.includes(key));
}

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID.test(value);
}

/**
 * Query parameters limited to an allowlist, each present at most once. Returns null when the query has an
 * unknown or repeated key.
 */
export function singleValuedQuery(
  params: URLSearchParams,
  allowed: readonly string[],
): Map<string, string> | null {
  const values = new Map<string, string>();
  for (const key of new Set(params.keys())) {
    const all = params.getAll(key);
    if (!allowed.includes(key) || all.length > 1) return null;
    values.set(key, all[0]);
  }
  return values;
}

/** undefined when absent, null when present but not a non-negative safe integer. */
export function integerValue(value: string | undefined): number | null | undefined {
  if (value === undefined) return undefined;
  if (!/^\d+$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}
