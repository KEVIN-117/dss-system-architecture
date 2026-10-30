import { fakerES as faker } from '@faker-js/faker';
import type {
  EntityUatfDatos,
  EntityPostulante,
  EntityAlumno,
  EntityProgramacion,
  EntityNotaPlanilla,
  EntityGraduado,
  WeightedItem,
} from '../types/index.js';
import { DemographicGenerator } from './demographics.js';
import { SchoolGenerator } from './schools.js';
import { AcademicGenerator, type PreparedCourse } from './academic.js';
import { sampleWeighted, sampleUniform, randomInt, randomFloat, chance } from '../utils/discrete-cdf.js';

export interface SimulationResult {
  uatfDatos: EntityUatfDatos[];
  postulantes: EntityPostulante[];
  alumnos: EntityAlumno[];
  programaciones: EntityProgramacion[];
  notasPlanilla: EntityNotaPlanilla[];
  graduados: EntityGraduado[];
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
}

export class LongitudinalCohortSimulator {
  private uatfDatosList: EntityUatfDatos[] = [];
  private postulantesList: EntityPostulante[] = [];
  private alumnosList: EntityAlumno[] = [];
  private programacionesList: EntityProgramacion[] = [];
  private notasPlanillaList: EntityNotaPlanilla[] = [];
  private graduadosList: EntityGraduado[] = [];

  private activeStudents: StudentTracking[] = [];
  private nextRaIndex = 1;
  private nextAlumnoId = 1;
  private nextPostulanteId = 1;
  private nextProgramacionId = 1;
  private nextMatriculaId = 1;
  private nextGraduadoId = 1;

  private modalityWeights: WeightedItem<{ id: number; sigla: string; passRate: number }>[] = [];

  constructor(
    private demographicGen: DemographicGenerator,
    private schoolGen: SchoolGenerator,
    private academicGen: AcademicGenerator,
    private lookupsCatalog: any
  ) {
    this.initModalities();
  }

  private initModalities(): void {
    const modalities = this.lookupsCatalog.admission_modalities || [];
    if (modalities.length > 0) {
      this.modalityWeights = modalities.map((m: any) => ({
        item: {
          id: m.id_examen || m.id || 1,
          sigla: m.sigla || 'PA',
          passRate: m.pass_rate || (m.aprobado_porcentaje ? m.aprobado_porcentaje / 100 : 0.65),
        },
        weight: m.weight || m.peso || 10,
      }));
    } else {
      this.modalityWeights = [
        { item: { id: 1, sigla: 'PA', passRate: 0.65 }, weight: 65 }, // Prueba de Admisión PSA
        { item: { id: 2, sigla: 'CP', passRate: 0.75 }, weight: 20 }, // Curso Preuniversitario
        { item: { id: 3, sigla: 'EX', passRate: 0.98 }, weight: 8 },  // Excelencia Académica
        { item: { id: 5, sigla: 'BB', passRate: 0.95 }, weight: 7 },  // Beca Bachiller
      ];
    }
  }

  /**
   * Ejecuta la simulación longitudinal completa entre startYear y endYear.
   */
  public simulate(
    cohortSize: number,
    startYear = 2018,
    endYear = 2026
  ): SimulationResult {
    for (let gestion = startYear; gestion <= endYear; gestion++) {
      // 1. Proceso de Admisión e Ingreso de nueva cohorte
      this.simulateAdmissionCohort(gestion, cohortSize);

      // 2. Semestre I (Período 1 para semestrales, y anuales)
      this.simulateAcademicPeriod(gestion, 1);

      // 3. Semestre II (Período 2 para semestrales)
      this.simulateAcademicPeriod(gestion, 2);

      // 4. Cierre anual de gestión: Titulación de cohortes avanzadas
      this.simulateGraduations(gestion);
    }

    return {
      uatfDatos: this.uatfDatosList,
      postulantes: this.postulantesList,
      alumnos: this.alumnosList,
      programaciones: this.programacionesList,
      notasPlanilla: this.notasPlanillaList,
      graduados: this.graduadosList,
    };
  }

  private simulateAdmissionCohort(gestion: number, cohortSize: number): void {
    for (let i = 0; i < cohortSize; i++) {
      const gender = i % 2 === 0 ? 'M' : 'F';
      const person = this.demographicGen.generatePerson(gender, gestion);
      const school = this.schoolGen.sampleSchool();
      const idRa = this.demographicGen.generateIdRa(this.nextRaIndex++);

      // Crear registro demográfico uatf_datos
      const uatfDato = this.demographicGen.toUatfDatosEntity(idRa, person, school.id_colegio, gestion - 1);
      this.uatfDatosList.push(uatfDato);

      // Seleccionar carrera a postular
      const targetProgram = sampleUniform(this.academicGen.programs);
      const modality = sampleWeighted(this.modalityWeights);

      // Determinar si aprueba el examen de ingreso
      const isApproved = chance(modality.passRate);
      const examGrade = isApproved ? randomInt(51, 95) : randomInt(20, 50);

      const postulanteId = this.nextPostulanteId++;
      const postulante: EntityPostulante = {
        id_alumno: postulanteId,
        id_programa: targetProgram.id_programa,
        id_ra: idRa,
        fec_inscripcion: `${gestion}-01-${randomInt(10, 25).toString().padStart(2, '0')}`,
        id_plan: 2018,
        id_grado: 'A',
        estado: isApproved ? 'A' : 'P',
        id_calificacion: school.tipo === 'P' ? '2' : '1',
        promedio: examGrade,
        nro_dip: person.nro_dip,
        examen: modality.id,
        id_acceso: modality.sigla,
        id_periodo: 1,
        id_gestion: gestion,
        nota: examGrade,
        _estado: 'A',
        _id_usuario: 'adm_seeder',
      };
      this.postulantesList.push(postulante);

      // Si fue admitido, matricularlo como Alumno regular
      if (isApproved) {
        const alumnoId = this.nextAlumnoId++;
        const alumno: EntityAlumno = {
          id_alumno: alumnoId,
          id_programa: targetProgram.id_programa,
          id_ra: idRa,
          fec_inscripcion: `${gestion}-02-05`,
          fec_egreso: null,
          id_plan: 2018,
          id_grado: 'A',
          estado: 'P', // Regular Activo
          tipo_alumno: 'B', // Boliviano
          id_tipo_aprobacion: modality.id,
          carrera: 1,
          ssu: 'S',
          _fecha_registro: `${gestion}-02-05 10:00:00`,
        };
        this.alumnosList.push(alumno);

        const totalLevels = targetProgram.regime === 'A' ? 5 : 10;
        this.activeStudents.push({
          alumno,
          datos: uatfDato,
          idPrograma: targetProgram.id_programa,
          currentLevel: 1,
          approvedCourses: new Set<number>(),
          isDroppedOut: false,
          regime: targetProgram.regime,
          maxLevel: totalLevels,
        });
      }
    }
  }

  private simulateAcademicPeriod(gestion: number, periodo: number): void {
    // Generar asignaciones docentes para este período si no existen
    this.academicGen.generateAssignmentsForPeriod(gestion, periodo);

    for (const st of this.activeStudents) {
      if (st.isDroppedOut) continue;

      // Las carreras anuales solo se evalúan y registran en período 1 (o cierre anual)
      if (st.regime === 'A' && periodo === 2) continue;

      // Obtener asignaturas del nivel actual del estudiante
      const availableCourses = this.academicGen.getCoursesForProgramAndLevel(st.idPrograma, st.currentLevel);
      if (availableCourses.length === 0) continue;

      // Evaluar si el estudiante deserta (Regla DSA / Dropout Probability)
      // Mayor probabilidad de deserción en los primeros dos ciclos (semestres 1 y 2) ~12%, disminuyendo luego a ~3%
      const dropoutProbability = st.currentLevel <= 2 ? 0.12 : 0.03;
      const willDropOut = chance(dropoutProbability);

      for (const course of availableCourses) {
        // Verificar si cumple prerrequisitos
        if (course.id_materia_padre && !st.approvedCourses.has(course.id_materia_padre)) {
          // No puede cursar aún por falta de prerrequisito
          continue;
        }

        const progId = this.nextProgramacionId++;
        const matriculaId = this.nextMatriculaId++;

        if (willDropOut) {
          // =========================================================================
          // REGLA DSA DE ABANDONO / DESERCIÓN:
          // El estudiante se presenta a MENOS DE 2 PARCIALES (< 2 evaluaciones)
          // Se registra pparcial o ninguno, y nota final 0 con estado 'X' (Abandono)
          // =========================================================================
          const hasFirstPartial = chance(0.4);
          const pparcial = hasFirstPartial ? randomInt(10, 45) : 0;

          const programacion: EntityProgramacion = {
            id: progId,
            id_alumno: st.alumno.id_alumno,
            id_materia: course.id_materia,
            id_gestion: gestion,
            id_periodo: periodo,
            id_grupo: 1,
            fecha: `${gestion}-${periodo === 1 ? '02' : '08'}-10 09:00:00`,
            ult_usuario: 'system_enroll',
            estado: 'A',
            pparcial,
            sparcial: 0,
            tparcial: 0,
            cparcial: 0,
            nota: pparcial,
            nota_2da: 0,
            nota_ex_mesa: 0,
            _estado: 'REGISTRADO',
            tipo_programacion: 'NORMAL',
          };
          this.programacionesList.push(programacion);

          const notaPlanilla: EntityNotaPlanilla = {
            id_matricula: matriculaId,
            id_gestion: gestion,
            id_periodo: periodo,
            id_alumno: st.alumno.id_alumno,
            id_materia: course.id_materia,
            grupo: 1,
            nota: pparcial,
            ult_usuario: 'acta_system',
            estado: 'X', // ABANDONO
            observacion: 'REGLA_DSA:abandono_menos_de_dos_parciales',
            nota_2da: 0,
            nota_ex_mesa: 0,
            pparcial,
            sparcial: 0,
            tparcial: 0,
            cparcial: 0,
            promparcial: pparcial,
            pract: 0,
            prompract: 0,
            lab: 0,
            promlab: 0,
            notapres: pparcial,
            exfinal: 0,
            promexfinal: pparcial,
            tipo: 'N',
            _fecha_creacion: `${gestion}-${periodo === 1 ? '06' : '12'}-20 18:00:00`,
            _unique: 1,
            __estado: 'A',
            __obsv: 'Cierre regular',
          };
          this.notasPlanillaList.push(notaPlanilla);
          st.isDroppedOut = true;
          st.alumno.estado = 'X'; // Desertor
        } else {
          // =========================================================================
          // CURSADO NORMAL CON EVALUACIONES COMPLETAS (FÓRMULA 30/30/20/20)
          // =========================================================================
          // Perfil de rendimiento: 72% de probabilidad base de aprobación
          const isGoodStudent = chance(0.72);
          const p1 = isGoodStudent ? randomInt(50, 95) : randomInt(25, 55);
          const p2 = isGoodStudent ? randomInt(50, 95) : randomInt(25, 55);
          const p3 = isGoodStudent ? randomInt(45, 90) : randomInt(20, 50);
          const p4 = isGoodStudent ? randomInt(45, 95) : randomInt(20, 50);

          // Ponderación: 30% P1 + 30% P2 + 20% P3 + 20% P4
          let finalGrade = Math.round(p1 * 0.3 + p2 * 0.3 + p3 * 0.2 + p4 * 0.2);
          let nota2da = 0;
          let estadoCursado: 'A' | 'R' = finalGrade >= 51 ? 'A' : 'R';

          // Instancia de 2do turno si nota entre 40 y 50
          if (estadoCursado === 'R' && finalGrade >= 40) {
            if (chance(0.55)) {
              // Aprueba en 2do turno con nota fijada en 51
              nota2da = 51;
              finalGrade = 51;
              estadoCursado = 'A';
            } else {
              nota2da = randomInt(25, 48);
            }
          }

          const programacion: EntityProgramacion = {
            id: progId,
            id_alumno: st.alumno.id_alumno,
            id_materia: course.id_materia,
            id_gestion: gestion,
            id_periodo: periodo,
            id_grupo: 1,
            fecha: `${gestion}-${periodo === 1 ? '02' : '08'}-10 09:00:00`,
            ult_usuario: 'system_enroll',
            estado: 'A',
            pparcial: p1,
            sparcial: p2,
            tparcial: p3,
            cparcial: p4,
            nota: finalGrade,
            nota_2da: nota2da,
            nota_ex_mesa: 0,
            _estado: 'REGISTRADO',
            tipo_programacion: 'NORMAL',
          };
          this.programacionesList.push(programacion);

          const notaPlanilla: EntityNotaPlanilla = {
            id_matricula: matriculaId,
            id_gestion: gestion,
            id_periodo: periodo,
            id_alumno: st.alumno.id_alumno,
            id_materia: course.id_materia,
            grupo: 1,
            nota: finalGrade,
            ult_usuario: 'acta_system',
            estado: estadoCursado,
            observacion: estadoCursado === 'A' ? 'Aprobado regular' : 'Reprobado',
            nota_2da: nota2da,
            nota_ex_mesa: 0,
            pparcial: p1,
            sparcial: p2,
            tparcial: p3,
            cparcial: p4,
            promparcial: Math.round((p1 + p2 + p3 + p4) / 4),
            pract: p3,
            prompract: p3,
            lab: 0,
            promlab: 0,
            notapres: finalGrade,
            exfinal: p4,
            promexfinal: finalGrade,
            tipo: nota2da > 0 ? '2' : 'N',
            _fecha_creacion: `${gestion}-${periodo === 1 ? '06' : '12'}-20 18:00:00`,
            _unique: 1,
            __estado: 'A',
            __obsv: '',
          };
          this.notasPlanillaList.push(notaPlanilla);

          if (estadoCursado === 'A') {
            st.approvedCourses.add(course.id_materia);
          }
        }
      }

      // Si no desertó, avanzar de nivel si aprobó la mayoría de materias
      if (!st.isDroppedOut) {
        st.currentLevel++;
      }
    }
  }

  private simulateGraduations(gestion: number): void {
    for (const st of this.activeStudents) {
      if (st.isDroppedOut) continue;

      // Si alcanzó el nivel máximo y tiene más de 30 materias aprobadas
      if (st.currentLevel > st.maxLevel && st.approvedCourses.size >= 25 && st.alumno.estado === 'P') {
        const idGrad = this.nextGraduadoId++;
        const notaDefensa = randomInt(70, 98);
        const modalities = ['TESIS DE GRADO', 'PROYECTO DE GRADO', 'EXCELENCIA ACADEMICA', 'TRABAJO DIRIGIDO'];
        const modalId = randomInt(1, 4);

        const graduado: EntityGraduado = {
          id: idGrad,
          id_alumno: st.alumno.id_alumno,
          id_programa: st.idPrograma,
          id_gestion: gestion,
          id_periodo: 2,
          fecha_graduacion: `${gestion}-11-25`,
          modalidad_graduacion: modalities[modalId - 1] || 'TESIS DE GRADO',
          id_modalidad: modalId,
          nota_defensa: notaDefensa,
          titulo: 'LICENCIATURA',
          nro_dip: st.datos.nro_dip,
          nro_acta: `ACTA-${gestion}-${idGrad.toString().padStart(4, '0')}`,
          _registrado: `${gestion}-11-25 15:00:00`,
        };
        this.graduadosList.push(graduado);

        // Actualizar alumno a Titulado ('T')
        st.alumno.estado = 'T';
        st.alumno.fec_egreso = `${gestion}-11-25`;
      }
    }
  }
}
