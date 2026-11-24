import type { Axis } from './rendimiento-data';
import { FACULTY_BREAKDOWN, type Breakdown, type RendimientoView, type ViewMeasure } from './rendimiento-views';

const MT = 'Matrícula' as const;

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
  matriculados: {
    source: MT,
    name: 'Estudiantes matriculados',
    label: 'Matriculados',
    format: 'count',
    help: 'Estudiantes con al menos una materia cursada en la carrera y el periodo. Un estudiante en dos carreras cuenta en ambas.',
  },
  nuevos: { source: MT, name: 'Estudiantes nuevos', label: 'Nuevos', format: 'count', help: 'Cursan por primera vez en la carrera en ese periodo.' },
  pctNuevos: {
    source: MT,
    name: 'Porcentaje de nuevos',
    label: '% de nuevos',
    format: 'percent',
    help: 'Nuevos sobre nuevos más antiguos; no incluye a los estudiantes sin historial previo.',
  },
  materias: { source: MT, name: 'Materias inscritas promedio', label: 'Materias por estudiante', format: 'decimal', help: 'Promedio de materias inscritas por estudiante en el periodo.' },
  antiguos: { source: MT, name: 'Estudiantes antiguos', label: 'Antiguos', format: 'count', help: 'Ya habían cursado la carrera en un periodo anterior.' },
  sinHistorial: {
    source: MT,
    name: 'Sin historial previo',
    label: 'Sin historial previo',
    format: 'count',
    help: 'Su primer cursado registrado es el primer periodo cargado en el DW (2015-1); no se sabe si son nuevos.',
  },
} satisfies Record<string, ViewMeasure>;

const BASE = [M.matriculados, M.nuevos, M.pctNuevos, M.materias, M.antiguos, M.sinHistorial];
const STACK = [
  { name: 'Estudiantes nuevos', label: 'Nuevos' },
  { name: 'Estudiantes antiguos', label: 'Antiguos' },
  { name: 'Sin historial previo', label: 'Sin historial previo' },
];
const SOURCE = 'Fuente: DW institucional (cubo «Matrícula»): estudiantes con cursado en cada periodo cerrado.';
const SEMESTERS =
  'La matrícula se cuenta por periodo: en una carrera semestral un estudiante cuenta una vez por semestre, así que la cifra de la gestión suma ambos semestres.';
const common = { section: 'Matrícula', sourceNote: SOURCE, stack: STACK, headline: 'Estudiantes matriculados', kpiCount: 4 } as const;

export const MATRICULA_VIEWS: RendimientoView[] = [
  {
    ...common,
    slug: 'resumen',
    title: 'Resumen de la matrícula',
    sidebarTitle: 'Resumen',
    description: 'Estudiantes matriculados, nuevos y antiguos por gestión, con el ranking de facultades, sedes y regímenes.',
    measures: BASE,
    breakdowns: [BREAKDOWNS.facultad, BREAKDOWNS.sede, BREAKDOWNS.regimen],
    notes: [SEMESTERS],
  },
  {
    ...common,
    slug: 'facultades',
    title: 'Matrícula por facultad y carrera',
    sidebarTitle: 'Facultad y carrera',
    description: 'Estudiantes matriculados por facultad; elige una facultad para ver sus carreras.',
    measures: BASE,
    breakdowns: [BREAKDOWNS.facultad],
    notes: [SEMESTERS],
  },
  {
    ...common,
    slug: 'tipo-estudiante',
    title: 'Estudiantes nuevos y antiguos',
    sidebarTitle: 'Nuevos y antiguos',
    description: 'Peso de los estudiantes que cursan su primer periodo en la carrera frente a quienes ya tienen periodos anteriores.',
    measures: BASE,
    breakdowns: [BREAKDOWNS.tipo, BREAKDOWNS.facultad],
    composition: { source: MT, measure: 'Estudiantes matriculados', axis: TIPO, label: 'Tipo de estudiante' },
    notes: [SEMESTERS],
  },
  {
    ...common,
    slug: 'cohortes',
    title: 'Matrícula por gestión de ingreso',
    sidebarTitle: 'Por cohorte de ingreso',
    description: 'Cuántos estudiantes de cada gestión de ingreso siguen matriculados en la gestión elegida.',
    measures: BASE,
    breakdowns: [BREAKDOWNS.cohorte],
    notes: ['«Sin historial previo» agrupa a quienes ingresaron antes de 2015, la primera gestión cargada en el DW.', SEMESTERS],
  },
  {
    ...common,
    slug: 'perfil',
    title: 'Matrícula según el perfil del estudiante',
    sidebarTitle: 'Perfil del estudiante',
    description: 'Estudiantes matriculados por sexo y por tipo de colegio de egreso.',
    measures: BASE,
    breakdowns: [BREAKDOWNS.sexo, BREAKDOWNS.colegio],
    composition: { source: MT, measure: 'Estudiantes matriculados', axis: SEXO, label: 'Sexo' },
    notes: [SEMESTERS],
  },
  {
    ...common,
    slug: 'procedencia',
    title: 'Matrícula según la procedencia',
    sidebarTitle: 'Procedencia',
    description: 'Estudiantes matriculados por departamento y provincia de procedencia.',
    measures: BASE,
    breakdowns: [BREAKDOWNS.procedencia],
    notes: ['La procedencia es la registrada en la ficha del estudiante; «Extranjero» agrupa a quienes vienen de otro país.', SEMESTERS],
  },
  {
    ...common,
    slug: 'sedes',
    title: 'Matrícula en la central y las sedes',
    sidebarTitle: 'Central y sedes',
    description: 'Estudiantes matriculados en la sede central y en las sedes desconcentradas, con el detalle de sus carreras.',
    measures: BASE,
    breakdowns: [BREAKDOWNS.sede],
    composition: { source: MT, measure: 'Estudiantes matriculados', axis: SEDE, label: 'Sede' },
    notes: [SEMESTERS],
  },
];

export function findMatriculaView(slug: string): RendimientoView | undefined {
  return MATRICULA_VIEWS.find((view) => view.slug === slug);
}
