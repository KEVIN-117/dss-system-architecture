import type { Axis } from './rendimiento-data';
import { FACULTY_BREAKDOWN, type Breakdown, type RendimientoView, type ViewMeasure } from './rendimiento-views';

const P = 'Permanencia y deserción' as const;

const axis = (dimension: string, hierarchy: string, level: string): Axis => ({ dimension, hierarchy, level });
const TIPO = axis('Tipo de estudiante', 'Tipo de estudiante', 'Tipo de estudiante');
const COHORTE = axis('Cohorte', 'Gestión de ingreso', 'Gestión de ingreso');
const SEXO = axis('Perfil del estudiante', 'Sexo', 'Sexo');
const COLEGIO = axis('Perfil del estudiante', 'Tipo de colegio', 'Tipo de colegio');
const DEPARTAMENTO = axis('Procedencia', 'Departamento, provincia y localidad', 'Departamento');
const SEDE = axis('Sede', 'Sede y carrera', 'Sede');
const REGIMEN = axis('Programa', 'Régimen y carrera', 'Régimen');

const BREAKDOWNS: Record<string, Breakdown> = {
  facultad: FACULTY_BREAKDOWN,
  tipo: { id: 'tipo', label: 'Tipo de estudiante', first: TIPO, firstPlural: 'Tipos de estudiante' },
  cohorte: { id: 'cohorte', label: 'Gestión de ingreso', first: COHORTE, firstPlural: 'Gestiones de ingreso' },
  sexo: { id: 'sexo', label: 'Sexo', first: SEXO, firstPlural: 'Sexo' },
  colegio: { id: 'colegio', label: 'Tipo de colegio', first: COLEGIO, firstPlural: 'Tipos de colegio' },
  procedencia: {
    id: 'procedencia',
    label: 'Departamento de procedencia',
    first: DEPARTAMENTO,
    firstPlural: 'Departamentos',
    second: axis('Procedencia', 'Departamento, provincia y localidad', 'Provincia'),
    secondPlural: 'Provincias',
  },
  sede: { id: 'sede', label: 'Central y sedes', first: SEDE, firstPlural: 'Sedes', second: axis('Sede', 'Sede y carrera', 'Carrera'), secondPlural: 'Carreras' },
  regimen: { id: 'regimen', label: 'Régimen de la carrera', first: REGIMEN, firstPlural: 'Regímenes', second: axis('Programa', 'Régimen y carrera', 'Carrera'), secondPlural: 'Carreras' },
};

const M = {
  permanencia: { source: P, name: 'Tasa de permanencia', label: 'Tasa de permanencia', format: 'percent', help: 'Estudiantes que vuelven a inscribirse en su carrera el periodo siguiente, sobre los estudiantes evaluados.' },
  desercion: { source: P, name: 'Tasa de deserción', label: 'Tasa de deserción', format: 'percent', help: 'Estudiantes que no vuelven a inscribirse en su carrera el periodo siguiente, sobre los estudiantes evaluados.' },
  inscritos: { source: P, name: 'Estudiantes en el periodo', label: 'Inscripciones por periodo', format: 'count', help: 'Estudiantes inscritos en cada periodo; en carreras semestrales cada estudiante cuenta una vez por semestre.' },
  evaluados: { source: P, name: 'Estudiantes evaluados', label: 'Evaluados', format: 'count', help: 'Inscripciones cuyo periodo siguiente ya está cargado y cerrado.' },
  permanecen: { source: P, name: 'Permanecen', label: 'Permanecen', format: 'count' },
  desertan: { source: P, name: 'Desertan', label: 'Desertan', format: 'count' },
  sinEvaluacion: { source: P, name: 'Sin evaluación', label: 'Sin evaluación', format: 'count', help: 'Inscripciones que todavía no se pueden evaluar porque falta el periodo siguiente.' },
  ppa: { source: P, name: 'Promedio acumulado', label: 'Promedio acumulado (PPA)', format: 'decimal', help: 'Promedio de notas acumulado del estudiante al cierre del periodo.' },
  arrastradas: { source: P, name: 'Materias arrastradas promedio', label: 'Materias arrastradas', format: 'decimal', help: 'Materias reprobadas o abandonadas que el estudiante aún no aprobó, en promedio.' },
  cursadas: { source: P, name: 'Materias cursadas promedio', label: 'Materias cursadas', format: 'decimal', help: 'Materias programadas en el periodo, en promedio por estudiante.' },
  aprobadas: { source: P, name: 'Materias aprobadas promedio', label: 'Materias aprobadas', format: 'decimal' },
  reprobadas: { source: P, name: 'Materias reprobadas promedio', label: 'Materias reprobadas', format: 'decimal' },
} satisfies Record<string, ViewMeasure>;

const BASE = [M.permanencia, M.desercion, M.evaluados, M.desertan, M.permanecen, M.sinEvaluacion, M.inscritos];
const STACK = [
  { name: 'Permanecen', label: 'Permanecen' },
  { name: 'Desertan', label: 'Desertan' },
];
const SOURCE = 'Fuente: DW institucional (cubo «Permanencia y deserción»). No hay un boletín DSA de permanencia: las definiciones son las del DW y están pendientes de validación por la DSA.';
const DEFINITION =
  'Un estudiante permanece si vuelve a inscribirse en la misma carrera el periodo siguiente de su régimen (semestre o año); si no vuelve, deserta.';
const PARTIAL = 'La última gestión cargada (2021) solo evalúa su primer periodo: falta el periodo siguiente para el segundo, por eso su tasa es parcial.';
const common = { section: 'Permanencia académica', sourceNote: SOURCE, stack: STACK, headline: 'Tasa de permanencia' } as const;

export const PERMANENCIA_VIEWS: RendimientoView[] = [
  {
    ...common,
    slug: 'resumen',
    title: 'Resumen de la permanencia',
    sidebarTitle: 'Resumen',
    description: 'Estudiantes que permanecen y que desertan de su carrera por gestión, con el ranking de facultades, carreras y sedes.',
    measures: BASE,
    kpiCount: 4,
    breakdowns: [BREAKDOWNS.facultad, BREAKDOWNS.sede, BREAKDOWNS.regimen],
    notes: [DEFINITION, PARTIAL],
  },
  {
    ...common,
    slug: 'cohortes',
    title: 'Permanencia por gestión de ingreso',
    sidebarTitle: 'Por cohorte de ingreso',
    description: 'Permanencia de cada cohorte (gestión en que el estudiante ingresó a la carrera) y peso de cada cohorte en la matrícula de cada gestión.',
    measures: BASE,
    kpiCount: 4,
    breakdowns: [BREAKDOWNS.cohorte],
    composition: { source: P, measure: 'Estudiantes en el periodo', axis: COHORTE, label: 'Gestión de ingreso' },
    notes: [
      '«Sin historial previo» agrupa a quienes ingresaron antes de 2015, la primera gestión cargada en el DW.',
      DEFINITION,
    ],
  },
  {
    ...common,
    slug: 'tipo-estudiante',
    title: 'Permanencia de estudiantes nuevos y antiguos',
    sidebarTitle: 'Nuevos y antiguos',
    description: 'Comparación de la permanencia entre estudiantes que cursan su primera gestión en la carrera y los que ya tienen gestiones anteriores.',
    measures: BASE,
    kpiCount: 4,
    breakdowns: [BREAKDOWNS.tipo, BREAKDOWNS.facultad],
    composition: { source: P, measure: 'Estudiantes en el periodo', axis: TIPO, label: 'Tipo de estudiante' },
    notes: ['«Sin historial previo» son estudiantes que ya estaban en la carrera antes de 2015 y no se puede saber si son nuevos.', DEFINITION],
  },
  {
    ...common,
    slug: 'perfil',
    title: 'Permanencia según el perfil del estudiante',
    sidebarTitle: 'Perfil del estudiante',
    description: 'Permanencia y deserción por sexo y por tipo de colegio de egreso.',
    measures: BASE,
    kpiCount: 4,
    breakdowns: [BREAKDOWNS.sexo, BREAKDOWNS.colegio],
    composition: { source: P, measure: 'Desertan', axis: SEXO, label: 'Sexo' },
    notes: [DEFINITION],
  },
  {
    ...common,
    slug: 'procedencia',
    title: 'Permanencia según la procedencia',
    sidebarTitle: 'Procedencia',
    description: 'Permanencia y deserción por departamento y provincia de procedencia del estudiante.',
    measures: BASE,
    kpiCount: 4,
    breakdowns: [BREAKDOWNS.procedencia],
    notes: ['La procedencia es la registrada en la ficha del estudiante; «Extranjero» agrupa a quienes vienen de otro país.', DEFINITION],
  },
  {
    ...common,
    slug: 'sedes',
    title: 'Permanencia en la central y las sedes',
    sidebarTitle: 'Central y sedes',
    description: 'Permanencia y deserción en la sede central y en las sedes desconcentradas, con el detalle de sus carreras.',
    measures: BASE,
    kpiCount: 4,
    breakdowns: [BREAKDOWNS.sede],
    composition: { source: P, measure: 'Desertan', axis: SEDE, label: 'Sede' },
    notes: [DEFINITION],
  },
  {
    ...common,
    slug: 'situacion-academica',
    title: 'Situación académica y deserción',
    sidebarTitle: 'Situación académica',
    description: 'Promedio acumulado, materias arrastradas y carga de materias junto a la tasa de deserción, para ubicar dónde se concentra el riesgo.',
    measures: [M.desercion, M.ppa, M.arrastradas, M.cursadas, M.aprobadas, M.reprobadas, M.evaluados],
    stack: undefined,
    headline: 'Tasa de deserción',
    kpiCount: 4,
    breakdowns: [BREAKDOWNS.facultad, BREAKDOWNS.regimen, BREAKDOWNS.tipo],
    notes: [
      'Los promedios son por inscripción en el periodo: en carreras semestrales cada estudiante aporta un valor por semestre.',
      'La tasa de deserción muestra dónde abandonan más; no implica que el promedio o las materias arrastradas sean la causa.',
    ],
  },
];

export function findPermanenciaView(slug: string): RendimientoView | undefined {
  return PERMANENCIA_VIEWS.find((view) => view.slug === slug);
}
