import { describe, expect, it } from 'vitest';

import { isAuthUserProfile } from './auth-user.js';

const profile = {
  id: '6acb7476-663d-4c94-b3bd-9e5ac6db7f31',
  username: 'maria',
  email: 'maria@uatf.edu.bo',
  firstName: 'María',
  lastName: 'Pérez',
  isActive: true,
  academicContexts: [{
    id: '7f4f3174-98f1-4d5a-a8c8-4f3e2022b2c3',
    userId: '6acb7476-663d-4c94-b3bd-9e5ac6db7f31',
    facultyId: 2,
    careerId: 8,
  }],
};

describe('AuthUserProfile contract', () => {
  it('accepts the plain profile returned by auth-service', () => {
    expect(isAuthUserProfile(profile)).toBe(true);
  });

  it('rejects malformed academic contexts and profiles with client-only roles', () => {
    expect(isAuthUserProfile({ ...profile, academicContexts: [{ ...profile.academicContexts[0], careerId: 0 }] })).toBe(false);
    expect(isAuthUserProfile({ data: profile })).toBe(false);
  });
});
