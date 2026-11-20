import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AcademicContext } from '@dss-monorepo/auth-models';

import { buildAcademicScopeFilter, deriveAcademicScope } from './academic-scope';

const userId = 'aaaabbbb-1111-4111-8111-000000000002';

function context(
  index: number,
  facultyId: number | null,
  careerId: string | null,
): AcademicContext {
  return {
    id: `aaaabbbb-1111-4111-8111-00000000010${index}`,
    userId,
    facultyId,
    careerId,
  };
}

beforeEach(() => {
  vi.stubEnv(
    'OLAP_ACADEMIC_SCOPE_FILTERS',
    JSON.stringify({
      career: {
        dimension: 'Ámbito de carrera',
        hierarchy: 'Carrera',
        level: 'Carrera',
        memberTemplate: '[Ámbito de carrera].[Carrera].[Carrera].&[{id}]',
      },
      faculty: {
        dimension: 'Ámbito de facultad',
        hierarchy: 'Facultad',
        level: 'Facultad',
        memberTemplate: '[Ámbito de facultad].[Facultad].[Facultad].&[{id}]',
      },
    }),
  );
});

afterEach(() => {
  vi.unstubAllEnvs();
});

/** Permissions granted by the DECANO and DIRECTOR realm composites (IAM-002). */
const DEAN_PERMISSIONS = ['analytics:read', 'analytics:career', 'analytics:faculty'];
const DIRECTOR_PERMISSIONS = ['analytics:read', 'analytics:career'];

/** IAM-009: auth-service may return several academic contexts per user; the OLAP filter is their union. */
describe('academic scope with several contexts (IAM-009)', () => {
  it('builds an OLAP filter with both faculties of an acting dean', () => {
    const scope = deriveAcademicScope(
      DEAN_PERMISSIONS,
      [context(1, 5, null), context(2, 8, null)],
    );

    expect(scope.kind).toBe('faculty');
    expect(buildAcademicScopeFilter(scope)?.members).toEqual([
      '[Ámbito de facultad].[Facultad].[Facultad].&[5]',
      '[Ámbito de facultad].[Facultad].[Facultad].&[8]',
    ]);
  });

  it('builds an OLAP filter with every career of a director, across faculties', () => {
    const scope = deriveAcademicScope(
      DIRECTOR_PERMISSIONS,
      [context(1, 10, '025'), context(2, 8, '015')],
    );

    expect(buildAcademicScopeFilter(scope)?.members).toEqual([
      '[Ámbito de carrera].[Carrera].[Carrera].&[025]',
      '[Ámbito de carrera].[Carrera].[Carrera].&[015]',
    ]);
  });

  it('lists each member once even if a context is repeated', () => {
    const scope = deriveAcademicScope(
      DEAN_PERMISSIONS,
      [context(1, 5, null), context(2, 5, null), context(3, 8, null)],
    );

    expect(buildAcademicScopeFilter(scope)?.members).toHaveLength(2);
  });

  it('keeps only the faculty contexts when faculty analytics is granted', () => {
    const scope = deriveAcademicScope(
      DEAN_PERMISSIONS,
      [context(1, 5, null), context(2, 10, '025')],
    );

    expect(buildAcademicScopeFilter(scope)?.members).toEqual([
      '[Ámbito de facultad].[Facultad].[Facultad].&[5]',
    ]);
  });

  it('derives the scope from token permissions, not from roles (IAM-014)', () => {
    expect(deriveAcademicScope(['analytics:read', 'analytics:global'], [])).toEqual({ kind: 'global', contexts: [] });
    // Read without a scope permission, or a scope without read, is not analytics access.
    expect(() => deriveAcademicScope(['analytics:read'], [context(1, 5, null)])).toThrowError(/not permitted/i);
    expect(() => deriveAcademicScope(['analytics:global'], [])).toThrowError(/not permitted/i);
    // A platform administrator has no analytics permissions (D4).
    expect(() => deriveAcademicScope(['iam:users:write', 'prediction:train'], [context(1, 5, null)]))
      .toThrowError(/not permitted/i);
    // Career analytics without faculty analytics never widens to a faculty context.
    expect(() => deriveAcademicScope(DIRECTOR_PERMISSIONS, [context(1, 5, null)]))
      .toThrowError(/career context is required/i);
    expect(() => deriveAcademicScope(DEAN_PERMISSIONS, [])).toThrowError(/faculty context is required/i);
    // A dean whose contexts are careers only falls back to career analytics.
    expect(deriveAcademicScope(DEAN_PERMISSIONS, [context(1, 10, '025')]).kind).toBe('career');
  });
});
