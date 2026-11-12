import type { AcademicContext, DSSRole } from '@dss-monorepo/auth-models';
import { resolvePermissions } from '@dss-monorepo/rbac-server';

export interface AcademicScope {
  kind: 'global' | 'faculty' | 'career';
  contexts: AcademicContext[];
}

export interface ScopeFilterBinding {
  dimension: string;
  hierarchy: string;
  level: string;
  memberTemplate: string;
}

export interface AcademicScopeFilter {
  dimension: string;
  hierarchy: string;
  hierarchyUniqueName: string;
  level: string;
  members: string[];
}

export class AcademicScopePolicyError extends Error {
  constructor(
    message: string,
    readonly code: string,
  ) {
    super(message);
    this.name = 'AcademicScopePolicyError';
  }
}

/** Resolves analytics access from verified roles and the Auth Service profile. */
export function deriveAcademicScope(
  roles: readonly DSSRole[],
  contexts: readonly AcademicContext[],
): AcademicScope {
  const permissions = resolvePermissions(roles);
  if (!permissions.has('analytics:read')) {
    throw new AcademicScopePolicyError(
      'Analytics access is not permitted',
      'FORBIDDEN',
    );
  }
  if (roles.includes('RECTOR')) {
    if (!permissions.has('analytics:global')) {
      throw new AcademicScopePolicyError(
        'Global analytics access is not permitted',
        'FORBIDDEN',
      );
    }
    return { kind: 'global', contexts: [] };
  }
  if (roles.includes('DECANO')) {
    if (!permissions.has('analytics:faculty')) {
      throw new AcademicScopePolicyError(
        'Faculty analytics access is not permitted',
        'FORBIDDEN',
      );
    }
    const scoped = contexts.filter(
      (item) => item.facultyId !== null && item.careerId === null,
    );
    if (!scoped.length) {
      throw new AcademicScopePolicyError(
        'Academic faculty context is required',
        'ACADEMIC_CONTEXT_REQUIRED',
      );
    }
    return { kind: 'faculty', contexts: scoped };
  }
  if (roles.includes('DIRECTOR')) {
    if (!permissions.has('analytics:career')) {
      throw new AcademicScopePolicyError(
        'Career analytics access is not permitted',
        'FORBIDDEN',
      );
    }
    const scoped = contexts.filter(
      (item) => item.facultyId !== null && item.careerId !== null,
    );
    if (!scoped.length) {
      throw new AcademicScopePolicyError(
        'Academic career context is required',
        'ACADEMIC_CONTEXT_REQUIRED',
      );
    }
    return { kind: 'career', contexts: scoped };
  }
  throw new AcademicScopePolicyError(
    'Analytics access is not permitted',
    'FORBIDDEN',
  );
}

export function buildAcademicScopeFilter(
  scope: AcademicScope,
): AcademicScopeFilter | null {
  if (scope.kind === 'global') return null;
  const binding = readScopeBinding(scope.kind);
  const ids =
    scope.kind === 'faculty'
      ? scope.contexts.flatMap((item) =>
          item.facultyId === null ? [] : [String(item.facultyId)],
        )
      : scope.contexts.flatMap((item) =>
          item.careerId === null ? [] : [item.careerId],
        );
  if (scope.kind === 'career' && ids.some((id) => !/^[A-Za-z0-9]{3}$/.test(id))) {
    throw new AcademicScopePolicyError(
      'Academic career context is invalid',
      'ACADEMIC_CONTEXT_INVALID',
    );
  }
  const members = [...new Set(ids)].map((id) =>
    binding.memberTemplate.replaceAll('{id}', id),
  );
  if (!members.length) {
    throw new AcademicScopePolicyError(
      'No academic scope is available',
      'ACADEMIC_CONTEXT_REQUIRED',
    );
  }
  const hierarchyUniqueName = binding.memberTemplate.match(
    /^(\[[^\]]+\]\.\[[^\]]+\])/,
  )?.[1];
  if (!hierarchyUniqueName) {
    throw new AcademicScopePolicyError(
      'Academic analytics scope is invalid',
      'SCOPE_CONFIGURATION_ERROR',
    );
  }
  return {
    dimension: binding.dimension,
    hierarchy: binding.hierarchy,
    hierarchyUniqueName,
    level: binding.level,
    members,
  };
}

function readScopeBinding(kind: 'faculty' | 'career'): ScopeFilterBinding {
  let value: unknown;
  try {
    value = JSON.parse(process.env.OLAP_ACADEMIC_SCOPE_FILTERS ?? 'null') as unknown;
  } catch {
    throw new AcademicScopePolicyError(
      'Academic analytics scope is not configured',
      'SCOPE_CONFIGURATION_ERROR',
    );
  }
  const candidate = isRecord(value) ? value[kind] : undefined;
  if (
    !isRecord(candidate) ||
    !['dimension', 'hierarchy', 'level', 'memberTemplate'].every(
      (key) =>
        typeof candidate[key] === 'string' &&
        (candidate[key] as string).trim().length > 0,
    )
  ) {
    throw new AcademicScopePolicyError(
      'Academic analytics scope is not configured',
      'SCOPE_CONFIGURATION_ERROR',
    );
  }
  const binding = candidate as unknown as ScopeFilterBinding;
  if (!binding.memberTemplate.includes('{id}')) {
    throw new AcademicScopePolicyError(
      'Academic analytics scope is invalid',
      'SCOPE_CONFIGURATION_ERROR',
    );
  }
  return binding;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
