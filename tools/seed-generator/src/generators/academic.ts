import { fakerES as faker } from '@faker-js/faker';
import type {
  CourseCatalogItem,
  EntityDocente,
  EntityAsignacionDocente,
} from '../types/index.js';
import { sampleUniform, randomInt } from '../utils/discrete-cdf.js';

function academicLevelCode(level: number): string {
  if (level >= 1 && level <= 9) return String(level);
  if (level >= 10 && level <= 35) return String.fromCharCode(55 + level);
  throw new Error(`Nivel académico fuera del rango codificable: ${level}`);
}

function fitCourseSigla(sigla: string): string {
  if (sigla.length <= 7) return sigla;

  const match = /^([A-Z0-9]{3})-(\d{2})(\d{2})$/i.exec(sigla);
  if (!match) {
    throw new Error(`La sigla '${sigla}' excede char(7) y no sigue el formato académico esperado.`);
  }

  const level = Number(match[2]);
  return `${match[1]}-${academicLevelCode(level)}${match[3]}`;
}

function fallbackCourseSigla(programId: string, level: number, subject: number): string {
  return `${programId}-${academicLevelCode(level)}${String(subject).padStart(2, '0')}`;
}

export interface PreparedCourse extends CourseCatalogItem {
  id_materia: number;
}

export class AcademicGenerator {
  public faculties: any[] = [];
  public programs: any[] = [];
  public coursesLevel1: PreparedCourse[] = [];
  public coursesLevel2Plus: PreparedCourse[] = [];
  public allCourses: PreparedCourse[] = [];
  public teachers: EntityDocente[] = [];
  public teacherAssignments: EntityAsignacionDocente[] = [];

  private siglaToCourseMap = new Map<string, PreparedCourse>();

  constructor(
    private facultiesCatalog: any,
    private curriculaCatalog: any,
    private profile: 'test' | 'medium' | 'full' = 'test'
  ) {
    this.initFaculties();
    this.initPrograms();
    this.initCurricula();
    this.initTeachers();
  }

  private initFaculties(): void {
    this.faculties = this.facultiesCatalog.faculties.map((f: any) => ({
      id_facultad: f.id_facultad_numeric,
      facultad: f.name,
      facu_abre: f.abbreviation || f.name.substring(0, 10),
    }));
  }

  private initPrograms(): void {
    const allProgs = this.facultiesCatalog.programs;
    if (this.profile === 'test') {
      // Perfil test: 8 carreras de benchmark representativas (cubren facultades clave, regímenes semestral y anual)
      const benchmarkIds = ['SIS', 'MED', 'DER', 'CIV', 'ADM', 'COP', 'ENF', 'MIN'];
      this.programs = allProgs.filter((p: any) => benchmarkIds.includes(p.id_programa));
    } else {
      this.programs = allProgs;
    }
  }

  private initCurricula(): void {
    let nextMateriaId = 100;
    const curricula = this.curriculaCatalog.programs_curricula || {};

    // 1. Asignar materias de los programas con pensum definido
    for (const prog of this.programs) {
      const progCurriculum = curricula[prog.id_programa];
      if (progCurriculum && Array.isArray(progCurriculum.courses)) {
        for (const c of progCurriculum.courses) {
          const courseId = nextMateriaId++;
          const prepared: PreparedCourse = {
            id_materia: courseId,
            sigla: fitCourseSigla(c.sigla),
            materia: (c.name || c.materia || c.sigla).toUpperCase(),
            ciclo: c.level || c.ciclo || 1,
            _creditos: c.credits || 4,
            hrs_teoricas: c.hours_theory || 4,
            hrs_practicas: c.hours_practice || 2,
            hrs_laboratorio: 0,
            nota_minima: 51,
            id_materia_padre: null,
            id_programa: prog.id_programa,
            id_plan: 2018,
            materia_graduacion: (c.level >= 9 || c.sigla.includes('TES') || c.sigla.includes('TGR')) ? 'SI' : 'NO',
            prerrequisitos: Array.isArray(c.prerequisites)
              ? c.prerequisites.map((p: any) => (typeof p === 'string' ? p : p.sigla || ''))
              : [],
          };

          this.siglaToCourseMap.set(`${prog.id_programa}:${c.sigla}`, prepared);
          this.allCourses.push(prepared);
        }
      } else {
        // Generar un pensum mínimo procedural (4 materias por nivel para 5 niveles)
        const totalLevels = prog.regime === 'A' ? 5 : 8;
        for (let lvl = 1; lvl <= totalLevels; lvl++) {
          for (let m = 1; m <= 4; m++) {
            const courseId = nextMateriaId++;
            const sigla = fallbackCourseSigla(prog.id_programa, lvl, m);
            const prepared: PreparedCourse = {
              id_materia: courseId,
              sigla,
              materia: `${prog.name} NIVEL ${lvl} ASIGNATURA ${m}`,
              ciclo: lvl,
              _creditos: 4,
              hrs_teoricas: 4,
              hrs_practicas: 2,
              hrs_laboratorio: 0,
              nota_minima: 51,
              id_materia_padre: null,
              id_programa: prog.id_programa,
              id_plan: 2018,
              materia_graduacion: lvl === totalLevels && m === 1 ? 'SI' : 'NO',
              prerrequisitos: lvl > 1 ? [fallbackCourseSigla(prog.id_programa, lvl - 1, m)] : [],
            };
            this.siglaToCourseMap.set(`${prog.id_programa}:${sigla}`, prepared);
            this.allCourses.push(prepared);
          }
        }
      }
    }

    // 2. Resolver claves foráneas de prerrequisitos (id_materia_padre)
    for (const course of this.allCourses) {
      if (course.prerrequisitos && course.prerrequisitos.length > 0) {
        const parentSigla = course.prerrequisitos[0];
        const parentCourse = this.siglaToCourseMap.get(`${course.id_programa}:${parentSigla}`);
        if (parentCourse && parentCourse.id_materia !== course.id_materia) {
          course.id_materia_padre = parentCourse.id_materia;
        }
      }
    }

    // 3. Separar en Paso 1 (Nivel 1 sin padre) y Paso 2 (Nivel 2+ con prerrequisitos)
    for (const course of this.allCourses) {
      if (course.ciclo === 1 || course.id_materia_padre === null) {
        this.coursesLevel1.push(course);
      } else {
        this.coursesLevel2Plus.push(course);
      }
    }
  }

  private initTeachers(): void {
    let docenteId = 1;
    const docentesTiempo = ['TC', 'MT', 'TH'];

    for (const prog of this.programs) {
      // 4 docentes por programa
      for (let i = 1; i <= 4; i++) {
        const id = docenteId++;
        const gender = i % 2 === 0 ? 'M' : 'F';
        const nombres = gender === 'M' ? sampleUniform(['CARLOS', 'ROBERTO', 'MARCO ANTONIO', 'VICTOR']) : sampleUniform(['PATRICIA', 'CARMEN', 'MARIA EUGENIA', 'ELENA']);
        const paterno = sampleUniform(['FLORES', 'RODRIGUEZ', 'QUISPE', 'CONDORI', 'ALVAREZ']);
        const materno = sampleUniform(['MAMANI', 'CHOQUE', 'LOPEZ', 'GOMEZ', 'TORREZ']);
        const ci = randomInt(1800000, 7900000).toString();
        const username = `doc_${prog.id_programa.toLowerCase()}_${i}`;

        this.teachers.push({
          id_docente: id,
          nombres,
          paterno,
          materno,
          clave: 'pbkdf2_sha256$mock$hash',
          estado: 'A',
          ci,
          id_programa: prog.id_programa,
          tiempo: sampleUniform(docentesTiempo),
          usuario: username,
        });
      }
    }
  }

  /**
   * Genera asignaciones docentes para un período académico dado
   */
  public generateAssignmentsForPeriod(gestion: number, periodo: number): EntityAsignacionDocente[] {
    let nextAsignacionId = this.teacherAssignments.length + 1;
    const assignments: EntityAsignacionDocente[] = [];

    for (const prog of this.programs) {
      const progTeachers = this.teachers.filter((t) => t.id_programa === prog.id_programa);
      if (progTeachers.length === 0) continue;

      const progCourses = this.allCourses.filter((c) => c.id_programa === prog.id_programa);

      // Periodos 1/2 son semestrales; el periodo 3 representa la gestión anual.
      if ((prog.regime === 'A' && periodo !== 3) || (prog.regime === 'S' && periodo === 3)) continue;

      for (const course of progCourses) {
        // 1 paralelo por materia en modo seed test
        const teacher = sampleUniform(progTeachers);
        const asig: EntityAsignacionDocente = {
          id_dct_asignaciones: nextAsignacionId++,
          id_docente: teacher.id_docente,
          id_programa: prog.id_programa,
          id_materia: course.id_materia,
          id_grupo: 1,
          id_gestion: gestion,
          id_periodo: periodo,
          tipo_calificacion: 'N',
          se_elegido: 'N',
          cupo_max: 60,
          _estado: 'A',
        };
        assignments.push(asig);
        this.teacherAssignments.push(asig);
      }
    }

    return assignments;
  }

  public getCoursesForProgramAndLevel(idPrograma: string, level: number): PreparedCourse[] {
    return this.allCourses.filter((c) => c.id_programa === idPrograma && c.ciclo === level);
  }
}
