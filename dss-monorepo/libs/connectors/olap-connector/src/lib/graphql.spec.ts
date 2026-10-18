import { afterEach, describe, expect, it, vi } from 'vitest';

const { olapFetch } = vi.hoisted(() => ({ olapFetch: vi.fn() }));
vi.mock('./http.js', () => ({ olapFetch }));

import {
  executeOlapGraphQL,
  fetchOlapGraphQLSchema,
  refreshOlapGraphQLSchema,
} from './graphql.js';

afterEach(() => vi.clearAllMocks());

describe('OLAP GraphQL client', () => {
  it('sends an operation through the authenticated OLAP proxy', async () => {
    const result = { data: { cubes: [{ name: 'alumnos' }] } };
    olapFetch.mockResolvedValue(Response.json(result));

    await expect(
      executeOlapGraphQL({
        query: 'query Cubes { cubes { name } }',
        operationName: 'Cubes',
        variables: { search: 'alum' },
      }),
    ).resolves.toEqual(result);

    expect(olapFetch).toHaveBeenCalledWith(
      '/rest/saiku/api/graphql',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          query: 'query Cubes { cubes { name } }',
          operationName: 'Cubes',
          variables: { search: 'alum' },
        }),
      }),
    );
  });

  it('preserves GraphQL and HTTP errors as typed failures', async () => {
    olapFetch.mockResolvedValue(
      Response.json(
        {
          errors: [{ message: 'Forbidden', extensions: { code: 'FORBIDDEN' } }],
        },
        { status: 403 },
      ),
    );

    await expect(
      executeOlapGraphQL({ query: '{ cubes { name } }' }),
    ).rejects.toMatchObject({ status: 403 });
  });

  it('rejects malformed successful responses and empty queries', async () => {
    olapFetch.mockResolvedValue(Response.json({ unexpected: true }));
    await expect(
      executeOlapGraphQL({ query: '{ cubes { name } }' }),
    ).rejects.toMatchObject({ status: 502 });
    await expect(executeOlapGraphQL({ query: '  ' })).rejects.toThrow(
      TypeError,
    );
    expect(olapFetch).toHaveBeenCalledTimes(1);
  });

  it('loads the live schema and validates refresh responses', async () => {
    olapFetch.mockResolvedValueOnce(
      new Response('type Query { ping: String! }'),
    );
    await expect(fetchOlapGraphQLSchema()).resolves.toContain('type Query');
    expect(olapFetch).toHaveBeenCalledWith(
      '/rest/saiku/api/graphql/schema.graphql',
      expect.objectContaining({
        method: 'GET',
      }),
    );

    olapFetch.mockResolvedValueOnce(Response.json({ status: 'ok' }));
    await expect(refreshOlapGraphQLSchema()).resolves.toBeUndefined();
    olapFetch.mockResolvedValueOnce(Response.json({ status: 'nope' }));
    await expect(refreshOlapGraphQLSchema()).rejects.toMatchObject({
      status: 502,
    });
  });

  it('reports schema endpoint authorization failures', async () => {
    olapFetch.mockResolvedValue(new Response('Forbidden', { status: 403 }));
    await expect(fetchOlapGraphQLSchema()).rejects.toMatchObject({
      status: 403,
      name: 'OlapGraphQLClientError',
    });
  });
});
