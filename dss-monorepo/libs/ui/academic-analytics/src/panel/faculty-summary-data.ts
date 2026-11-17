/**
 * Pure helpers for the scoped summaries (Dean: faculty and its careers;
 * Director: career and its subjects). The BFF already limits every query to the
 * user's academic scope; these functions only pick one unit (faculty or
 * career) out of the scoped rows and compare its details with the unit's value.
 */
import { readLabel, readNumber, type DataRow, type MeasureFormat } from './rendimiento-data';

export type SummaryCube = 'Admisión' | 'Rendimiento académico' | 'Permanencia y deserción';

export interface SummaryMeasure {
  key: SummaryKey;
  cube: SummaryCube;
  /** Measure name published by the cube. */
  measure: string;
  label: string;
  format: MeasureFormat;
}

export type SummaryKey =
  | 'applications'
  | 'admitted'
  | 'admissionRate'
  | 'attempts'
  | 'passRate'
  | 'failRate'
  | 'repetitionRate'
  | 'averageGrade'
  | 'evaluated'
  | 'dropoutRate'
  | 'retentionRate';

export const SUMMARY_MEASURES: SummaryMeasure[] = [
  { key: 'applications', cube: 'Admisión', measure: 'Postulaciones', label: 'Postulaciones', format: 'count' },
  { key: 'admitted', cube: 'Admisión', measure: 'Admitidos', label: 'Admitidos', format: 'count' },
  { key: 'admissionRate', cube: 'Admisión', measure: 'Tasa de admisión', label: 'Tasa de admisión', format: 'percent' },
  { key: 'attempts', cube: 'Rendimiento académico', measure: 'Inscripciones en materias', label: 'Inscripciones en materias', format: 'count' },
  { key: 'passRate', cube: 'Rendimiento académico', measure: 'Tasa de aprobación', label: 'Tasa de aprobación', format: 'percent' },
  { key: 'failRate', cube: 'Rendimiento académico', measure: 'Tasa de reprobación', label: 'Tasa de reprobación', format: 'percent' },
  { key: 'repetitionRate', cube: 'Rendimiento académico', measure: 'Tasa de repitencia', label: 'Tasa de repitencia', format: 'percent' },
  { key: 'averageGrade', cube: 'Rendimiento académico', measure: 'Nota promedio', label: 'Nota promedio', format: 'decimal' },
  { key: 'evaluated', cube: 'Permanencia y deserción', measure: 'Estudiantes evaluados', label: 'Estudiantes evaluados', format: 'count' },
  { key: 'dropoutRate', cube: 'Permanencia y deserción', measure: 'Tasa de deserción', label: 'Tasa de deserción', format: 'percent' },
  { key: 'retentionRate', cube: 'Permanencia y deserción', measure: 'Tasa de permanencia', label: 'Tasa de permanencia', format: 'percent' },
];

export const SUMMARY_CUBES: SummaryCube[] = ['Admisión', 'Rendimiento académico', 'Permanencia y deserción'];

export function measuresOf(cube: SummaryCube): SummaryMeasure[] {
  return SUMMARY_MEASURES.filter((item) => item.cube === cube);
}

export type SummaryValues = Partial<Record<SummaryKey, number | null>>;

/** Distinct faculty labels present in scoped rows, in alphabetical order. */
export function facultiesIn(rows: DataRow[], facultyLevel: string): string[] {
  const labels = new Set(rows.map((row) => readLabel(row, facultyLevel)).filter((label) => label !== 'Sin dato'));
  return [...labels].sort((a, b) => a.localeCompare(b, 'es'));
}

/** Reads the cube's measures for one row into summary keys. */
export function readValues(row: DataRow, cube: SummaryCube): SummaryValues {
  return Object.fromEntries(measuresOf(cube).map((item) => [item.key, readNumber(row, item.measure)]));
}

/**
 * One faculty's values per gestión, from rows grouped by [faculty, year].
 * Rows of other faculties in the dean's scope are ignored.
 */
export function facultyYearSeries(
  rows: DataRow[],
  cube: SummaryCube,
  faculty: string,
  facultyLevel: string,
  yearLevel: string,
): Map<string, SummaryValues> {
  const series = new Map<string, SummaryValues>();
  for (const row of rows) {
    if (readLabel(row, facultyLevel) !== faculty) continue;
    const year = readLabel(row, yearLevel);
    if (year === 'Sin dato') continue;
    series.set(year, { ...series.get(year), ...readValues(row, cube) });
  }
  return series;
}

export interface CareerRow {
  career: string;
  values: SummaryValues;
}

/**
 * Details of one unit (careers of a faculty, subjects of a career), from rows
 * grouped by [unit, detail] and merged across cubes by label. Two details with
 * the same label in one cube (e.g. a subject in two study plans) stay apart.
 */
export function mergeCareers(
  sources: Array<{ cube: SummaryCube; rows: DataRow[] }>,
  unit: string,
  unitLevel: string,
  detailLevel: string,
): CareerRow[] {
  const byDetail = new Map<string, SummaryValues>();
  for (const { cube, rows } of sources) {
    const seen = new Map<string, number>();
    for (const row of rows) {
      if (readLabel(row, unitLevel) !== unit) continue;
      const label = readLabel(row, detailLevel);
      if (label === 'Sin dato') continue;
      const n = (seen.get(label) ?? 0) + 1;
      seen.set(label, n);
      const key = n > 1 ? `${label} (${n})` : label;
      byDetail.set(key, { ...byDetail.get(key), ...readValues(row, cube) });
    }
  }
  return [...byDetail.entries()].map(([career, values]) => ({ career, values }));
}

/** Change against the previous gestión: relative for counts, percentage points for rates. */
export function deltaOf(
  current: number | null | undefined,
  previous: number | null | undefined,
  format: MeasureFormat,
): number | null {
  if (current == null || previous == null) return null;
  if (format === 'percent') return current - previous;
  if (previous === 0) return null;
  return (current - previous) / previous;
}

/** Percentage points a career must deviate from its faculty to be flagged. */
export const ATTENTION_THRESHOLD = 0.05;

export interface Attention {
  key: SummaryKey;
  message: string;
}

/** A rate whose distance from the unit's value, in the worse direction, raises a flag. */
export interface AttentionRule {
  key: SummaryKey;
  worse: 'below' | 'above';
  message: string;
}

/** Dean: careers compared with their faculty. */
export const FACULTY_RULES: AttentionRule[] = [
  { key: 'passRate', worse: 'below', message: 'Aprobación por debajo de la facultad' },
  { key: 'dropoutRate', worse: 'above', message: 'Deserción por encima de la facultad' },
];

/** Director: subjects compared with their career (bottleneck candidates). */
export const CAREER_RULES: AttentionRule[] = [
  { key: 'failRate', worse: 'above', message: 'Reprobación por encima de la carrera' },
  { key: 'repetitionRate', worse: 'above', message: 'Repitencia por encima de la carrera' },
];

/**
 * Flags a detail row that is worse than its unit by more than
 * ATTENTION_THRESHOLD on any rule. Missing values never raise a flag.
 */
export function attentionFor(
  detail: SummaryValues,
  unit: SummaryValues,
  rules: AttentionRule[] = FACULTY_RULES,
): Attention[] {
  return rules.flatMap((rule) => {
    const value = detail[rule.key];
    const reference = unit[rule.key];
    if (value == null || reference == null) return [];
    const gap = rule.worse === 'below' ? reference - value : value - reference;
    return gap > ATTENTION_THRESHOLD ? [{ key: rule.key, message: rule.message }] : [];
  });
}

/** Previous gestión label in an ordered list, or null for the first one. */
export function previousYear(years: string[], year: string): string | null {
  const index = years.indexOf(year);
  return index > 0 ? years[index - 1] : null;
}
