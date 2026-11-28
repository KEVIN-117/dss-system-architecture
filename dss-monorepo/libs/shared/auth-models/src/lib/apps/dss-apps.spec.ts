import { describe, expect, it } from 'vitest';
import { IAM_ROLE_PORTALS } from '../iam/iam-requests.js';
import { DSS_APPS, dssAppById, isPortalPermission } from './dss-apps.js';

describe('DSS_APPS', () => {
  it('has one application per role portal, each with its portal:* permission', () => {
    expect(DSS_APPS.map((app) => app.id)).toEqual([...IAM_ROLE_PORTALS]);
    for (const app of DSS_APPS) expect(app.permission).toBe(`portal:${app.id}`);
  });

  it('finds an application by id', () => {
    expect(dssAppById('rector')?.label).toBe('Dashboard rector');
    expect(dssAppById('becas')).toBeUndefined();
    expect(dssAppById(null)).toBeUndefined();
  });

  it('recognises portal permissions', () => {
    expect(isPortalPermission('portal:admin')).toBe(true);
    expect(isPortalPermission('portal:unknown')).toBe(true);
    expect(isPortalPermission('analytics:read')).toBe(false);
  });
});
