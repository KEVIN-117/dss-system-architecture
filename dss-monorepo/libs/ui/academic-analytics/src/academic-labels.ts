/**
 * Display helpers for the published UATF cubes.
 *
 * Since DW 0047 the Mondrian schema itself is in Spanish, so current cube,
 * dimension and measure identifiers are shown as they are. The English map
 * only keeps old saved queries and links readable.
 */
const legacyLabels: Record<string, string> = {
  'Academic Admission': 'Admisión',
  'Academic Performance': 'Rendimiento académico',
  'Academic Retention': 'Permanencia y deserción',
  'Academic Program': 'Programa',
  Program: 'Facultad y carrera',
  Faculty: 'Facultad',
  Career: 'Carrera',
  'Academic Campus': 'Sede',
  'Campus Code': 'Sede',
  'Academic Period': 'Periodo',
  'Academic Year': 'Gestión',
  'Period Number': 'Periodo',
  'Applicant Profile': 'Perfil del estudiante',
  Gender: 'Sexo',
  'School Type': 'Tipo de colegio',
  'Admission Mode': 'Modalidad de admisión',
  'Academic Subject': 'Materia',
  'Enrollment Attempts': 'Inscripciones en materias',
  'Average Final Grade': 'Nota promedio',
  'Graded Attempts': 'Inscripciones con resultado',
  'Passed Attempts': 'Materias aprobadas',
  'Failed Attempts': 'Materias reprobadas',
  'Repeated Attempts': 'Inscripciones repetidas',
  'Abandoned Attempts': 'Inscripciones abandonadas',
  Applicants: 'Postulaciones',
  'Admitted Applicants': 'Admitidos',
  'Student Snapshots': 'Estudiantes en el periodo',
  'Evaluable Retention Outcomes': 'Estudiantes evaluados',
  'Retained Students': 'Permanecen',
  'Observed Dropouts': 'Desertan',
  '(All)': '(Todos)',
};

/** What each published measure means, for tooltips and help text. */
const measureDescriptions: Record<string, string> = {
  Postulaciones: 'Cantidad de postulaciones registradas (cada registro de postulante a una carrera).',
  Admitidos: 'Postulaciones con resultado aprobado (admitidas a la carrera).',
  'No admitidos': 'Postulaciones con resultado reprobado.',
  'Postulaciones con resultado': 'Postulaciones con resultado conocido (admitido o no admitido); base de la tasa de admisión.',
  'Puntaje promedio de admisión': 'Promedio de la nota de admisión de las postulaciones que la tienen.',
  'Tasa de admisión': 'Admitidos sobre postulaciones con resultado conocido.',
  'Crecimiento de postulaciones': 'Variación de postulaciones respecto de la gestión anterior.',
  'Crecimiento de admitidos': 'Variación de admitidos respecto de la gestión anterior.',
  'Estudiantes matriculados': 'Estudiantes con al menos una materia cursada en la carrera y el periodo.',
  'Estudiantes nuevos': 'Estudiantes que cursan por primera vez en la carrera en ese periodo.',
  'Estudiantes antiguos': 'Estudiantes que ya habían cursado la carrera en un periodo anterior.',
  'Sin historial previo': 'Estudiantes del primer periodo cargado en el DW (2015-1); no se sabe si son nuevos.',
  'Materias inscritas promedio': 'Promedio de materias inscritas por estudiante en el periodo.',
  'Porcentaje de nuevos': 'Nuevos sobre nuevos más antiguos (excluye estudiantes sin historial previo).',
  'Inscripciones en materias': 'Veces que estudiantes se inscribieron en materias (un estudiante con 5 materias suma 5).',
  'Inscripciones con resultado': 'Inscripciones con nota que permite saber si se aprobó o reprobó.',
  'Materias aprobadas': 'Inscripciones con nota efectiva de 51 o más (mejor nota entre ordinaria, segundo turno y mesa).',
  'Materias reprobadas': 'Inscripciones con nota efectiva entre 1 y 50.',
  'Inscripciones repetidas': 'Inscripciones en una materia que el estudiante ya había cursado antes.',
  'Inscripciones abandonadas': 'Inscripciones registradas en la fuente como abandono.',
  'Nota promedio': 'Promedio de la nota efectiva de las inscripciones con resultado (sin notas en 0 ni vacías).',
  Estudiantes: 'Estudiantes distintos con al menos una inscripción.',
  'Tasa de aprobación': 'Materias aprobadas sobre inscripciones con resultado.',
  'Tasa de reprobación': 'Materias reprobadas sobre inscripciones con resultado.',
  'Tasa de repitencia': 'Inscripciones en materias ya cursadas sobre el total de inscripciones.',
  'Tasa de abandono de materias': 'Inscripciones abandonadas sobre inscripciones con estado conocido.',
  'Materias por estudiante': 'Inscripciones en materias por estudiante distinto.',
  'Estudiantes en el periodo': 'Estudiantes con cursado en la carrera y el periodo.',
  'Estudiantes evaluados': 'Estudiantes cuyo resultado se conoce porque el periodo siguiente de su régimen está procesado.',
  Permanecen: 'Estudiantes que cursan la misma carrera en el periodo siguiente (semestral: siguiente semestre; anual: siguiente gestión).',
  Desertan: 'Estudiantes que no cursan en el periodo siguiente y rindieron menos de 2 parciales.',
  'Sin evaluación': 'Estudiantes sin resultado: el periodo siguiente aún no se procesó o falta evidencia.',
  'Promedio acumulado': 'Promedio de la nota efectiva de todas las materias con resultado en la carrera hasta el periodo.',
  'Materias arrastradas promedio': 'Materias reprobadas y aún no aprobadas por estudiante al cierre del periodo.',
  'Materias cursadas promedio': 'Materias inscritas por estudiante en el periodo.',
  'Materias aprobadas promedio': 'Materias aprobadas por estudiante en el periodo.',
  'Materias reprobadas promedio': 'Materias reprobadas por estudiante en el periodo.',
  'Tasa de deserción': 'Desertan sobre estudiantes evaluados.',
  'Tasa de permanencia': 'Permanecen sobre estudiantes evaluados.',
};

const chartLabels: Record<string, string> = {
  Bars: 'Barras',
  Lines: 'Líneas',
  Proportional: 'Proporciones',
  Matrix: 'Matriz',
  Points: 'Dispersión',
  Geo: 'Geografía',
  Bar: 'Barras',
  'Stacked bar': 'Barras apiladas',
  Waterfall: 'Cascada',
  Line: 'Línea',
  'Stacked line': 'Líneas apiladas',
  Area: 'Área',
  'Stacked area': 'Áreas apiladas',
  Pie: 'Circular',
  Donut: 'Dona',
  Treemap: 'Mapa de árbol',
  Sunburst: 'Anillos jerárquicos',
  Heatmap: 'Mapa de calor',
  Radar: 'Radar',
  Scatter: 'Dispersión',
  Bubble: 'Burbujas',
  'Map (choropleth — by country)': 'Mapa por país',
};

export function chartLabel(value: string): string {
  return chartLabels[value] ?? value;
}

export function isUatfCube(
  cube: { catalog: string; schema: string } | null | undefined,
): boolean {
  return cube?.catalog === 'UATF_DW' && cube.schema === 'UATF_DW';
}

export function academicLabel(value: string): string {
  if (legacyLabels[value]) return legacyLabels[value];
  const parts = value.split(' - ');
  if (parts.length > 1 && parts.every((part) => legacyLabels[part])) {
    return parts.map((part) => legacyLabels[part]).join(' · ');
  }
  return value;
}

/** Plain-language meaning of a published measure, or null when unknown. */
export function measureDescription(value: string): string | null {
  return measureDescriptions[value] ?? null;
}
