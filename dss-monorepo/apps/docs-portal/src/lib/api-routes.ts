import { createHash } from 'node:crypto';
import type { ApiOperation } from './api-catalog';

export function apiOperationSlug(operation: ApiOperation): string {
  const suffix = createHash('sha1').update(`${operation.method}:${operation.path}`).digest('hex').slice(0, 8);
  return `${operation.method.toLowerCase()}-${suffix}`;
}
