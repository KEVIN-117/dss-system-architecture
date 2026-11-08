export interface PublishedMember {
  name: string;
  uniqueName: string;
  caption?: string | null;
}

export interface CubeAxisPath {
  dimension: string;
  hierarchy: string;
  level: string;
}

export interface AcademicCubePaths {
  enrollmentAttempts: string;
  averageFinalGrade: string;
  enrollmentUnit: string;
  gradeUnit: string;
  academicYear: CubeAxisPath;
  academicPeriod: CubeAxisPath;
  faculty: CubeAxisPath;
}

export interface ChartPoint {
  label: string;
  value: number;
}

type RecordValue = Record<string, unknown>;

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
  return values(collection).find((candidate) => displayName(candidate)?.toLocaleLowerCase() === name.toLocaleLowerCase()) as RecordValue | undefined ?? null;
}

export function resolveAcademicCubePaths(schema: unknown): AcademicCubePaths | null {
  if (!isRecord(schema)) return null;
  const measures = values(schema.measures).filter((item): item is RecordValue => isRecord(item) && item.visible !== false && item.pii !== true);
  const findMeasure = (name: string) => measures.find((measure) => displayName(measure)?.toLocaleLowerCase() === name.toLocaleLowerCase());
  const enrollmentMeasure = findMeasure('Enrollment Attempts');
  const gradeMeasure = findMeasure('Average Final Grade');
  const enrollmentAttempts = enrollmentMeasure?.name;
  const averageFinalGrade = gradeMeasure?.name;
  const dimensions = schema.dimensions;
  if (typeof enrollmentAttempts !== 'string' || typeof averageFinalGrade !== 'string' || !isRecord(dimensions)) return null;

  const findPath = (dimensionName: string, hierarchyName: string, levelName: string): CubeAxisPath | null => {
    const dimension = findByName(dimensions, dimensionName);
    const hierarchy = dimension && findByName(dimension.hierarchies, hierarchyName);
    const level = hierarchy && findByName(hierarchy.levels, levelName);
    if (!dimension || !hierarchy || !level) return null;
    return { dimension: dimension.name as string, hierarchy: hierarchy.name as string, level: level.name as string };
  };

  const academicYear = findPath('Academic Period', 'Academic Period', 'Academic Year');
  const academicPeriod = findPath('Academic Period', 'Academic Period', 'Period Number');
  const faculty = findPath('Academic Program', 'Program', 'Faculty');
  if (!academicYear || !academicPeriod || !faculty) return null;
  return {
    enrollmentAttempts,
    averageFinalGrade,
    enrollmentUnit: typeof enrollmentMeasure?.unit === 'string' ? enrollmentMeasure.unit : 'intentos',
    gradeUnit: typeof gradeMeasure?.unit === 'string' ? gradeMeasure.unit : 'escala de calificación institucional',
    academicYear,
    academicPeriod,
    faculty,
  };
}

export function readPublishedMembers(value: unknown): PublishedMember[] {
  if (!Array.isArray(value)) return [];
  return value.filter((member): member is PublishedMember =>
    isRecord(member) && typeof member.name === 'string' && typeof member.uniqueName === 'string' &&
    typeof (member.caption ?? member.name) === 'string',
  ).map((member) => ({ name: member.name, uniqueName: member.uniqueName, caption: member.caption ?? member.name }));
}

function normalize(value: string): string {
  return value.toLocaleLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
}

function readCellNumber(value: unknown): number | null {
  const raw = isRecord(value) ? value.value : value;
  if (typeof raw === 'string' && !raw.trim()) return null;
  const parsed = typeof raw === 'number' ? raw : typeof raw === 'string' ? Number(raw.trim()) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : null;
}

function findCell(row: RecordValue, name: string): unknown {
  const target = normalize(name);
  const match = Object.entries(row).find(([key]) => normalize(key) === target || normalize(key).endsWith(target));
  return match?.[1];
}

function readLabel(row: RecordValue, levelName: string): string | null {
  const cell = findCell(row, levelName);
  if (typeof cell === 'string' || typeof cell === 'number') return String(cell);
  if (isRecord(cell)) {
    for (const key of ['caption', 'name', 'value']) {
      if (typeof cell[key] === 'string' || typeof cell[key] === 'number') return String(cell[key]);
    }
  }
  return null;
}

export function readMetric(rows: unknown, measureName: string): number | null {
  if (!Array.isArray(rows) || !isRecord(rows[0])) return null;
  return readCellNumber(findCell(rows[0], measureName));
}

export function readDimensionSeries(rows: unknown, levelName: string, measureName: string): ChartPoint[] {
  if (!Array.isArray(rows)) return [];
  return rows.flatMap((row): ChartPoint[] => {
    if (!isRecord(row)) return [];
    const label = readLabel(row, levelName);
    const value = readCellNumber(findCell(row, measureName));
    return label !== null && value !== null ? [{ label, value }] : [];
  });
}

export function readDimensionSeriesByLevels(rows: unknown, levelNames: string[], measureName: string): ChartPoint[] {
  if (!Array.isArray(rows)) return [];
  return rows.flatMap((row): ChartPoint[] => {
    if (!isRecord(row)) return [];
    const labels = levelNames.map((levelName) => readLabel(row, levelName));
    const value = readCellNumber(findCell(row, measureName));
    return labels.every((label): label is string => label !== null) && value !== null
      ? [{ label: labels.join(' · '), value }]
      : [];
  });
}

export function sortAcademicPeriods(points: ChartPoint[]): ChartPoint[] {
  return [...points].sort((left, right) => left.label.localeCompare(right.label, undefined, { numeric: true }));
}
