/** Display labels for the published UATF cubes. Identifiers remain unchanged. */
const labels: Record<string, string> = {
  'Academic Admission': 'Admisión académica',
  'Academic Performance': 'Rendimiento académico',
  'Academic Retention': 'Permanencia académica',
  'Academic Program': 'Programa académico',
  Program: 'Programa',
  Faculty: 'Facultad',
  Career: 'Carrera',
  'Academic Faculty Scope': 'Ámbito de facultad',
  'Faculty Scope': 'Ámbito de facultad',
  'Academic Career Scope': 'Ámbito de carrera',
  'Career Scope': 'Ámbito de carrera',
  'Academic Campus': 'Sede académica',
  'Campus Code': 'Código de sede',
  'Academic Period': 'Periodo académico',
  'Academic Year': 'Gestión académica',
  'Period Number': 'Número de periodo',
  'Applicant Profile': 'Perfil del postulante',
  'By Gender': 'Por género',
  Gender: 'Género',
  'By School Type': 'Por tipo de colegio',
  'School Type': 'Tipo de colegio',
  'By School': 'Por colegio',
  School: 'Colegio',
  'By Educational Location': 'Por ubicación educativa',
  'Educational Location': 'Ubicación educativa',
  'Admission Mode': 'Modalidad de admisión',
  'Admission Code': 'Código de admisión',
  'Academic Subject': 'Materia académica',
  'Course Cycle': 'Ciclo académico',
  Subject: 'Materia',
  'By Course Code': 'Por código de materia',
  'Course Code': 'Código de materia',
  'Enrollment Attempts': 'Intentos de cursado',
  'Attempt Count': 'Cantidad de intentos',
  'Average Final Grade': 'Nota final promedio',
  'Graded Attempts': 'Intentos calificados',
  'Passed Attempts': 'Intentos aprobados',
  'Failed Attempts': 'Intentos reprobados',
  'Repeated Attempts': 'Intentos repetidos',
  'Abandoned Attempts': 'Intentos abandonados',
  Applicants: 'Postulantes',
  'Admitted Applicants': 'Postulantes admitidos',
  'Known Admission Outcomes': 'Resultados de admisión conocidos',
  Applications: 'Postulaciones',
  'Average Admission Score': 'Puntaje promedio de admisión',
  'Student Snapshots': 'Registros de estudiantes',
  'Evaluable Retention Outcomes': 'Casos evaluables de permanencia',
  'Retained Students': 'Estudiantes que permanecen',
  'Observed Dropouts': 'Deserciones observadas',
  'Average Courses Taken': 'Materias cursadas promedio',
  'Average Courses Passed': 'Materias aprobadas promedio',
  'Average Courses Failed': 'Materias reprobadas promedio',
  'Average Failed Course Backlog': 'Materias arrastradas promedio',
  'Average Cumulative Score': 'Promedio acumulado',
  '(All)': '(Todos)',
  'All By School Types': 'Todos los tipos de colegio',
  'All By Genders': 'Todos los géneros',
  'All By Schools': 'Todos los colegios',
  'All By Educational Locations': 'Todas las ubicaciones educativas',
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
  if (labels[value]) return labels[value];
  const parts = value.split(' - ');
  if (parts.length > 1 && parts.every((part) => labels[part])) {
    return parts.map((part) => labels[part]).join(' · ');
  }
  return value;
}
