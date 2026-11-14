import type { Axis } from './rendimiento-data';
import { FACULTY_BREAKDOWN, type Breakdown, type RendimientoView, type ViewMeasure } from './rendimiento-views';

const A = 'Admisión' as const;

const axis = (dimension: string, hierarchy: string, level: string): Axis => ({ dimension, hierarchy, level });
const SEXO = axis('Sexo del postulante', 'Sexo', 'Sexo');
const COLEGIO = axis('Tipo de colegio del postulante', 'Tipo de colegio', 'Tipo de colegio');
const AREA = axis('Programa', 'Área y carrera', 'Área de conocimiento');
const SEDE = axis('Sede', 'Sede y carrera', 'Sede');
const MODALIDAD = axis('Modalidad de admisión', 'Grupo y modalidad', 'Grupo de modalidad');
const PROCEDENCIA = axis('Procedencia educativa', 'Ámbito y departamento', 'Ámbito');
const NACIMIENTO = axis('Lugar de nacimiento', 'Ámbito y departamento', 'Ámbito');

const BREAKDOWNS: Record<string, Breakdown> = {
  facultad: FACULTY_BREAKDOWN,
  area: { id: 'area', label: 'Área de conocimiento', first: AREA, firstPlural: 'Áreas de conocimiento', second: axis('Programa', 'Área y carrera', 'Carrera'), secondPlural: 'Carreras' },
  sede: { id: 'sede', label: 'Central y sedes', first: SEDE, firstPlural: 'Sedes', second: axis('Sede', 'Sede y carrera', 'Carrera'), secondPlural: 'Carreras' },
  sexo: { id: 'sexo', label: 'Sexo', first: SEXO, firstPlural: 'Sexo' },
  colegio: { id: 'colegio', label: 'Tipo de colegio', first: COLEGIO, firstPlural: 'Tipos de colegio' },
  modalidad: { id: 'modalidad', label: 'Modalidad de ingreso', first: MODALIDAD, firstPlural: 'Grupos de modalidad', second: axis('Modalidad de admisión', 'Grupo y modalidad', 'Modalidad'), secondPlural: 'Modalidades' },
  procedencia: { id: 'procedencia', label: 'Procedencia educativa', first: PROCEDENCIA, firstPlural: 'Procedencia educativa', second: axis('Procedencia educativa', 'Ámbito y departamento', 'Departamento'), secondPlural: 'Departamentos' },
  nacimiento: { id: 'nacimiento', label: 'Lugar de nacimiento', first: NACIMIENTO, firstPlural: 'Lugar de nacimiento', second: axis('Lugar de nacimiento', 'Ámbito y departamento', 'Departamento'), secondPlural: 'Departamentos' },
};

const M = {
  postulaciones: { source: A, name: 'Postulaciones', label: 'Postulantes', format: 'count', help: 'Postulaciones registradas a las carreras (cada registro de postulante).' },
  admitidos: { source: A, name: 'Admitidos', label: 'Admitidos', format: 'count', help: 'Postulaciones con resultado aprobado.' },
  noAdmitidos: { source: A, name: 'No admitidos', label: 'No admitidos', format: 'count', help: 'Postulaciones con resultado reprobado.' },
  tasa: { source: A, name: 'Tasa de admisión', label: '% de admitidos', format: 'percent', help: 'Admitidos sobre postulaciones con resultado conocido.' },
  crecPost: { source: A, name: 'Crecimiento de postulaciones', label: 'Crecimiento de postulantes', format: 'percent', help: 'Variación de postulantes frente a la gestión anterior.' },
  crecAdm: { source: A, name: 'Crecimiento de admitidos', label: 'Crecimiento de admitidos', format: 'percent', help: 'Variación de admitidos frente a la gestión anterior.' },
  puntaje: { source: A, name: 'Puntaje promedio de admisión', label: 'Nota promedio de admisión', format: 'decimal', help: 'Promedio de la nota de admisión registrada.' },
} satisfies Record<string, ViewMeasure>;

const BASE = [M.postulaciones, M.admitidos, M.tasa, M.noAdmitidos];
const STACK = [
  { name: 'Admitidos', label: 'Admitidos' },
  { name: 'No admitidos', label: 'No admitidos' },
];
const SOURCE = 'Fuente: DW institucional (cubo «Admisión»), con la estructura del Boletín 1 de la DSA (Admisión estudiantil).';
const common = { section: 'Admisión académica', sourceNote: SOURCE, stack: STACK, headline: 'Postulaciones' } as const;

export const ADMISION_VIEWS: RendimientoView[] = [
  {
    ...common,
    slug: 'resumen',
    title: 'Resumen de la admisión',
    sidebarTitle: 'Resumen',
    description: 'Postulantes, admitidos, porcentaje de admisión y crecimiento por gestión, con el ranking de facultades, áreas y sedes.',
    measures: [M.postulaciones, M.admitidos, M.tasa, M.crecPost, M.noAdmitidos, M.crecAdm, M.puntaje],
    kpiCount: 4,
    breakdowns: [BREAKDOWNS.facultad, BREAKDOWNS.area, BREAKDOWNS.sede],
  },
  {
    ...common,
    slug: 'sexo',
    title: 'Postulantes y admitidos por sexo',
    sidebarTitle: 'Por sexo',
    description: 'Cronología de postulantes y admitidos por sexo y porcentaje de admisión de cada uno.',
    measures: BASE,
    breakdowns: [BREAKDOWNS.sexo],
    composition: { source: A, measure: 'Postulaciones', axis: SEXO, label: 'Sexo' },
  },
  {
    ...common,
    slug: 'area-conocimiento',
    title: 'Postulantes por área de conocimiento',
    sidebarTitle: 'Área de conocimiento',
    description: 'Postulantes y admitidos según las seis áreas de conocimiento de la RAN, con el detalle de sus carreras.',
    measures: BASE,
    breakdowns: [BREAKDOWNS.area],
    composition: { source: A, measure: 'Postulaciones', axis: AREA, label: 'Área de conocimiento' },
  },
  {
    ...common,
    slug: 'facultades',
    title: 'Postulantes por facultad y carrera',
    sidebarTitle: 'Facultad y carrera',
    description: 'Postulantes y admitidos por facultad; elige una facultad para ver sus carreras.',
    measures: [...BASE, M.crecPost],
    breakdowns: [BREAKDOWNS.facultad],
  },
  {
    ...common,
    slug: 'sedes',
    title: 'Postulantes de la central y las sedes',
    sidebarTitle: 'Central y sedes',
    description: 'Postulantes y admitidos de la sede central y de las sedes regionales, con el detalle de sus carreras.',
    measures: BASE,
    breakdowns: [BREAKDOWNS.sede],
    composition: { source: A, measure: 'Postulaciones', axis: SEDE, label: 'Sede' },
  },
  {
    ...common,
    slug: 'procedencia',
    title: 'Procedencia educativa y lugar de nacimiento',
    sidebarTitle: 'Procedencia y nacimiento',
    description: 'Ciudad o provincias de Potosí, otros departamentos y exterior, según el colegio de egreso o el lugar de nacimiento del postulante.',
    measures: BASE,
    breakdowns: [BREAKDOWNS.procedencia, BREAKDOWNS.nacimiento],
    composition: { source: A, measure: 'Postulaciones', axis: PROCEDENCIA, label: 'Procedencia educativa' },
    notes: ['«Ciudad» es la ciudad capital del departamento (por ejemplo, la ciudad de Potosí); el resto del departamento cuenta como provincias.'],
  },
  {
    ...common,
    slug: 'tipo-colegio',
    title: 'Postulantes por tipo de colegio',
    sidebarTitle: 'Tipo de colegio',
    description: 'Postulantes y admitidos de colegios fiscales, particulares y de convenio.',
    measures: BASE,
    breakdowns: [BREAKDOWNS.colegio],
    composition: { source: A, measure: 'Postulaciones', axis: COLEGIO, label: 'Tipo de colegio' },
  },
  {
    ...common,
    slug: 'modalidad',
    title: 'Postulantes por modalidad de ingreso',
    sidebarTitle: 'Modalidad de ingreso',
    description: 'Examen P.S.A., cursos preuniversitarios, ingreso directo y otras modalidades; elige un grupo para ver sus modalidades.',
    measures: [...BASE, M.puntaje],
    breakdowns: [BREAKDOWNS.modalidad],
    composition: { source: A, measure: 'Postulaciones', axis: MODALIDAD, label: 'Modalidad de ingreso' },
  },
];

export function findAdmisionView(slug: string): RendimientoView | undefined {
  return ADMISION_VIEWS.find((view) => view.slug === slug);
}
