#!/usr/bin/env node

import { Command } from 'commander';
import pc from 'picocolors';
import path from 'node:path';
import fs from 'node:fs';

import { loadAllCatalogs, resolveCatalogDirectory } from './loaders/catalogs.js';
import { initializeFaker } from './utils/discrete-cdf.js';
import { DemographicGenerator } from './generators/demographics.js';
import { SchoolGenerator } from './generators/schools.js';
import { AcademicGenerator } from './generators/academic.js';
import { LongitudinalCohortSimulator } from './generators/cohorts.js';
import { SqlEmitter } from './db/sql-emitter.js';
import { DatabaseClient } from './db/client.js';
import {
  getSafeDatabaseConfig,
  createSeedMetadata,
  validateSafeEnvironment,
} from './config/security.js';

const program = new Command();

program
  .name('seed-generator')
  .description(
    'Generador reproducible de datos académicos 100% ficticios para la base OLTP simulada (DATA-001 / Issue #206)'
  )
  .version('1.0.0')
  .option('-s, --seed <number>', 'Semilla determinista para Faker', '12345')
  .option('-p, --profile <profile>', 'Perfil de generación (test | medium | full)', 'test')
  .option('-c, --cohort-size <number>', 'Cantidad de postulantes por ingreso académico')
  .option('--start-year <number>', 'Año inicial de simulación longitudinal', '2000')
  .option('--end-year <number>', 'Año final de simulación longitudinal (incluye horizonte para etiquetas)', '2026')
  .option('--dry-run', 'Simular en memoria y emitir resumen métrico sin conectar a la BD', false)
  .option('-o, --output-sql <path>', 'Ruta de archivo para guardar el script SQL generado')
  .option('--clean', 'Incluir truncado controlado previo en orden inverso de dependencias', false)
  .option('--execute', 'Ejecutar inserción en la base de datos PostgreSQL local', false)
  .option('--catalogs-dir <path>', 'Ruta personalizada al directorio de catálogos JSON')
  .action(async (options) => {
    const startTime = Date.now();

    const seed = parseInt(options.seed, 10);
    const profile = options.profile as 'test' | 'medium' | 'full';
    const startYear = parseInt(options.startYear, 10);
    const endYear = parseInt(options.endYear, 10);

    let cohortSize = options.cohortSize ? parseInt(options.cohortSize, 10) : undefined;
    if (!cohortSize) {
      cohortSize = profile === 'test' ? 150 : profile === 'medium' ? 600 : 1500;
    }

    console.log(pc.bold(pc.cyan('\n======================================================================')));
    console.log(pc.bold(pc.cyan(' UATF SYNTHETIC SEED GENERATOR (DATA-001 / Issue #206)')));
    console.log(pc.bold(pc.cyan('======================================================================')));
    console.log(pc.gray(`• Semilla determinista : `) + pc.yellow(seed.toString()));
    console.log(pc.gray(`• Perfil seleccionado  : `) + pc.green(profile));
    console.log(pc.gray(`• Cohorte por ingreso  : `) + pc.white(`${cohortSize} postulantes`));
    console.log(pc.gray(`• Rango temporal       : `) + pc.white(`${startYear} a ${endYear} (${endYear - startYear + 1} gestiones)`));
    console.log(pc.gray(`• Modo de ejecución    : `) + (options.dryRun ? pc.magenta('DRY-RUN (Simulación)') : options.execute ? pc.red('EXECUTE (PostgreSQL)') : pc.blue('SQL GENERATION')));

    try {
      // 1. Carga de Catálogos Validados
      console.log(pc.blue('\n[1/5] Cargando catálogos de referencia...'));
      const catalogDir = options.catalogsDir || resolveCatalogDirectory();
      console.log(pc.gray(`      Ubicación: ${catalogDir}`));
      const catalogs = loadAllCatalogs(catalogDir);
      console.log(pc.green('      ✓ Catálogos JSON cargados exitosamente.'));

      // 2. Inicialización de Motores y Faker
      console.log(pc.blue('\n[2/5] Inicializando generador determinista...'));
      initializeFaker(seed);
      const demoGen = new DemographicGenerator(catalogs.demographic, catalogs.geographic);
      const schoolGen = new SchoolGenerator(catalogs.schools);
      const academicGen = new AcademicGenerator(catalogs.facultiesAndCareers, catalogs.studyPlansAndCourses, profile);
      console.log(pc.green(`      ✓ Estructura académica: ${academicGen.faculties.length} facultades, ${academicGen.programs.length} carreras, ${academicGen.allCourses.length} asignaturas.`));
      console.log(pc.green(`      ✓ Cuerpo docente: ${academicGen.teachers.length} docentes asignados.`));
      console.log(pc.green(`      ✓ Unidades educativas: ${schoolGen.getAllSchools().length} colegios registrados.`));

      // 3. Simulación longitudinal de cohortes (horizonte predeterminado 2000–2026)
      console.log(pc.blue(`\n[3/5] Simulando cohortes longitudinales (${startYear} - ${endYear})...`));
      const simulator = new LongitudinalCohortSimulator(demoGen, schoolGen, academicGen, catalogs.lookups);
      const simResult = simulator.simulate(cohortSize, startYear, endYear);
      console.log(pc.green(`      ✓ Postulaciones procesadas: ${simResult.postulantes.length}`));
      console.log(pc.green(`      ✓ Estudiantes admitidos matriculados: ${simResult.alumnos.length}`));
      console.log(pc.green(`      ✓ Inscripciones a materias: ${simResult.programaciones.length}`));
      console.log(pc.green(`      ✓ Actas de notas consolidadas: ${simResult.notasPlanilla.length}`));
      console.log(pc.green(`      ✓ Estudiantes graduados/titulados: ${simResult.graduados.length}`));

      // 4. Metadatos y Emisión SQL
      console.log(pc.blue('\n[4/5] Ensamblando grafo topológico y sentencias SQL...'));
      const counts: Record<string, number> = {
        'public.uatf_datos': simResult.uatfDatos.length,
        'public.postulantes': simResult.postulantes.length,
        'academico.alumnos': simResult.alumnos.length,
        'public.matriculas': simResult.matriculas.length,
        'public.cajas_transacciones': simResult.cajasTransacciones.length,
        'public.valores_transacciones': simResult.valoresTransacciones.length,
        'academico.alm_programaciones': simResult.programaciones.length,
        'academico.notas_planilla': simResult.notasPlanilla.length,
        'actas_graduacion.graduados': simResult.graduados.length,
        'academico.docentes': academicGen.teachers.length,
        'academico.pln_materias': academicGen.allCourses.length,
        'public.prs_colegios': schoolGen.getAllSchools().length,
      };

      const metadata = createSeedMetadata(seed, profile, cohortSize, startYear, endYear, counts);
      const sqlContent = SqlEmitter.generateSql(simResult, academicGen, schoolGen, metadata, options.clean);

      // Guardar a archivo si se solicitó o por defecto en out/
      const outputSqlPath = options.outputSql || (options.dryRun ? null : path.resolve(process.cwd(), 'seed_uatf_repro.sql'));
      if (outputSqlPath) {
        SqlEmitter.saveToFile(outputSqlPath, sqlContent);
        console.log(pc.green(`      ✓ Script SQL determinista emitido en: ${outputSqlPath} (${(Buffer.byteLength(sqlContent) / 1024 / 1024).toFixed(2)} MB)`));
      }

      // 5. Inserción en Base de Datos (si se especificó --execute)
      if (options.execute) {
        console.log(pc.blue('\n[5/5] Conectando a la base de datos OLTP simulada...'));
        const dbConfig = getSafeDatabaseConfig();
        validateSafeEnvironment(dbConfig.dbHost, dbConfig.dbName);
        console.log(pc.gray(`      Host: ${dbConfig.dbHost}:${dbConfig.dbPort} | Base de Datos: ${dbConfig.dbName} | Usuario: ${dbConfig.dbUser}`));

        const dbClient = new DatabaseClient(dbConfig);
        const isConnected = await dbClient.testConnection();

        if (!isConnected) {
          console.log(pc.yellow(`      ⚠ No se pudo conectar a PostgreSQL en ${dbConfig.dbHost}:${dbConfig.dbPort}.`));
          console.log(pc.yellow(`        Asegúrate de que el contenedor de PostgreSQL local esté activo (docker compose up -d).`));
          console.log(pc.cyan(`        El script SQL generado puede aplicarse manualmente cuando la BD esté arriba.`));
        } else {
          console.log(pc.green('      ✓ Conexión establecida. Ejecutando inserción transaccional en 8 niveles...'));
          await dbClient.executeTransaction(sqlContent);
          console.log(pc.green('      ✓ Carga completada exitosamente sin violación de claves foráneas.'));
        }
        await dbClient.close();
      } else {
        console.log(pc.blue('\n[5/5] Resumen de Ejecución:'));
      }

      // Tabla de Resumen Métrico
      console.log('\n' + pc.bold('MÉTRICAS DEL CONJUNTO SINTÉTICO GENERADO:'));
      console.log('┌──────────────────────────────────────┬───────────────────────────┐');
      console.log('│ Entidad / Tabla OLTP                 │ Registros Generados       │');
      console.log('├──────────────────────────────────────┼───────────────────────────┤');
      for (const [table, count] of Object.entries(counts)) {
        console.log(`│ ${table.padEnd(36)} │ ${count.toString().padStart(25)} │`);
      }
      console.log('└──────────────────────────────────────┴───────────────────────────┘');

      const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log(pc.bold(pc.green(`\n✔ GENERACIÓN COMPLETADA EXITOSAMENTE en ${elapsed}s.`)));
      console.log(pc.gray('----------------------------------------------------------------------'));
      console.log(pc.gray('Datos 100% ficticios generados de manera reproducible con @faker-js/faker v10.'));
      console.log(pc.gray('----------------------------------------------------------------------\n'));
    } catch (err: any) {
      console.error(pc.red(`\n✖ ERROR DURANTE LA GENERACIÓN: ${err.message}`));
      if (err.stack && process.env.DEBUG) {
        console.error(pc.gray(err.stack));
      }
      process.exit(1);
    }
  });

program.parse(process.argv);
