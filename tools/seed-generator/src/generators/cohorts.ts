import type {
  EntityUatfDatos,
  EntityPostulante,
  EntityAlumno,
  EntityMatricula,
  EntityCajaTransaccion,
  EntityValorTransaccion,
  EntityProgramacion,
  EntityNotaPlanilla,
  EntityGraduado,
  WeightedItem,
} from '../types/index.js';
import { DemographicGenerator } from './demographics.js';
import { SchoolGenerator } from './schools.js';
import { AcademicGenerator, type PreparedCourse } from './academic.js';
import { sampleWeighted, sampleUniform, randomInt, randomFloat, chance } from '../utils/discrete-cdf.js';
import { InstitutionalScenario, type YearFactors } from '../scenarios/institutional-trend.js';

export interface YearSummary {
  gestion: number;
  phase: YearFactors['phase'];
  demand_factor: number;
  postulantes: number;
  admitidos: number;
  matriculados: number;
  cursados: number;
  aprobados: number;
  reprobados: number;
  abandonos: number;
  desertores: number;
  titulados: number;
}

export interface SimulationResult {
  uatfDatos: EntityUatfDatos[];
  postulantes: EntityPostulante[];
  alumnos: EntityAlumno[];
  matriculas: EntityMatricula[];
  cajasTransacciones: EntityCajaTransaccion[];
  valoresTransacciones: EntityValorTransaccion[];
  programaciones: EntityProgramacion[];
  notasPlanilla: EntityNotaPlanilla[];
  graduados: EntityGraduado[];
  yearly: YearSummary[];
}

interface StudentTracking {
  alumno: EntityAlumno;
  datos: EntityUatfDatos;
  idPrograma: string;
  currentLevel: number;
  approvedCourses: Set<number>;
  isDroppedOut: boolean;
  regime: 'S' | 'A';
  maxLevel: number;
  /** Habilidad académica latente ~N(0,1): enlaza ingreso, notas y deserción. */
  ability: number;
  /** Proporción de materias reprobadas en el último periodo cursado. */
  lastFailRatio: number;
  /** Materias reprobadas o bloqueadas por prerrequisito, a recursar. */
  pending: Set<number>;
}

interface Modality {
  idMod: number;
  idExamen: number;
  sigla: string;
  admissionRate: number;
  scoreMean: number;
  scoreSd: number;
  scoreMin: number;
  scoreMax: number;
  quantitative: boolean;
}

/** id_mod del catálogo → prs_examen.id_examen observado en Jachasun. */
const MODALITY_TO_PRS_EXAMEN: Record<number, number> = {
  1: 1, 2: 2, 3: 5, 4: 6, 5: 7, 6: 8, 7: 9, 8: 10, 9: 15, 10: 29, 11: 32, 12: 36, 13: 42, 14: 43, 15: 0,
};

/**
 * Popularidad relativa de carreras (peso de postulación). Las carreras más
 * demandadas replican el orden agregado observado en la OLTP de referencia
 * (CIV, MED, COP, DER, CTB, ADM, ENF, ARQ...). El resto pesa 1.
 */
const PROGRAM_POPULARITY: Record<string, number> = {
  CIV: 9, MED: 9, COP: 8.5, DER: 8, CTB: 7, ADM: 6.8, ENF: 6.3, ARQ: 6, EDI: 5,
  SIS: 4, TCS: 3.6, ODO: 3.4, MIN: 3.2, INF: 3, ECO: 2.8, AGR: 2.4, IND: 2.4,
  ELE: 2.2, QMC: 2, TUR: 2, COM: 2,
};

/** Proporción femenina por carrera; 0.5 si no figura. */
const PROGRAM_FEMALE_SHARE: Record<string, number> = {
  ENF: 0.84, EDI: 0.66, TCS: 0.8, ODO: 0.6, MED: 0.58, COP: 0.62, CTB: 0.6, ADM: 0.55,
  DER: 0.52, TUR: 0.62, CIV: 0.24, MIN: 0.14, ELE: 0.1, IMA: 0.12, IMI: 0.12, IMC: 0.12,
  SIS: 0.3, INF: 0.32, ARQ: 0.45, AGR: 0.35, IGO: 0.25,
};

/** Fracción de la convocatoria de primer semestre que se abre a mitad de año. */
const SECOND_INTAKE_SHARE = 0.3;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

/** Normal estándar (Box-Muller) usando el RNG determinista de Faker. */
function gaussian(): number {
  const u1 = Math.max(randomFloat(0, 1, 9), 1e-9);
  const u2 = randomFloat(0, 1, 9);
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

/** Inversa de la CDF normal estándar (aproximación racional de Acklam). */
function inverseNormalCdf(p: number): number {
  const q = clamp(p, 1e-6, 1 - 1e-6);
  const a = [-39.6968302866538, 220.946098424521, -275.928510446969, 138.357751867269, -30.6647980661472, 2.50662827745924];
  const b = [-54.4760987982241, 161.585836858041, -155.698979859887, 66.8013118877197, -13.2806815528857];
  const c = [-0.00778489400243029, -0.322396458041136, -2.40075827716184, -2.54973253934373, 4.37466414146497, 2.93816398269878];
  const d = [0.00778469570904146, 0.32246712907004, 2.445134137143, 3.75440866190742];
  const pLow = 0.02425;
  if (q < pLow) {
    const r = Math.sqrt(-2 * Math.log(q));
    return (((((c[0] * r + c[1]) * r + c[2]) * r + c[3]) * r + c[4]) * r + c[5]) / ((((d[0] * r + d[1]) * r + d[2]) * r + d[3]) * r + 1);
  }
  if (q > 1 - pLow) {
    const r = Math.sqrt(-2 * Math.log(1 - q));
    return -(((((c[0] * r + c[1]) * r + c[2]) * r + c[3]) * r + c[4]) * r + c[5]) / ((((d[0] * r + d[1]) * r + d[2]) * r + d[3]) * r + 1);
  }
  const r = q - 0.5;
  const s = r * r;
  return ((((((a[0] * s + a[1]) * s + a[2]) * s + a[3]) * s + a[4]) * s + a[5]) * r) / (((((b[0] * s + b[1]) * s + b[2]) * s + b[3]) * s + b[4]) * s + 1);
}

/** Edad al postular: concentrada en 18-19 años con cola hasta 24. */
const AGE_WEIGHTS: WeightedItem<number>[] = [
  { item: 17, weight: 8 }, { item: 18, weight: 31 }, { item: 19, weight: 24 }, { item: 20, weight: 13 },
  { item: 21, weight: 9 }, { item: 22, weight: 6 }, { item: 23, weight: 5 }, { item: 24, weight: 4 },
];

export class LongitudinalCohortSimulator {
  private uatfDatosList: EntityUatfDatos[] = [];
  private postulantesList: EntityPostulante[] = [];
  private alumnosList: EntityAlumno[] = [];
  private matriculasList: EntityMatricula[] = [];
  private cajasTransaccionesList: EntityCajaTransaccion[] = [];
  private valoresTransaccionesList: EntityValorTransaccion[] = [];
  private programacionesList: EntityProgramacion[] = [];
  private notasPlanillaList: EntityNotaPlanilla[] = [];
  private graduadosList: EntityGraduado[] = [];
  private yearly = new Map<number, YearSummary>();

  private activeStudents: StudentTracking[] = [];
  private nextRaIndex = 1;
  private nextAlumnoId = 1;
  private nextPostulanteId = 1;
  private nextProgramacionId = 1;
  private nextMatriculaId = 1;
  private nextEnrollmentId = 1;
  private nextPurchaseTransactionId = 1;
  private nextValueTransactionId = 1;
  private nextGraduadoId = 1;

  private modalityWeights: WeightedItem<Modality>[] = [];
  private programOpening = new Map<string, number>();
  private courseById = new Map<number, PreparedCourse>();
  private maxLevelByProgram = new Map<string, number>();
  private readonly coveredPurchasePeriods = new Set<string>();
  private readonly studentsWithPreviousPurchase = new Set<number>();
  private factors!: YearFactors;

  constructor(
    private demographicGen: DemographicGenerator,
    private schoolGen: SchoolGenerator,
    private academicGen: AcademicGenerator,
    private lookupsCatalog: any,
    private scenario: InstitutionalScenario = new InstitutionalScenario('stable')
  ) {
    this.initModalities();
    for (const course of this.academicGen.allCourses) {
      this.courseById.set(course.id_materia, course);
      const current = this.maxLevelByProgram.get(course.id_programa) ?? 0;
      this.maxLevelByProgram.set(course.id_programa, Math.max(current, course.ciclo));
    }
    this.academicGen.programs.forEach((program: any, index: number) => {
      this.programOpening.set(program.id_programa, this.scenario.programOpeningYear(program, index));
    });
  }

  private initModalities(): void {
    const modalities = this.lookupsCatalog?.admission_modalities || [];
    this.modalityWeights = modalities
      .filter((m: any) => m.id_mod !== undefined)
      .map((m: any) => ({
        item: {
          idMod: m.id_mod,
          idExamen: MODALITY_TO_PRS_EXAMEN[m.id_mod] ?? 0,
          sigla: String(m.id_acceso || m.codigo_oficial || 'PA').substring(0, 3),
          admissionRate: (m.tasa_admision_pct ?? 60) / 100,
          scoreMean: m.puntaje_media ?? 55,
          scoreSd: m.puntaje_desv_estandar ?? 12,
          scoreMin: m.puntaje_min ?? 10,
          scoreMax: m.puntaje_max ?? 98,
          quantitative: m.requiere_examen_cuantitativo !== false,
        },
        weight: m.cuota_poblacional_pct ?? 1,
      }));

    if (this.modalityWeights.length === 0) {
      const fallback = (idMod: number, idExamen: number, sigla: string, rate: number, mean: number, weight: number) => ({
        item: { idMod, idExamen, sigla, admissionRate: rate, scoreMean: mean, scoreSd: 12, scoreMin: 10, scoreMax: 98, quantitative: true },
        weight,
      });
      this.modalityWeights = [
        fallback(1, 1, 'PA', 0.52, 53.5, 60),
        fallback(2, 2, 'CN', 0.68, 59, 30),
        fallback(4, 6, 'EX', 1, 88, 5),
        fallback(3, 5, 'ID', 1, 80, 5),
      ];
    }
  }

  private summary(gestion: number): YearSummary {
    let s = this.yearly.get(gestion);
    if (!s) {
      const f = this.scenario.factorsFor(gestion);
      s = {
        gestion, phase: f.phase, demand_factor: f.demand,
        postulantes: 0, admitidos: 0, matriculados: 0, cursados: 0, aprobados: 0,
        reprobados: 0, abandonos: 0, desertores: 0, titulados: 0,
      };
      this.yearly.set(gestion, s);
    }
    return s;
  }

  /**
   * Ejecuta la simulación longitudinal completa entre startYear y endYear.
   *
   * Convención Jachasun (migración DW 0045): los programas anuales registran
   * toda la gestión en el periodo 1; los semestrales usan periodos 1 y 2.
   * `cohortSize` es la convocatoria base de primer periodo (todas las
   * carreras) en la línea base; el escenario la escala por gestión.
   */
  public simulate(cohortSize: number, startYear = 2000, endYear = 2026): SimulationResult {
    for (let gestion = startYear; gestion <= endYear; gestion++) {
      this.factors = this.scenario.factorsFor(gestion);
      const noise = this.scenario.name === 'stable' ? 1 : randomFloat(0.97, 1.03, 3);
      const firstCall = Math.max(1, Math.round(cohortSize * this.factors.demand * noise));
      const secondCall = Math.max(1, Math.round(firstCall * SECOND_INTAKE_SHARE));

      this.simulateAdmissionCohort(gestion, 1, firstCall);
      this.simulateAcademicPeriod(gestion, 1);
      this.simulateAdmissionCohort(gestion, 2, secondCall);
      this.simulateAcademicPeriod(gestion, 2);
      this.simulateGraduations(gestion);
    }

    return {
      uatfDatos: this.uatfDatosList,
      postulantes: this.postulantesList,
      alumnos: this.alumnosList,
      matriculas: this.matriculasList,
      cajasTransacciones: this.cajasTransaccionesList,
      valoresTransacciones: this.valoresTransaccionesList,
      programaciones: this.programacionesList,
      notasPlanilla: this.notasPlanillaList,
      graduados: this.graduadosList,
      yearly: [...this.yearly.values()].sort((a, b) => a.gestion - b.gestion),
    };
  }

  private simulateAdmissionCohort(gestion: number, periodo: 1 | 2, cohortSize: number): void {
    const eligiblePrograms = this.academicGen.programs.filter(
      (program: any) =>
        (periodo === 1 || program.regime === 'S') &&
        (this.programOpening.get(program.id_programa) ?? 0) <= gestion
    );
    if (eligiblePrograms.length === 0) return;
    const programWeights: WeightedItem<any>[] = eligiblePrograms.map((program: any) => ({
      item: program,
      weight: PROGRAM_POPULARITY[program.id_programa] ?? 1,
    }));
    const summary = this.summary(gestion);
    const month = periodo === 2 ? '07' : '01';

    for (let i = 0; i < cohortSize; i++) {
      const targetProgram = sampleWeighted(programWeights);
      const gender: 'M' | 'F' = chance(PROGRAM_FEMALE_SHARE[targetProgram.id_programa] ?? 0.5) ? 'F' : 'M';
      const age = sampleWeighted(AGE_WEIGHTS);
      const person = this.demographicGen.generatePerson(gender, gestion, age);
      const school = this.schoolGen.sampleSchool();
      const idRa = this.demographicGen.generateIdRa(this.nextRaIndex++);

      // Egreso del colegio: bachilleres recientes a los 17-18; mayores egresaron antes.
      const egrGestion = gestion - Math.max(1, age - 17);
      const uatfDato = this.demographicGen.toUatfDatosEntity(idRa, person, school.id_colegio, egrGestion);
      uatfDato.id_calificacion = school.tipo === 'P' ? '2' : '1';
      this.uatfDatosList.push(uatfDato);

      const modality = sampleWeighted(this.modalityWeights);
      // Habilidad latente: colegios particulares parten levemente más arriba.
      const ability = gaussian() + (school.tipo === 'P' ? 0.2 : 0);

      // Puntaje de ingreso correlacionado con la habilidad. El corte se fija
      // para que la modalidad admita su tasa de catálogo ajustada por el
      // escenario (en el declive la institución es menos selectiva).
      const rate = clamp(modality.admissionRate * this.factors.admissionRate, 0.05, 0.98);
      const z = 0.8 * ability + 0.6 * gaussian();
      const examGrade = Math.round(clamp(modality.scoreMean + modality.scoreSd * z, modality.scoreMin, modality.scoreMax));
      const isApproved = modality.admissionRate >= 1 || !modality.quantitative
        ? chance(Math.min(1, modality.admissionRate))
        : z >= inverseNormalCdf(1 - rate);

      const postulanteId = this.nextPostulanteId++;
      this.postulantesList.push({
        id_alumno: postulanteId,
        id_programa: targetProgram.id_programa,
        id_ra: idRa,
        fec_inscripcion: `${gestion}-${month}-${randomInt(10, 25).toString().padStart(2, '0')}`,
        id_plan: 2018,
        id_grado: 'A',
        estado: isApproved ? 'A' : 'P',
        id_calificacion: school.tipo === 'P' ? '2' : '1',
        promedio: examGrade,
        nro_dip: person.nro_dip,
        examen: modality.idExamen,
        id_acceso: modality.sigla,
        id_periodo: periodo,
        id_gestion: gestion,
        nota: examGrade,
        _estado: 'A',
        _id_usuario: 'adm_seeder',
      });
      summary.postulantes++;

      if (!isApproved) continue;
      summary.admitidos++;

      const alumnoId = this.nextAlumnoId++;
      const enrollDate = `${gestion}-${periodo === 2 ? '08' : '02'}-05`;
      const alumno: EntityAlumno = {
        id_alumno: alumnoId,
        id_programa: targetProgram.id_programa,
        id_ra: idRa,
        fec_inscripcion: enrollDate,
        fec_egreso: null,
        id_plan: 2018,
        id_grado: 'A',
        estado: 'P',
        tipo_alumno: 'B',
        id_tipo_aprobacion: modality.idExamen,
        carrera: 1,
        ssu: 'S',
        _fecha_registro: `${enrollDate} 10:00:00`,
      };
      this.alumnosList.push(alumno);

      this.activeStudents.push({
        alumno,
        datos: uatfDato,
        idPrograma: targetProgram.id_programa,
        currentLevel: 1,
        approvedCourses: new Set<number>(),
        isDroppedOut: false,
        regime: targetProgram.regime,
        maxLevel: this.maxLevelByProgram.get(targetProgram.id_programa) ?? (targetProgram.regime === 'A' ? 5 : 10),
        ability,
        lastFailRatio: 0,
        pending: new Set<number>(),
      });
    }
  }

  private simulateAcademicPeriod(gestion: number, periodo: 1 | 2): void {
    this.academicGen.generateAssignmentsForPeriod(gestion, periodo);
    const summary = this.summary(gestion);
    const f = this.factors;
    // Cierre del acta: 1er semestre en julio; 2do semestre y gestión anual en diciembre.
    const closeDate = (regime: 'S' | 'A') =>
      regime === 'S' && periodo === 1 ? `${gestion}-07-05 18:00:00` : `${gestion}-12-15 18:00:00`;

    for (const st of this.activeStudents) {
      if (st.isDroppedOut || st.alumno.estado === 'T') continue;
      // Programas anuales: solo periodo 1 (gestión completa).
      if (st.regime === 'A' && periodo !== 1) continue;

      // Deserción silenciosa (stop-out): no renueva matrícula ni se programa.
      // Depende de la habilidad, del fracaso reciente y del momento institucional.
      const baseSilent = st.currentLevel <= 2 ? 0.05 : 0.018;
      const silentRisk = clamp(
        baseSilent * f.dropoutMultiplier * Math.exp(-0.45 * st.ability) * (1 + 2 * st.lastFailRatio),
        0, 0.6
      );
      if (st.currentLevel > 1 && chance(silentRisk)) {
        st.isDroppedOut = true;
        st.alumno.estado = 'X';
        summary.desertores++;
        continue;
      }

      // Materias del nivel actual + hasta 3 pendientes (reprobadas o bloqueadas
      // por prerrequisito) cuyo prerrequisito ya está aprobado: recursado.
      const levelCourses = st.currentLevel <= st.maxLevel
        ? this.academicGen.getCoursesForProgramAndLevel(st.idPrograma, st.currentLevel)
        : [];
      const prereqOk = (course: any) => !course.id_materia_padre || st.approvedCourses.has(course.id_materia_padre);
      const retakes = [...st.pending]
        .sort((a, b) => a - b)
        .map((id) => this.courseById.get(id)!)
        .filter((course) => course && prereqOk(course))
        .slice(0, 3);
      const availableCourses: any[] = [...retakes];
      for (const course of levelCourses) {
        if (prereqOk(course)) availableCourses.push(course);
        else st.pending.add(course.id_materia);
      }
      if (availableCourses.length === 0) {
        if (st.currentLevel <= st.maxLevel) st.currentLevel++;
        continue;
      }

      this.registerMatriculaPurchase(st, gestion, periodo);
      summary.matriculados++;

      // Abandono formal durante el periodo (regla DSA: < 2 parciales).
      const baseFormal = st.currentLevel <= 2 ? 0.07 : 0.015;
      const formalRisk = clamp(
        baseFormal * f.dropoutMultiplier * Math.exp(-0.5 * st.ability) * (1 + 1.5 * st.lastFailRatio),
        0, 0.6
      );
      const willDropOut = chance(formalRisk);
      // Probabilidad de buen desempeño por materia: habilidad + contexto.
      // Calibrado contra la OLTP de referencia: ~65 % de aprobación en línea base.
      const pGood = sigmoid(0.15 + 1.1 * st.ability + f.performanceShift * 1.6);

      let taken = 0;
      let failed = 0;
      for (const course of availableCourses) {
        const progId = this.nextProgramacionId++;
        const matriculaId = this.nextMatriculaId++;
        const programmedAt = `${gestion}-${periodo === 2 ? '08' : '02'}-${randomInt(8, 20).toString().padStart(2, '0')} 09:00:00`;
        taken++;
        summary.cursados++;

        if (willDropOut) {
          const hasFirstPartial = chance(0.4);
          const pparcial = hasFirstPartial ? randomInt(10, 45) : 0;
          this.pushCoursework(st, course.id_materia, gestion, periodo, progId, matriculaId, programmedAt, closeDate(st.regime), {
            p1: pparcial, p2: 0, p3: 0, p4: 0, finalGrade: pparcial, nota2da: 0, estado: 'X',
            observacion: 'REGLA_DSA:abandono_menos_de_dos_parciales',
          });
          summary.abandonos++;
          continue;
        }

        const good = chance(pGood);
        const shift = Math.round(f.performanceShift * 6);
        const roll = (lo: number, hi: number) => clamp(randomInt(lo, hi) + shift, 1, 100);
        const p1 = good ? roll(50, 95) : roll(22, 56);
        const p2 = good ? roll(50, 95) : roll(22, 56);
        const p3 = good ? roll(45, 92) : roll(18, 52);
        const p4 = good ? roll(45, 95) : roll(18, 52);

        let finalGrade = Math.round(p1 * 0.3 + p2 * 0.3 + p3 * 0.2 + p4 * 0.2);
        let nota2da = 0;
        let estado: 'A' | 'R' = finalGrade >= 51 ? 'A' : 'R';
        if (estado === 'R' && finalGrade >= 40) {
          if (chance(clamp(0.5 + 0.1 * st.ability, 0.2, 0.8))) {
            nota2da = 51;
            finalGrade = 51;
            estado = 'A';
          } else {
            nota2da = randomInt(25, 48);
          }
        }

        this.pushCoursework(st, course.id_materia, gestion, periodo, progId, matriculaId, programmedAt, closeDate(st.regime), {
          p1, p2, p3, p4, finalGrade, nota2da, estado,
          observacion: estado === 'A' ? 'Aprobado regular' : 'Reprobado',
        });

        if (estado === 'A') {
          st.approvedCourses.add(course.id_materia);
          st.pending.delete(course.id_materia);
          summary.aprobados++;
        } else {
          st.pending.add(course.id_materia);
          failed++;
          summary.reprobados++;
        }
      }

      if (willDropOut) {
        st.isDroppedOut = true;
        st.alumno.estado = 'X';
        summary.desertores++;
      } else {
        st.lastFailRatio = taken > 0 ? failed / taken : 0;
        if (st.currentLevel <= st.maxLevel) st.currentLevel++;
      }
    }
  }

  private pushCoursework(
    st: StudentTracking,
    idMateria: number,
    gestion: number,
    periodo: number,
    progId: number,
    matriculaId: number,
    programmedAt: string,
    closedAt: string,
    g: { p1: number; p2: number; p3: number; p4: number; finalGrade: number; nota2da: number; estado: 'A' | 'R' | 'X'; observacion: string }
  ): void {
    const isDropout = g.estado === 'X';
    this.programacionesList.push({
      id: progId,
      id_alumno: st.alumno.id_alumno,
      id_materia: idMateria,
      id_gestion: gestion,
      id_periodo: periodo,
      id_grupo: 1,
      fecha: programmedAt,
      ult_usuario: 'system_enroll',
      estado: 'A',
      pparcial: g.p1,
      sparcial: g.p2,
      tparcial: g.p3,
      cparcial: g.p4,
      nota: g.finalGrade,
      nota_2da: g.nota2da,
      nota_ex_mesa: 0,
      _estado: 'REGISTRADO',
      tipo_programacion: 'NORMAL',
    });
    this.notasPlanillaList.push({
      id_matricula: matriculaId,
      id_gestion: gestion,
      id_periodo: periodo,
      id_alumno: st.alumno.id_alumno,
      id_materia: idMateria,
      grupo: 1,
      nota: g.finalGrade,
      ult_usuario: 'acta_system',
      estado: g.estado,
      observacion: g.observacion,
      nota_2da: g.nota2da,
      nota_ex_mesa: 0,
      pparcial: g.p1,
      sparcial: g.p2,
      tparcial: g.p3,
      cparcial: g.p4,
      promparcial: isDropout ? g.p1 : Math.round((g.p1 + g.p2 + g.p3 + g.p4) / 4),
      pract: g.p3,
      prompract: g.p3,
      lab: 0,
      promlab: 0,
      notapres: g.finalGrade,
      exfinal: g.p4,
      promexfinal: g.finalGrade,
      tipo: g.nota2da > 0 ? '2' : 'N',
      _fecha_creacion: closedAt,
      _unique: 1,
      __estado: 'A',
      __obsv: isDropout ? 'Cierre regular' : '',
    });
  }

  /**
   * Simula una compra efectiva de matrícula y los registros académicos que cubre.
   * En programas semestrales la compra de período 1 cubre ambos períodos, por
   * lo que el período 2 no crea una segunda transacción para el mismo alumno.
   * Los programas anuales compran una vez por gestión (periodo 1).
   */
  private registerMatriculaPurchase(st: StudentTracking, gestion: number, periodo: number): void {
    const periodKey = `${st.alumno.id_alumno}:${gestion}:${periodo}`;
    if (this.coveredPurchasePeriods.has(periodKey)) return;

    const coveredPeriods: number[] = st.regime === 'A' ? [1] : periodo === 1 ? [1, 2] : [2];
    const transactionId = this.nextPurchaseTransactionId++;
    const firstEnrollmentId = this.nextEnrollmentId;
    const purchaseDate = `${gestion}-${periodo === 2 ? '08' : '02'}-${randomInt(1, 9).toString().padStart(2, '0')}`;
    const purchaseTimestamp = `${purchaseDate} ${randomInt(8, 17).toString().padStart(2, '0')}:${randomInt(0, 59).toString().padStart(2, '0')}:00`;
    const clave = String(10000 + (transactionId % 90000)).padStart(5, '0');
    const amount = st.regime === 'A' ? 240 : 140;
    const matriculaType = this.studentsWithPreviousPurchase.has(st.alumno.id_alumno) ? 'ER' : 'EN';

    for (const coveredPeriod of coveredPeriods) {
      const enrollmentId = this.nextEnrollmentId++;
      this.matriculasList.push({
        id_matricula: enrollmentId,
        id_gestion: gestion,
        id_periodo: coveredPeriod,
        id_alumno: st.alumno.id_alumno,
        clave,
        fec_registro: purchaseDate,
        ult_usuario: 'seed_matricula',
        estado: 'A',
        tramite: 'N',
        tipo: 'A',
        registrado: purchaseTimestamp,
        id_tipo_matricula: matriculaType,
      });
      this.coveredPurchasePeriods.add(`${st.alumno.id_alumno}:${gestion}:${coveredPeriod}`);
    }

    this.cajasTransaccionesList.push({
      id_transaccion: transactionId,
      id_ra: st.alumno.id_ra,
      id_alumno: st.alumno.id_alumno,
      id_cargo: 'MAT1',
      fec_transaccion: purchaseDate,
      envia: 'seed_matricula',
      id_tipo_transaccion: 7,
      estado: 'A',
      fec_pago: purchaseTimestamp,
      costo: amount,
      id_gestion: gestion,
      id_periodo: periodo,
    });

    this.valoresTransaccionesList.push({
      id_transaccion: this.nextValueTransactionId++,
      id_alumno: st.alumno.id_alumno,
      id_programa: st.idPrograma,
      id_cargo: 'MAT1',
      id_concepto: '0001',
      costo: amount,
      fecha: purchaseDate,
      id_gestion: gestion,
      id_periodo: periodo,
      ult_usuario: 'seed_matricula',
      estado: 'A',
      id_ra: st.alumno.id_ra,
      envia: 'seed_matricula',
      id_tipo_transaccion: 7,
      sistema: 'D',
      id_caja_tran: transactionId,
    });
    this.studentsWithPreviousPurchase.add(st.alumno.id_alumno);

    if (this.nextEnrollmentId - firstEnrollmentId !== coveredPeriods.length) {
      throw new Error(`Cobertura de matrícula inconsistente para transacción ${transactionId}`);
    }
  }

  private simulateGraduations(gestion: number): void {
    const summary = this.summary(gestion);
    const modalities = ['TESIS DE GRADO', 'PROYECTO DE GRADO', 'EXCELENCIA ACADEMICA', 'TRABAJO DIRIGIDO'];
    for (const st of this.activeStudents) {
      if (st.isDroppedOut || st.alumno.estado !== 'P') continue;
      // Apto para titularse: completó la malla y no tiene materias pendientes.
      if (st.currentLevel <= st.maxLevel || st.pending.size > 0) continue;
      // Egresado apto: defiende este año según el momento institucional.
      if (!chance(this.factors.graduationRate)) continue;

      const idGrad = this.nextGraduadoId++;
      const fecha = `${gestion}-${randomInt(9, 12).toString().padStart(2, '0')}-${randomInt(1, 28).toString().padStart(2, '0')}`;
      this.graduadosList.push({
        id: idGrad,
        id_alumno: st.alumno.id_alumno,
        id_programa: st.idPrograma,
        id_gestion: gestion,
        id_periodo: st.regime === 'A' ? 1 : 2,
        fecha_graduacion: fecha,
        modalidad_graduacion: sampleUniform(modalities),
        nota_defensa: Math.round(clamp(78 + 8 * st.ability + randomInt(-6, 6), 60, 100)),
        nro_acta: `ACTA-${gestion}-${idGrad.toString().padStart(4, '0')}`,
        nro_dip: st.datos.nro_dip,
        _registrado: `${fecha} 15:00:00`,
      });
      st.alumno.estado = 'T';
      st.alumno.fec_egreso = fecha;
      summary.titulados++;
    }
  }
}
