import {
  executeQuery,
  getApp,
  listApps,
  loadDashboard,
  newQuery,
  olapFetch,
  toRepoRelative,
} from '@dss-monorepo/olap-connector';
import type {
  AppSummary,
  Dashboard,
  DashboardTile,
  SaikuApp,
} from '@dss-monorepo/olap-connector';
import type {
  SaikuConnection,
  SaikuCube,
  SaikuDimension,
  SaikuMeasure,
} from '@dss-monorepo/olap-models';

// Keep application code on the data-access layer instead of depending on the
// low-level OLAP connector directly.
export { executeQuery, newQuery };

export type {
  AppPage,
  AppSummary,
  Dashboard,
  DashboardTile,
  SaikuApp,
} from '@dss-monorepo/olap-connector';

export interface SavedDashboardSummary {
  path: string;
  name: string;
  owner?: string | null;
  modified?: number;
}

interface RepositoryNode {
  path: string;
  name: string;
  type: 'FOLDER' | 'FILE';
  fileType?: string | null;
  owner?: string | null;
  modified?: number;
  repoObjects?: RepositoryNode[];
}

/** Recursively list saved dashboards through the session-aware OLAP connector. */
export async function listSavedDashboards(): Promise<SavedDashboardSummary[]> {
  const response = await olapFetch('/rest/saiku/api/repository?type=saiku', {
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) {
    throw new Error(`Could not list saved dashboards (${response.status}).`);
  }

  const tree = (await response.json()) as RepositoryNode[];
  const dashboards: SavedDashboardSummary[] = [];
  const visit = (nodes: readonly RepositoryNode[]) => {
    for (const node of nodes) {
      if (node.type === 'FOLDER') {
        visit(node.repoObjects ?? []);
        continue;
      }
      if (!node.path.toLowerCase().endsWith('.saikudash')) continue;
      dashboards.push({
        path: toRepoRelative(node.path),
        name: node.name.replace(/\.saikudash$/i, ''),
        owner: node.owner,
        modified: node.modified,
      });
    }
  };
  visit(tree);
  return dashboards.sort((left, right) => left.name.localeCompare(right.name));
}

export function getSavedDashboard(path: string): Promise<Dashboard> {
  return loadDashboard(path);
}

export function listSavedApps(): Promise<AppSummary[]> {
  return listApps();
}

export function getSavedApp(path: string): Promise<SaikuApp> {
  return getApp(path);
}

export interface CubeMetadata {
  dimensions: SaikuDimension[];
  measures: SaikuMeasure[];
}

async function getJson<T>(path: string): Promise<T> {
  const response = await olapFetch(path, {
    headers: { Accept: 'application/json' },
  });
  if (!response.ok)
    throw new Error(
      `No se pudieron cargar los metadatos (${response.status}).`,
    );
  return (await response.json()) as T;
}

/** Discover connections and visible cubes using the authenticated BFF session. */
export function listOlapConnections(
  username: string,
): Promise<SaikuConnection[]> {
  return getJson(`/rest/saiku/${encodeURIComponent(username)}/discover`);
}

/** Load dimensions and measures for a cube from Saiku's discovery API. */
export async function getCubeMetadata(
  username: string,
  cube: SaikuCube,
): Promise<CubeMetadata> {
  const base = `/rest/saiku/${encodeURIComponent(username)}/discover/${encodeURIComponent(cube.connection)}/${encodeURIComponent(cube.catalog)}/${encodeURIComponent(cube.schema)}/${encodeURIComponent(cube.name)}`;
  const [dimensions, measures] = await Promise.all([
    getJson<SaikuDimension[]>(`${base}/dimensions`),
    getJson<SaikuMeasure[]>(`${base}/measures/`),
  ]);
  return { dimensions, measures };
}

export interface AiQueryCell {
  value: number | null;
  formatted: string;
  unit?: string | null;
  properties?: Record<string, string>;
}

export interface AiQueryResponse {
  queryId: string;
  status: string;
  metadata?: {
    rows: Array<{ name: string; caption: string }>;
    columns: Array<{ name: string; caption: string }>;
    measures: string[];
  };
  data?: Array<Record<string, AiQueryCell | string>>;
  error?: string;
}

/** Execute a saved dashboard/app tile via the same AI query API used by Saiku. */
export async function executeSavedTileQuery(
  query: DashboardTile['query'],
): Promise<AiQueryResponse> {
  if (!query) throw new Error('Este bloque no tiene una consulta asociada.');
  const isReference = query.kind === 'reference';
  const path = isReference
    ? '/rest/saiku/api/ai/query/saved'
    : '/rest/saiku/api/ai/query?format=records';
  const body = isReference
    ? { path: toRepoRelative(query.path), filters: [] }
    : query.body;
  const response = await olapFetch(path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  if (!text)
    throw new Error(
      `La consulta no devolvió una respuesta (${response.status}).`,
    );
  let result: AiQueryResponse;
  try {
    result = JSON.parse(text) as AiQueryResponse;
  } catch {
    throw new Error(
      `Respuesta no válida al ejecutar la consulta (${response.status}).`,
    );
  }
  if (result.status !== 'SUCCESS') {
    throw new Error(
      result.error ?? 'No se pudo ejecutar la consulta del bloque.',
    );
  }
  return result;
}
