import { RecordValue, PublishedMember, CubeAxisPath, AcademicCubePaths, ChartPoint, AdmissionPaths } from '../../utils/types'

function isRecord(value: unknown): value is RecordValue {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function values(value: unknown): unknown[] {
  return isRecord(value) ? Object.values(value) : [];
}

function displayName(value: unknown): string | null {
  if (!isRecord(value) || typeof value.name !== 'string') return null;
  return value.name;
}

function findByName(collection: unknown, name: string): RecordValue | null {
  return (
    (values(collection).find(
      (candidate) =>
        displayName(candidate)?.toLocaleLowerCase() ===
        name.toLocaleLowerCase(),
    ) as RecordValue | undefined) ?? null
  );
}

export function resolveAdmissionPaths(schema: unknown) {
  if (!isRecord(schema)) return null;
  const measures = values(schema.measures).filter(
    (item): item is RecordValue =>
      isRecord(item) && item.visible !== false && item.pii !== true,
  );
  const measure = (name: string) =>
    measures.find(
      (item) =>
        displayName(item)?.toLocaleLowerCase() === name.toLocaleLowerCase(),
    )?.name;
  const axis = (
    dimensionName: string,
    hierarchyName: string,
    levelName: string,
  ): CubeAxisPath | null => {
    const dimension = findByName(schema.dimensions, dimensionName);
    const hierarchy =
      dimension && findByName(dimension.hierarchies, hierarchyName);
    const level = hierarchy && findByName(hierarchy.levels, levelName);
    return dimension && hierarchy && level
      ? {
          dimension: dimension.name as string,
          hierarchy: hierarchy.name as string,
          level: level.name as string,
        }
      : null;
  };
  const year = axis('Periodo', 'Gestión y periodo', 'Gestión');
  const faculty = axis('Programa', 'Facultad y carrera', 'Facultad');
  const applications = measure('Postulaciones');
  const applicants = measure('Postulaciones');
  const admitted = measure('Admitidos');
  const admittedApplications = measure('Admitidos');
  const knownApplications = measure('Postulaciones con resultado');
  if (
    !year ||
    !faculty ||
    typeof applications !== 'string' ||
    typeof applicants !== 'string' ||
    typeof admitted !== 'string'
  )
    return null;
  return {
    year,
    faculty,
    applications,
    applicants,
    admitted,
    admittedApplications:
      typeof admittedApplications === 'string' ? admittedApplications : null,
    knownApplications:
      typeof knownApplications === 'string' ? knownApplications : null,
  };
}

export function resolveRetentionPaths(schema: unknown) {
  if (!isRecord(schema)) return null;
  // Same conformed axis as the admission cube: Periodo › Gestión y periodo › Gestión.
  const dimension = findByName(schema.dimensions, 'Periodo');
  const hierarchy =
    dimension && findByName(dimension.hierarchies, 'Gestión y periodo');
  const level = hierarchy && findByName(hierarchy.levels, 'Gestión');
  const measures = values(schema.measures).filter(
    (item): item is RecordValue =>
      isRecord(item) && item.visible !== false && item.pii !== true,
  );
  const retained = measures.find(
    (item) => displayName(item)?.toLocaleLowerCase() === 'permanecen',
  )?.name;
  const evaluable = measures.find(
    (item) =>
      displayName(item)?.toLocaleLowerCase() === 'estudiantes evaluados',
  )?.name;
  if (
    !dimension ||
    !hierarchy ||
    !level ||
    typeof retained !== 'string' ||
    typeof evaluable !== 'string'
  )
    return null;
  return {
    year: {
      dimension: dimension.name as string,
      hierarchy: hierarchy.name as string,
      level: level.name as string,
    },
    retained,
    evaluable,
  };
}

export function resolveAcademicCubePaths(
  schema: unknown,
): AcademicCubePaths | null {
  if (!isRecord(schema)) return null;
  const measures = values(schema.measures).filter(
    (item): item is RecordValue =>
      isRecord(item) && item.visible !== false && item.pii !== true,
  );
  const findMeasure = (name: string) =>
    measures.find(
      (measure) =>
        displayName(measure)?.toLocaleLowerCase() === name.toLocaleLowerCase(),
    );
  const enrollmentMeasure = findMeasure('Inscripciones en materias');
  const gradeMeasure = findMeasure('Nota promedio');
  const enrollmentAttempts = enrollmentMeasure?.name;
  const averageFinalGrade = gradeMeasure?.name;
  const dimensions = schema.dimensions;
  if (
    typeof enrollmentAttempts !== 'string' ||
    typeof averageFinalGrade !== 'string' ||
    !isRecord(dimensions)
  )
    return null;

  const findPath = (
    dimensionName: string,
    hierarchyName: string,
    levelName: string,
  ): CubeAxisPath | null => {
    const dimension = findByName(dimensions, dimensionName);
    const hierarchy =
      dimension && findByName(dimension.hierarchies, hierarchyName);
    const level = hierarchy && findByName(hierarchy.levels, levelName);
    if (!dimension || !hierarchy || !level) return null;
    return {
      dimension: dimension.name as string,
      hierarchy: hierarchy.name as string,
      level: level.name as string,
    };
  };

  const academicYear = findPath(
    'Periodo',
    'Gestión y periodo',
    'Gestión',
  );
  const academicPeriod = findPath(
    'Periodo',
    'Gestión y periodo',
    'Periodo',
  );
  const faculty = findPath('Programa', 'Facultad y carrera', 'Facultad');
  if (!academicYear || !academicPeriod || !faculty) return null;
  return {
    enrollmentAttempts,
    averageFinalGrade,
    enrollmentUnit:
      typeof enrollmentMeasure?.unit === 'string'
        ? enrollmentMeasure.unit
        : 'inscripciones',
    gradeUnit:
      typeof gradeMeasure?.unit === 'string'
        ? gradeMeasure.unit
        : 'escala de calificación institucional',
    academicYear,
    academicPeriod,
    faculty,
  };
}

export function readPublishedMembers(value: unknown): PublishedMember[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(
      (member): member is PublishedMember =>
        isRecord(member) &&
        typeof member.name === 'string' &&
        typeof member.uniqueName === 'string' &&
        typeof (member.caption ?? member.name) === 'string',
    )
    .map((member) => ({
      name: member.name,
      uniqueName: member.uniqueName,
      caption: member.caption ?? member.name,
    }));
}

function normalize(value: string): string {
  return value.toLocaleLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
}

function readCellNumber(value: unknown): number | null {
  const raw = isRecord(value) ? value.value : value;
  if (typeof raw === 'string' && !raw.trim()) return null;
  const parsed =
    typeof raw === 'number'
      ? raw
      : typeof raw === 'string'
        ? Number(raw.trim())
        : Number.NaN;
  return Number.isFinite(parsed) ? parsed : null;
}

function findCell(row: RecordValue, name: string): unknown {
  const target = normalize(name);
  const match = Object.entries(row).find(
    ([key]) => normalize(key) === target || normalize(key).endsWith(target),
  );
  return match?.[1];
}

function readLabel(row: RecordValue, levelName: string): string | null {
  const cell = findCell(row, levelName);
  if (typeof cell === 'string' || typeof cell === 'number') return String(cell);
  if (isRecord(cell)) {
    for (const key of ['caption', 'name', 'value']) {
      if (typeof cell[key] === 'string' || typeof cell[key] === 'number')
        return String(cell[key]);
    }
  }
  return null;
}

export function readMetric(rows: unknown, measureName: string): number | null {
  if (!Array.isArray(rows) || !isRecord(rows[0])) return null;
  return readCellNumber(findCell(rows[0], measureName));
}

export function readDimensionSeries(
  rows: unknown,
  levelName: string,
  measureName: string,
): ChartPoint[] {
  if (!Array.isArray(rows)) return [];
  return rows.flatMap((row): ChartPoint[] => {
    if (!isRecord(row)) return [];
    const label = readLabel(row, levelName);
    const value = readCellNumber(findCell(row, measureName));
    return label !== null && value !== null ? [{ label, value }] : [];
  });
}

export function readDimensionSeriesByLevels(
  rows: unknown,
  levelNames: string[],
  measureName: string,
): ChartPoint[] {
  if (!Array.isArray(rows)) return [];
  return rows.flatMap((row): ChartPoint[] => {
    if (!isRecord(row)) return [];
    const labels = levelNames.map((levelName) => readLabel(row, levelName));
    const value = readCellNumber(findCell(row, measureName));
    return labels.every((label): label is string => label !== null) &&
      value !== null
      ? [{ label: labels.join(' · '), value }]
      : [];
  });
}

export function sortAcademicPeriods(points: ChartPoint[]): ChartPoint[] {
  return [...points].sort((left, right) =>
    left.label.localeCompare(right.label, undefined, { numeric: true }),
  );
}




export async function graphql<T>(
  query: string,
  variables?: Record<string, unknown>,
): Promise<T> {
  const baseUrl = process.env.NEXT_PUBLIC_BFF_URL?.replace(/\/$/, '');
  if (!baseUrl)
    throw new Error('El portal no tiene configurada la URL del BFF.');
  let response: Response;
  try {
    response = await fetch(`${baseUrl}/api/graphql`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      cache: 'no-store',
      body: JSON.stringify({ query, variables }),
    });
  } catch {
    throw new Error(
      'No se pudo conectar con el BFF. Revisa la conexión e inténtalo nuevamente.',
    );
  }
  const payload = (await response.json().catch(() => null)) as {
    data?: T;
    errors?: Array<{ message?: string; extensions?: { code?: string } }>;
  } | null;
  if (!response.ok || payload?.errors?.length) {
    const code = payload?.errors?.[0]?.extensions?.code;
    if (response.status === 401 || code === 'UNAUTHENTICATED')
      throw new Error(
        'La sesión expiró. Inicia sesión nuevamente para consultar la analítica.',
      );
    if (response.status === 403 || code === 'FORBIDDEN')
      throw new Error(
        'La cuenta no tiene permiso para consultar esta analítica.',
      );
    throw new Error(
      payload?.errors?.[0]?.message ??
        'No se pudo consultar la analítica institucional.',
    );
  }
  if (!payload?.data) throw new Error('El BFF devolvió una respuesta vacía.');
  return payload.data;
}



export function yearFilter(
  axis: AdmissionPaths['year'],
  member: PublishedMember | undefined,
) {
  return member ? [{ ...axis, op: 'IN', members: [member.uniqueName] }] : [];
}

export const count = (value: number | null) =>
  value === null
    ? '—'
    : new Intl.NumberFormat('es-BO', { maximumFractionDigits: 0 }).format(
        value,
      );
export const percent = (numerator: number | null, denominator: number | null) =>
  numerator === null || denominator === null || denominator <= 0
    ? '—'
    : new Intl.NumberFormat('es-BO', { maximumFractionDigits: 1 }).format(
        (numerator / denominator) * 100,
      ) + ' %';
