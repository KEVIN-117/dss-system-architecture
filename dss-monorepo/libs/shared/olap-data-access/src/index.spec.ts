import { afterEach, describe, expect, it, vi } from 'vitest';

const { olapFetch } = vi.hoisted(() => ({ olapFetch: vi.fn() }));
vi.mock('@dss-monorepo/olap-connector', () => ({
  executeQuery: vi.fn(),
  getApp: vi.fn(),
  listApps: vi.fn(),
  loadDashboard: vi.fn(),
  newQuery: vi.fn(),
  olapFetch,
  serializeQueryToHash: vi.fn(),
  deserializeQueryFromHash: vi.fn(),
  toRepoRelative: (path: string) => path.replace(/^\/+/, ''),
}));

import {
  executeSavedTileQuery,
  getCubeMetadata,
  listOlapConnections,
  listSavedDashboards,
} from './index.js';

afterEach(() => vi.clearAllMocks());

describe('OLAP data access', () => {
  it('discovers dashboards recursively and returns an empty catalog when none are published', async () => {
    olapFetch.mockResolvedValueOnce(
      Response.json([
        {
          type: 'FOLDER',
          path: '/Shared',
          name: 'Shared',
          repoObjects: [
            {
              type: 'FILE',
              path: '/Shared/Academic.saikudash',
              name: 'Academic.saikudash',
            },
          ],
        },
      ]),
    );
    await expect(listSavedDashboards()).resolves.toEqual([
      {
        path: 'Shared/Academic.saikudash',
        name: 'Academic',
        owner: undefined,
        modified: undefined,
      },
    ]);

    olapFetch.mockResolvedValueOnce(Response.json([]));
    await expect(listSavedDashboards()).resolves.toEqual([]);
  });

  it('surfaces authentication and upstream errors from discovery', async () => {
    olapFetch.mockResolvedValueOnce(
      new Response('Unauthorized', { status: 401 }),
    );
    await expect(listOlapConnections('analyst')).rejects.toThrow('(401)');
    expect(olapFetch).toHaveBeenCalledWith('/rest/saiku/analyst/discover', {
      headers: { Accept: 'application/json' },
    });
  });

  it('loads cube dimensions and visible measures through Saiku metadata', async () => {
    olapFetch.mockResolvedValueOnce(
      Response.json({
        dimensions: [
          {
            name: 'Faculty',
            caption: 'Faculty',
            uniqueName: '[Faculty]',
            hierarchies: [],
          },
        ],
        measures: [
          {
            name: 'Applicants',
            caption: 'Applicants',
            uniqueName: '[Measures].[Applicants]',
            visible: true,
          },
          {
            name: 'Internal helper',
            caption: 'Internal helper',
            uniqueName: '[Measures].[Internal helper]',
            visible: false,
          },
        ],
        properties: {},
      }),
    );

    await expect(
      getCubeMetadata('rector', {
        connection: 'uatf-dw',
        catalog: 'UATF_DW',
        schema: 'UATF_DW',
        name: 'Academic Admission',
        caption: 'Academic Admission',
        uniqueName: '[Academic Admission]',
        visible: true,
      }),
    ).resolves.toEqual({
      dimensions: [
        {
          name: 'Faculty',
          caption: 'Faculty',
          uniqueName: '[Faculty]',
          hierarchies: [],
        },
      ],
      measures: [
        {
          name: 'Applicants',
          caption: 'Applicants',
          uniqueName: '[Measures].[Applicants]',
          visible: true,
        },
      ],
    });
    expect(olapFetch).toHaveBeenCalledWith(
      '/rest/saiku/rector/discover/uatf-dw/UATF_DW/UATF_DW/Academic%20Admission/metadata',
      { headers: { Accept: 'application/json' } },
    );
  });

  it('applies published filters to referenced tile queries and validates the result status', async () => {
    olapFetch.mockResolvedValueOnce(
      Response.json({ status: 'SUCCESS', queryId: 'q-1', data: [] }),
    );
    const filter = {
      dimension: '[Academic Year]',
      hierarchy: '[Academic Year].[Academic Year]',
      level: '[Academic Year].[Academic Year].[Year]',
      members: ['[Academic Year].[Academic Year].[2026]'],
    };

    await expect(
      executeSavedTileQuery(
        { kind: 'reference', path: '/Shared/query.saiku' },
        [filter],
      ),
    ).resolves.toMatchObject({ status: 'SUCCESS', data: [] });

    const [, init] = olapFetch.mock.calls[0] as [string, RequestInit];
    expect(olapFetch.mock.calls[0][0]).toBe('/rest/saiku/api/ai/query/saved');
    expect(JSON.parse(String(init.body))).toEqual({
      path: 'Shared/query.saiku',
      filters: [filter],
    });

    olapFetch.mockResolvedValueOnce(
      Response.json({ status: 'ERROR', error: 'Cube unavailable' }),
    );
    await expect(
      executeSavedTileQuery({ kind: 'inline', body: { query: 'MDX' } }),
    ).rejects.toThrow('Cube unavailable');
  });

  it('keeps query-defined inline filters and overlays matching dashboard selections', async () => {
    olapFetch.mockResolvedValueOnce(
      Response.json({ status: 'SUCCESS', queryId: 'q-2', data: [] }),
    );
    const baseFilter = {
      dimension: '[Academic Year]',
      hierarchy: '[Academic Year].[Academic Year]',
      level: '[Academic Year].[Academic Year].[Year]',
      members: ['[Academic Year].[Academic Year].[2025]'],
    };
    const activeFilter = {
      ...baseFilter,
      members: ['[Academic Year].[Academic Year].[2026]'],
    };
    await executeSavedTileQuery(
      { kind: 'inline', body: { query: 'MDX', filters: [baseFilter] } },
      [activeFilter],
    );
    const [, init] = olapFetch.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(init.body)).filters).toEqual([activeFilter]);
  });
});
