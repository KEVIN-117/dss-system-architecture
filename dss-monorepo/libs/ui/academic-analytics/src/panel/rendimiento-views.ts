import { CAREER_AXIS, FACULTY_AXIS, type Axis, type CubeName, type MeasureFormat } from './rendimiento-data';

/** One measure shown in a view; `source` is the cube that publishes it. */
export interface ViewMeasure {
  source: CubeName;
  name: string;
  label: string;
  format: MeasureFormat;
  /** Short plain-language meaning shown under the table. */
  help?: string;
}

/** A ranking of the selected gestión by one dimension, optionally drillable into a second. */
export interface Breakdown {
  id: string;
  /** Selector text, e.g. "Procedencia educativa". */
  label: string;
  first: Axis;
  /** Plural noun for the first level, e.g. "Facultades". */
  firstPlural: string;
  second?: Axis;
  /** Plural noun for the second level, e.g. "Carreras". */
  secondPlural?: string;
}

export const FACULTY_BREAKDOWN: Breakdown = {
  id: 'facultad',
  label: 'Facultad y carrera',
  first: FACULTY_AXIS,
  firstPlural: 'Facultades',
  second: CAREER_AXIS,
  secondPlural: 'Carreras',
};

/** Scoped portals (faculty or career) rank careers directly. */
export const CAREER_BREAKDOWN: Breakdown = {
  id: 'carrera',
  label: 'Carrera',
  first: CAREER_AXIS,
  firstPlural: 'Carreras',
};

export interface RendimientoView {
  slug: string;
  title: string;
  sidebarTitle: string;
  description: string;
  measures: ViewMeasure[];
  /** Parts of a 100 % stacked bar (labels and measure names); omit for a single-series chart. */
  stack?: { name: string; label: string }[];
  /** Headline measure: trend line by gestión and ranking order. */
  headline: string;
  /** Short notes on coverage or definitions. */
  notes?: string[];
  /** How many leading measures are shown as indicator cards (default 4). */
  kpiCount?: number;
  /** Rankings of the selected gestión (default: facultad, drillable to carrera). */
  breakdowns?: Breakdown[];
  /** Composition of one count measure by a category, for every gestión. */
  composition?: { source: CubeName; measure: string; axis: Axis; label: string };
  /** Section shown above the title (default "Rendimiento académico"). */
  section?: string;
  /** Data source note shown at the end of the page. */
  sourceNote?: string;
}

const M = 'Rendimiento académico' as const;
const E = 'Rendimiento estudiantil' as const;

export const RENDIMIENTO_VIEWS: RendimientoView[] = [
  {
    slug: 'resumen',
    title: 'Resumen del rendimiento académico',
    sidebarTitle: 'Resumen',
    description:
      'Indicadores principales de la gestión: estudiantes y materias programadas, aprobación, promedio de notas, repitencia y retención, con su evolución y el ranking de facultades.',
    measures: [
      { source: E, name: 'Estudiantes programados', label: 'Estudiantes programados', format: 'count', help: 'Estudiantes con al menos una materia programada en la carrera y la gestión.' },
      // { source: E, name: 'Porcentaje de aprobados', label: '% de estudiantes aprobados', format: 'percent', help: 'Estudiantes que aprobaron al menos la mitad de sus materias.' },
      { source: E, name: 'Promedio de notas', label: 'Promedio de notas (PN)', format: 'decimal', help: 'Promedio por estudiante; las materias sin nota cuentan como 0.' },
      { source: E, name: 'Índice de retención', label: 'Retención (IRETE)', format: 'percent', help: 'Estudiantes que siguen en su carrera la gestión siguiente.' },
      { source: M, name: 'Inscripciones en materias', label: 'Materias programadas', format: 'count', help: 'Cada materia que un estudiante programó en la gestión.' },
      { source: M, name: 'Porcentaje de materias aprobadas', label: '% de materias aprobadas', format: 'percent', help: 'Materias aprobadas sobre materias programadas.' },
      { source: E, name: 'Índice de repitencia de estudiantes', label: 'Repitencia de estudiantes (IRE)', format: 'percent', help: 'Estudiantes con al menos una materia repetida (desde 2016).' },
      { source: M, name: 'Tasa de repitencia', label: 'Repitencia de materias (IRM)', format: 'percent', help: 'Materias repetidas sobre materias programadas.' },
    ],
    headline: 'Porcentaje de aprobados',
    kpiCount: 8,
  },
  {
    slug: 'materias',
    title: 'Evaluación de materias',
    sidebarTitle: 'Evaluación de materias',
    description:
      'Resultado de las materias programadas: aprobadas, reprobadas y sin nota (abandono), por gestión, facultad y carrera.',
    measures: [
      { source: M, name: 'Inscripciones en materias', label: 'Materias programadas', format: 'count', help: 'Cada materia que un estudiante programó en la gestión.' },
      { source: M, name: 'Materias aprobadas', label: 'Aprobadas (AP)', format: 'count', help: 'Nota efectiva de 51 o más (mejor nota entre ordinaria, segundo turno y mesa).' },
      { source: M, name: 'Materias reprobadas', label: 'Reprobadas (REP)', format: 'count', help: 'Nota efectiva entre 1 y 50.' },
      { source: M, name: 'Materias sin nota', label: 'Abandono (AB)', format: 'count', help: 'Materia programada sin nota o con nota 0.' },
      { source: M, name: 'Porcentaje de materias aprobadas', label: '% AP', format: 'percent' },
      { source: M, name: 'Porcentaje de materias reprobadas', label: '% REP', format: 'percent' },
      { source: M, name: 'Porcentaje de materias sin nota', label: '% AB', format: 'percent' },
    ],
    stack: [
      { name: 'Materias aprobadas', label: 'Aprobadas' },
      { name: 'Materias reprobadas', label: 'Reprobadas' },
      { name: 'Materias sin nota', label: 'Abandono' },
    ],
    headline: 'Porcentaje de materias aprobadas',
  },
  {
    slug: 'estudiantes',
    title: 'Evaluación de estudiantes',
    sidebarTitle: 'Evaluación de estudiantes',
    description:
      'Clasificación anual de cada estudiante en su carrera según el resultado de sus materias programadas.',
    measures: [
      { source: E, name: 'Estudiantes programados', label: 'Estudiantes programados', format: 'count', help: 'Estudiantes con al menos una materia programada en la carrera y la gestión.' },
      { source: E, name: 'Estudiantes aprobados', label: 'Aprobados', format: 'count', help: 'Aprobaron al menos la mitad de sus materias de la gestión.' },
      { source: E, name: 'Estudiantes reprobados', label: 'Reprobados', format: 'count', help: 'No llegaron a la mitad de aprobadas y tienen más reprobadas que sin nota.' },
      { source: E, name: 'Estudiantes en abandono', label: 'Abandono', format: 'count', help: 'No llegaron a la mitad de aprobadas y la mayoría de sus materias quedó sin nota.' },
      { source: E, name: 'Porcentaje de aprobados', label: '% aprobados', format: 'percent' },
      { source: E, name: 'Porcentaje de reprobados', label: '% reprobados', format: 'percent' },
      { source: E, name: 'Porcentaje en abandono', label: '% abandono', format: 'percent' },
    ],
    stack: [
      { name: 'Estudiantes aprobados', label: 'Aprobados' },
      { name: 'Estudiantes reprobados', label: 'Reprobados' },
      { name: 'Estudiantes en abandono', label: 'Abandono' },
    ],
    headline: 'Porcentaje de aprobados',
    notes: ['Un estudiante inscrito en dos carreras se cuenta en cada una.'],
  },
  {
    slug: 'promedio-notas',
    title: 'Promedio de notas',
    sidebarTitle: 'Promedio de notas (PN)',
    description:
      'Promedio de notas (PN) de los estudiantes y carga de materias, por gestión, facultad y carrera.',
    measures: [
      { source: E, name: 'Promedio de notas', label: 'Promedio de notas (PN)', format: 'decimal', help: 'Promedio por estudiante de sus notas de la gestión; las materias sin nota cuentan como 0.' },
      { source: M, name: 'Nota promedio', label: 'Nota promedio de materias con nota', format: 'decimal', help: 'Promedio de la nota efectiva solo de las materias con nota (sin ceros).' },
      { source: E, name: 'Materias programadas por estudiante', label: 'Materias por estudiante', format: 'decimal' },
      { source: E, name: 'Estudiantes programados', label: 'Estudiantes programados', format: 'count' },
    ],
    headline: 'Promedio de notas',
    notes: ['El índice de rendimiento académico (IRA) del Boletín DSA pondera por créditos; Jachasun solo informa créditos en 130 de 7.647 materias, por eso se muestra el PN.'],
  },
  {
    slug: 'repitencia',
    title: 'Repitencia',
    sidebarTitle: 'Repitencia (IRE e IRM)',
    description:
      'Índice de repitencia de estudiantes (IRE) y de materias (IRM): quién vuelve a cursar materias que ya había programado.',
    measures: [
      { source: E, name: 'Índice de repitencia de estudiantes', label: 'IRE', format: 'percent', help: 'Estudiantes con al menos una materia repetida sobre estudiantes programados.' },
      { source: E, name: 'Estudiantes que repiten', label: 'Estudiantes que repiten', format: 'count' },
      { source: E, name: 'Estudiantes con historial', label: 'Estudiantes programados (base IRE)', format: 'count' },
      { source: M, name: 'Tasa de repitencia', label: 'IRM', format: 'percent', help: 'Materias repetidas sobre materias programadas.' },
      { source: M, name: 'Inscripciones repetidas', label: 'Materias repetidas', format: 'count' },
    ],
    headline: 'Índice de repitencia de estudiantes',
    notes: ['2015 es la primera gestión cargada en el DW: sin historia previa no se puede saber quién repite, por eso el IRE empieza en 2016.'],
  },
  {
    slug: 'retencion',
    title: 'Retención y deserción por gestión',
    sidebarTitle: 'Retención y deserción',
    description:
      'Estudiantes que vuelven a programar materias en su carrera la gestión siguiente (IRETE) y los que no vuelven (IDESE).',
    measures: [
      { source: E, name: 'Índice de retención', label: 'Retención (IRETE)', format: 'percent', help: 'Estudiantes que programan materias en la misma carrera la gestión siguiente.' },
      { source: E, name: 'Índice de deserción', label: 'Deserción (IDESE)', format: 'percent', help: 'Estudiantes que no vuelven a programar en la carrera la gestión siguiente.' },
      { source: E, name: 'Estudiantes retenidos', label: 'Retenidos', format: 'count' },
      { source: E, name: 'Estudiantes evaluables para retención', label: 'Estudiantes evaluados', format: 'count' },
    ],
    headline: 'Índice de retención',
    notes: [
      'La última gestión cargada (2021) no tiene retención porque falta la gestión siguiente.',
      'Este es el indicador anual del Boletín 3. El análisis por periodo, cohorte, perfil y procedencia está en «Permanencia académica».',
    ],
  },
];

export function findView(slug: string): RendimientoView | undefined {
  return RENDIMIENTO_VIEWS.find((view) => view.slug === slug);
}
