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

/** IAM-009: auth-service may return several academic contexts per user; the OLAP filter is their union. */
describe('academic scope with several contexts (IAM-009)', () => {
  it('builds an OLAP filter with both faculties of an acting dean', () => {
    const scope = deriveAcademicScope(
      ['DECANO'],
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
      ['DIRECTOR'],
      [context(1, 10, '025'), context(2, 8, '015')],
    );

    expect(buildAcademicScopeFilter(scope)?.members).toEqual([
      '[Ámbito de carrera].[Carrera].[Carrera].&[025]',
      '[Ámbito de carrera].[Carrera].[Carrera].&[015]',
    ]);
  });

  it('lists each member once even if a context is repeated', () => {
    const scope = deriveAcademicScope(
      ['DECANO'],
      [context(1, 5, null), context(2, 5, null), context(3, 8, null)],
    );

    expect(buildAcademicScopeFilter(scope)?.members).toHaveLength(2);
  });

  it('keeps only the contexts that match the role level', () => {
    const scope = deriveAcademicScope(
      ['DECANO'],
      [context(1, 5, null), context(2, 10, '025')],
    );

    expect(buildAcademicScopeFilter(scope)?.members).toEqual([
      '[Ámbito de facultad].[Facultad].[Facultad].&[5]',
    ]);
  });
});
