/** Data access for the Rendimiento section (BFF GraphQL over the OLAP cubes). */

export type MeasureFormat = 'count' | 'percent' | 'decimal';

export interface Axis {
  dimension: string;
  hierarchy: string;
  level: string;
}

export interface Member {
  name: string;
  uniqueName: string;
  caption: string;
}

export type CubeName = 'Rendimiento académico' | 'Rendimiento estudiantil';

/** Year axis of each cube: coursework is by period, students by gestión. */
export const YEAR_AXIS: Record<CubeName, Axis> = {
  'Rendimiento académico': { dimension: 'Periodo', hierarchy: 'Gestión y periodo', level: 'Gestión' },
  'Rendimiento estudiantil': { dimension: 'Gestión', hierarchy: 'Gestión', level: 'Gestión' },
};
export const FACULTY_AXIS: Axis = { dimension: 'Programa', hierarchy: 'Facultad y carrera', level: 'Facultad' };
export const CAREER_AXIS: Axis = { dimension: 'Programa', hierarchy: 'Facultad y carrera', level: 'Carrera' };

export type DataRow = Record<string, unknown>;

const CUBES = `query RendimientoCubes { olapCubes { cubeId cubeName } }`;
const MEMBERS = `query RendimientoMembers($cubeId: ID!, $dimension: String!, $hierarchy: String!, $level: String!, $limit: Int) { olapCubeMembers(cubeId: $cubeId, dimension: $dimension, hierarchy: $hierarchy, level: $level, limit: $limit) { name caption uniqueName } }`;
const QUERY = `query RendimientoQuery($input: AnalyticQueryInput!) { analyticQuery(input: $input) { data } }`;

async function request<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
  const base = process.env.NEXT_PUBLIC_BFF_URL?.replace(/\/$/, '');
  if (!base) throw new Error('No se ha configurado la conexión del portal.');
  let response: Response;
  try {
    response = await fetch(`${base}/api/graphql`, {
      method: 'POST',
      credentials: 'include',
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables }),
    });
  } catch {
    throw new Error('No se pudo conectar con el servicio de analítica.');
  }
  const result = (await response.json().catch(() => null)) as {
    data?: T;
    errors?: { message?: string; extensions?: { code?: string } }[];
  } | null;
  if (response.status === 401 || result?.errors?.[0]?.extensions?.code === 'UNAUTHENTICATED')
    throw new Error('La sesión expiró. Inicia sesión nuevamente.');
  if (!response.ok || result?.errors?.length || !result?.data)
    throw new Error(result?.errors?.[0]?.message ?? 'No se pudo consultar el cubo de rendimiento.');
  return result.data;
}

let cubeIds: Promise<Map<string, string>> | null = null;

/** Resolves published cube ids once per page load. */
export async function cubeId(name: CubeName): Promise<string> {
  cubeIds ??= request<{ olapCubes: { cubeId: string; cubeName: string }[] }>(CUBES)
    .then(({ olapCubes }) => new Map(olapCubes.map((cube) => [cube.cubeName.toLocaleLowerCase('es'), cube.cubeId])))
    .catch((error: unknown) => {
      cubeIds = null;
      throw error;
    });
  const id = (await cubeIds).get(name.toLocaleLowerCase('es'));
  if (!id) throw new Error(`El cubo «${name}» no está disponible para tu cuenta.`);
  return id;
}

export async function yearMembers(cube: CubeName): Promise<Member[]> {
  const result = await request<{ olapCubeMembers: Array<Partial<Member>> }>(MEMBERS, {
    cubeId: await cubeId(cube),
    ...YEAR_AXIS[cube],
    limit: 100,
  });
  return (result.olapCubeMembers ?? [])
    .filter((m): m is Member => typeof m.name === 'string' && typeof m.uniqueName === 'string')
    .map((m) => ({ name: m.name, uniqueName: m.uniqueName, caption: m.caption ?? m.name }))
    .sort((a, b) => a.caption.localeCompare(b.caption, 'es', { numeric: true }));
}

export async function queryCube(
  cube: CubeName,
  measures: string[],
  rows: Axis[],
  year?: Member,
): Promise<DataRow[]> {
  const filters = year ? [{ ...YEAR_AXIS[cube], op: 'IN', members: [year.uniqueName] }] : [];
  const result = await request<{ analyticQuery: { data: unknown } }>(QUERY, {
    input: { cubeId: await cubeId(cube), measures: measures.map((name) => ({ name })), rows, filters, limit: 500 },
  });
  const data = result.analyticQuery?.data;
  return Array.isArray(data) ? data.filter((row): row is DataRow => typeof row === 'object' && row !== null) : [];
}

function normalize(value: string): string {
  return value.toLocaleLowerCase('es').normalize('NFD').replace(/[^\p{L}\p{N}]/gu, '');
}

function cell(row: DataRow, key: string): unknown {
  const target = normalize(key);
  return Object.entries(row).find(([name]) => normalize(name) === target || normalize(name).endsWith(target))?.[1];
}

export function readNumber(row: DataRow, measure: string): number | null {
  const raw = cell(row, measure);
  const value = typeof raw === 'object' && raw !== null && 'value' in raw ? (raw as { value: unknown }).value : raw;
  if (typeof value === 'string' && !value.trim()) return null;
  const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : null;
}

export function readLabel(row: DataRow, level: string): string {
  const raw = cell(row, level);
  const value =
    typeof raw === 'object' && raw !== null
      ? ((raw as Record<string, unknown>).caption ?? (raw as Record<string, unknown>).name)
      : raw;
  const text = typeof value === 'string' || typeof value === 'number' ? String(value) : '';
  return text === '#null' || !text ? 'Sin dato' : text;
}

export function formatValue(value: number | null, format: MeasureFormat): string {
  if (value === null) return '—';
  if (format === 'percent')
    return new Intl.NumberFormat('es-BO', { style: 'percent', maximumFractionDigits: 1, minimumFractionDigits: 1 }).format(value);
  return new Intl.NumberFormat('es-BO', { maximumFractionDigits: format === 'decimal' ? 1 : 0 }).format(value);
}
