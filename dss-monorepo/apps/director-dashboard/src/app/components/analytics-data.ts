export interface AcademicContextSummary {
  kind: string;
  facultyIds: number[];
  careerIds: string[];
}

export interface PublishedMember {
  name: string;
  uniqueName: string;
  caption: string;
}

export interface CubeAxisPath {
  dimension: string;
  hierarchy: string;
  level: string;
}

export interface DirectorCubePaths {
  enrollmentAttempts: string;
  averageFinalGrade: string;
  gradedAttempts: string;
  enrollmentUnit: string;
  gradeUnit: string;
  academicYear: CubeAxisPath;
  academicPeriod: CubeAxisPath;
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

function named(value: unknown): value is RecordValue & { name: string } {
  return isRecord(value) && typeof value.name === 'string';
}

function findByName(collection: unknown, name: string): RecordValue | null {
  const match = values(collection).find(
    (candidate) =>
      named(candidate) &&
      candidate.name.toLocaleLowerCase() === name.toLocaleLowerCase(),
  );
  return isRecord(match) ? match : null;
}

export function resolveDirectorCubePaths(
  schema: unknown,
): DirectorCubePaths | null {
  if (!isRecord(schema)) return null;
  const measures = values(schema.measures).filter(
    (item): item is RecordValue =>
      isRecord(item) && item.visible !== false && item.pii !== true,
  );
  const findMeasure = (name: string) =>
    measures.find(
      (measure) =>
        named(measure) &&
        measure.name.toLocaleLowerCase() === name.toLocaleLowerCase(),
    );
  const enrollment = findMeasure('Enrollment Attempts');
  const averageGrade = findMeasure('Average Final Grade');
  const gradedAttempts = findMeasure('Graded Attempts');
  if (!named(enrollment) || !named(averageGrade) || !named(gradedAttempts))
    return null;

  const dimensions = schema.dimensions;
  const findPath = (
    dimensionName: string,
    hierarchyName: string,
    levelName: string,
  ): CubeAxisPath | null => {
    const dimension = findByName(dimensions, dimensionName);
    const hierarchy =
      dimension && findByName(dimension.hierarchies, hierarchyName);
    const level = hierarchy && findByName(hierarchy.levels, levelName);
    if (!named(dimension) || !named(hierarchy) || !named(level)) return null;
    return {
      dimension: dimension.name,
      hierarchy: hierarchy.name,
      level: level.name,
    };
  };
  const academicYear = findPath(
    'Academic Period',
    'Academic Period',
    'Academic Year',
  );
  const academicPeriod = findPath(
    'Academic Period',
    'Academic Period',
    'Period Number',
  );
  if (!academicYear || !academicPeriod) return null;

  return {
    enrollmentAttempts: enrollment.name,
    averageFinalGrade: averageGrade.name,
    gradedAttempts: gradedAttempts.name,
    enrollmentUnit:
      typeof enrollment.unit === 'string'
        ? enrollment.unit
        : 'intentos de cursado',
    gradeUnit:
      typeof averageGrade.unit === 'string'
        ? averageGrade.unit
        : 'escala institucional',
    academicYear,
    academicPeriod,
  };
}

export function readPublishedMembers(value: unknown): PublishedMember[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((member): PublishedMember[] => {
    if (
      !isRecord(member) ||
      typeof member.name !== 'string' ||
      typeof member.uniqueName !== 'string'
    )
      return [];
    const caption = member.caption ?? member.name;
    return typeof caption === 'string'
      ? [{ name: member.name, uniqueName: member.uniqueName, caption }]
      : [];
  });
}

function normalize(value: string): string {
  return value.toLocaleLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
}

function findCell(row: RecordValue, name: string): unknown {
  const target = normalize(name);
  return Object.entries(row).find(
    ([key]) => normalize(key) === target || normalize(key).endsWith(target),
  )?.[1];
}

function readNumber(value: unknown): number | null {
  const raw = isRecord(value) ? value.value : value;
  if (typeof raw === 'string' && !raw.trim()) return null;
  const number =
    typeof raw === 'number'
      ? raw
      : typeof raw === 'string'
        ? Number(raw.trim())
        : Number.NaN;
  return Number.isFinite(number) ? number : null;
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
  return readNumber(findCell(rows[0], measureName));
}

export function readPeriodSeries(
  rows: unknown,
  yearLevel: string,
  periodLevel: string,
  measureName: string,
  selectedYear?: string,
): ChartPoint[] {
  if (!Array.isArray(rows)) return [];
  return rows
    .flatMap((row): ChartPoint[] => {
      if (!isRecord(row)) return [];
      const year = readLabel(row, yearLevel);
      const period = readLabel(row, periodLevel);
      const value = readNumber(findCell(row, measureName));
      return year !== null &&
        (selectedYear === undefined || year === selectedYear) &&
        period !== null &&
        value !== null
        ? [{ label: `${year} · Periodo ${period}`, value }]
        : [];
    })
    .sort((left, right) =>
      left.label.localeCompare(right.label, undefined, { numeric: true }),
    );
}
