// ============================================================================
// Tipos de Dominio y Catálogos de Referencia (DATA-001 / Issue #206)
// ============================================================================

export interface WeightedItem<T> {
  item: T;
  weight: number;
}

// ----------------------------------------------------------------------------
// Catálogos JSON
// ----------------------------------------------------------------------------

export interface FacultyCatalogItem {
  id_facultad: number;
  facultad: string;
  sigla: string;
}

export interface CareerCatalogItem {
  id_programa: string;
  programa: string;
  id_facultad: number;
  sigla_facultad: string;
  regimen: 'S' | 'A'; // S=Semestral, A=Anual
  nivel: 'LIC' | 'TUS' | 'TUM';
  tiempo_estudio: number; // en años (3, 4, 5)
  sede: string; // '1' Potosi, '2' Villazón, etc.
  nombre_sede: string;
  activo: 'A' | 'I';
  _tipo_academico: 'CAR' | 'PRO';
}

export interface CourseCatalogItem {
  id_materia: number;
  sigla: string;
  materia: string;
  ciclo: number; // Nivel (1 a 10)
  _creditos: number;
  hrs_teoricas: number;
  hrs_practicas: number;
  hrs_laboratorio: number;
  nota_minima: number;
  id_materia_padre: number | null;
  id_programa: string;
  id_plan: number;
  materia_graduacion: 'SI' | 'NO';
  prerrequisitos?: string[];
}

export interface StudyPlanCatalogItem {
  id_programa: string;
  carrera: string;
  id_plan: number;
  regimen: 'S' | 'A';
  total_ciclos: number;
  materias: CourseCatalogItem[];
}

export interface DepartmentCatalogItem {
  cod_dep: number;
  departamento: string;
  sigla: string;
  extension_ci: string;
  peso_admision: number;
}

export interface ProvinceCatalogItem {
  cod_prov: number;
  cod_dep: number;
  provincia: string;
}

export interface LocalityCatalogItem {
  cod_loc: number;
  cod_prov: number;
  cod_dep: number;
  localidad: string;
}

export interface GeographyCatalog {
  pais: { id_pais: number; pais: string; sigla: string };
  departamentos: DepartmentCatalogItem[];
  provincias_potosi: ProvinceCatalogItem[];
  localidades_principales: LocalityCatalogItem[];
  zonas_urbanas_potosi: string[];
  calles_potosi: string[];
}

export interface SchoolCatalogItem {
  id_colegio: number;
  colegio: string;
  tipo: 'F' | 'P' | 'C'; // Fiscal, Particular, Convenio
  turno: 'M' | 'T' | 'N'; // Mañana, Tarde, Noche
  area: 'U' | 'R' | 'P'; // Urbana, Rural, Provincial
  cod_dep: number;
  cod_prov: number;
  cod_loc: number;
  cod_ue?: string; // Código SIE
  dependency?: 'Fiscal' | 'Particular' | 'Convenio';
}

export interface NameItem {
  name: string;
  count?: number;
  weight: number;
  is_composite?: boolean;
}

export interface SurnameItem {
  surname: string;
  origin: 'Quechua' | 'Aymara' | 'Castellano' | 'Regional';
  frequency: number;
  weight: number;
}

export interface DemographicCatalog {
  nombres_masculinos: NameItem[];
  nombres_femeninos: NameItem[];
  apellidos: SurnameItem[];
  distribucion_genero: { M: number; F: number };
  distribucion_origen_estudiante: { potosi_urbano: number; potosi_provincial: number; otros_departamentos: number };
  estados_civiles_probabilidades: Record<string, number>;
}

export interface LookupCodesCatalog {
  estados_civiles: Array<{ id: number; estado_civil: string }>;
  calificacion_colegio: Array<{ id: string; descripcion: string }>;
  examenes_admision: Array<{ id: number; modalidad: string; sigla: string; peso: number; aprobado_porcentaje: number }>;
  estados_alumno: Array<{ estado: string; descripcion: string }>;
  periodos: Array<{ id_periodo: number; periodo: string }>;
  sedes: Array<{ id_sede: string; sede: string }>;
  docentes_tiempo: Array<{ tiempo: string; descripcion: string }>;
}

// ----------------------------------------------------------------------------
// Opciones del Generador CLI
// ----------------------------------------------------------------------------

export interface GeneratorOptions {
  seed: number;
  profile: 'test' | 'medium' | 'full';
  cohortSize: number; // Postulantes por gestión anual
  startYear: number;
  endYear: number;
  dryRun: boolean;
  clean: boolean;
  outputSql?: string;
  dbConfig?: {
    host: string;
    port: number;
    user: string;
    password?: string;
    database: string;
    ssl?: boolean;
  };
}

// ----------------------------------------------------------------------------
// Entidades Simuladas del Esquema OLTP
// ----------------------------------------------------------------------------

export interface EntityUatfDatos {
  id_ra: string;
  nro_dip: string;
  paterno: string;
  materno: string;
  nombres: string;
  id_sexo: 'M' | 'F';
  fec_nacimiento: string; // YYYY-MM-DD
  nac_pais: number;
  id_dep: number;
  id_prov_original: number;
  id_loc: number;
  direccion: string;
  telefono: string;
  id_colegio: number;
  egr_gestion: number;
  fec_registro: string;
  id_calificacion: string;
  tel_per: string;
  tel_urg: string;
  tel_whatsapp: string;
  zona: string;
  estado_civil: number;
  tdni: string;
  email: string;
  nacionalidad: string;
  tipo_nro_dip: string;
}

export interface EntityPostulante {
  id_alumno: number;
  id_programa: string;
  id_ra: string;
  fec_inscripcion: string;
  id_plan: number;
  id_grado: string;
  estado: 'A' | 'P'; // A=Admitido, P=Reprobado
  id_calificacion: string;
  promedio: number;
  nro_dip: string;
  examen: number;
  id_acceso: string;
  id_periodo: number;
  id_gestion: number;
  nota: number;
  _estado: string;
  _id_usuario: string;
}

export interface EntityAlumno {
  id_alumno: number;
  id_programa: string;
  id_ra: string;
  fec_inscripcion: string;
  fec_egreso: string | null;
  id_plan: number;
  id_grado: string;
  estado: 'P' | 'A' | 'T' | 'X'; // P=Regular, A=Egresado, T=Titulado, X=Desertor/Abandono
  tipo_alumno: string;
  id_tipo_aprobacion: number;
  carrera: number;
  ssu: string;
  _fecha_registro: string;
}

export interface EntityDocente {
  id_docente: number;
  nombres: string;
  paterno: string;
  materno: string;
  clave: string;
  estado: string;
  ci: string;
  id_programa: string;
  tiempo: string;
  usuario: string;
}

export interface EntityAsignacionDocente {
  id_dct_asignaciones: number;
  id_docente: number;
  id_programa: string;
  id_materia: number;
  id_grupo: number;
  id_gestion: number;
  id_periodo: number;
  tipo_calificacion: string;
  se_elegido: string;
  cupo_max: number;
  _estado: string;
}

export interface EntityProgramacion {
  id: number;
  id_alumno: number;
  id_materia: number;
  id_gestion: number;
  id_periodo: number;
  id_grupo: number;
  fecha: string;
  ult_usuario: string;
  estado: string;
  pparcial: number;
  sparcial: number;
  tparcial: number;
  cparcial: number;
  nota: number;
  nota_2da: number;
  nota_ex_mesa: number;
  _estado: string;
  tipo_programacion: string;
}

export interface EntityNotaPlanilla {
  id_matricula: number;
  id_gestion: number;
  id_periodo: number;
  id_alumno: number;
  id_materia: number;
  grupo: number;
  nota: number;
  ult_usuario: string;
  estado: 'A' | 'R' | 'X'; // A=Aprobado, R=Reprobado, X=Abandono
  observacion: string;
  nota_2da: number;
  nota_ex_mesa: number;
  pparcial: number;
  sparcial: number;
  tparcial: number;
  cparcial: number;
  promparcial: number;
  pract: number;
  prompract: number;
  lab: number;
  promlab: number;
  notapres: number;
  exfinal: number;
  promexfinal: number;
  tipo: string;
  _fecha_creacion: string;
  _unique: number;
  __estado: string;
  __obsv: string;
}

export interface EntityGraduado {
  id: number;
  id_alumno: number;
  id_programa: string;
  id_gestion: number;
  id_periodo: number;
  fecha_graduacion: string;
  modalidad_graduacion: string;
  nota_defensa: number;
  nro_acta: string;
  _registrado: string;
}
