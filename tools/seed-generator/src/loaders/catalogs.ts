import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface LoadedCatalogs {
  facultiesAndCareers: any;
  studyPlansAndCourses: any;
  geographic: any;
  demographic: any;
  schools: any;
  lookups: any;
}

let cachedCatalogs: LoadedCatalogs | null = null;

/**
 * Resuelve la ruta al directorio de catálogos buscando en ubicaciones probables:
 * 1. docs/seed-data/catalogs relativo a la raíz del repositorio
 * 2. ../../../../docs/seed-data/catalogs relativo a este módulo
 * 3. ./catalogs relativo al directorio actual de ejecución
 */
export function resolveCatalogDirectory(): string {
  const candidatePaths = [
    path.resolve(process.cwd(), 'docs/seed-data/catalogs'),
    path.resolve(process.cwd(), '../../docs/seed-data/catalogs'),
    path.resolve(__dirname, '../../../../docs/seed-data/catalogs'),
    path.resolve(__dirname, '../../../docs/seed-data/catalogs'),
    path.resolve(__dirname, '../catalogs'),
    path.resolve(process.cwd(), 'catalogs'),
  ];

  for (const candidate of candidatePaths) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) {
      const testFile = path.join(candidate, 'faculties_and_careers.json');
      if (fs.existsSync(testFile)) {
        return candidate;
      }
    }
  }

  throw new Error(
    `No se pudo localizar el directorio de catálogos 'docs/seed-data/catalogs'.\n` +
    `Rutas evaluadas:\n${candidatePaths.map((p) => `  - ${p}`).join('\n')}`
  );
}

/**
 * Carga y cachea todos los catálogos JSON validados.
 */
export function loadAllCatalogs(customDir?: string): LoadedCatalogs {
  if (cachedCatalogs && !customDir) {
    return cachedCatalogs;
  }

  const catalogDir = customDir || resolveCatalogDirectory();

  const loadJson = (filename: string): any => {
    const filePath = path.join(catalogDir, filename);
    if (!fs.existsSync(filePath)) {
      throw new Error(`Archivo de catálogo requerido no encontrado: ${filePath}`);
    }
    const raw = fs.readFileSync(filePath, 'utf-8');
    try {
      return JSON.parse(raw);
    } catch (err: any) {
      throw new Error(`Error de sintaxis JSON en ${filename}: ${err.message}`);
    }
  };

  cachedCatalogs = {
    facultiesAndCareers: loadJson('faculties_and_careers.json'),
    studyPlansAndCourses: loadJson('study_plans_and_courses.json'),
    geographic: loadJson('geographic_bolivia_potosi.json'),
    demographic: loadJson('demographic_names_surnames.json'),
    schools: loadJson('schools_catalog.json'),
    lookups: loadJson('lookup_reference_codes.json'),
  };

  return cachedCatalogs;
}
