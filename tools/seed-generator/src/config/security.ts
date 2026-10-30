import dotenv from 'dotenv';
import path from 'node:path';
import fs from 'node:fs';

// Intentar cargar .env desde ubicaciones comunes
const envPaths = [
  path.resolve(process.cwd(), '.env'),
  path.resolve(process.cwd(), '../../.env'),
];

for (const p of envPaths) {
  if (fs.existsSync(p)) {
    dotenv.config({ path: p });
    break;
  }
}

export interface SecurityConfig {
  dbHost: string;
  dbPort: number;
  dbUser: string;
  dbPassword?: string;
  dbName: string;
  dbSsl: boolean;
}

const FORBIDDEN_HOST_PATTERNS = [
  /prod/i,
  /production/i,
  /uatf\.edu\.bo/i,
  /rds\.amazonaws\.com/i,
  /cloud\.google\.com/i,
  /database\.azure\.com/i,
  /supabase\.co/i,
  /elephantsql\.com/i,
  /cockroachlabs\.cloud/i,
];

/**
 * Valida que la configuración de conexión no apunte a un entorno de producción.
 * Si se detecta un host o base de datos productiva, arroja un error y aborta inmediatamente.
 */
export function validateSafeEnvironment(host: string, dbName: string): void {
  for (const pattern of FORBIDDEN_HOST_PATTERNS) {
    if (pattern.test(host)) {
      throw new Error(
        `[SECURITY GUARD] Conexión rechazada: El host '${host}' coincide con un patrón protegido de producción (${pattern}).\n` +
        `Esta herramienta está restringida a bases de datos OLTP simuladas locales (ej. 'localhost', '127.0.0.1', 'postgres').`
      );
    }
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      `[SECURITY GUARD] Conexión rechazada: NODE_ENV está configurado en 'production'.\n` +
      `La generación sintética solo está autorizada en entornos de desarrollo y pruebas ('development', 'test').`
    );
  }

  // Comprobar nombres de base de datos protegidos
  if (/prod/i.test(dbName) || /uatf_oficial/i.test(dbName)) {
    throw new Error(
      `[SECURITY GUARD] Conexión rechazada: El nombre de base de datos '${dbName}' parece pertenecer a un entorno productivo.`
    );
  }
}

/**
 * Obtiene la configuración de conexión segura desde variables de entorno.
 */
export function getSafeDatabaseConfig(): SecurityConfig {
  const host = process.env.DB_HOST || 'localhost';
  const port = parseInt(process.env.DB_PORT || '5432', 10);
  const user = process.env.DB_USER || 'postgres';
  const password = process.env.DB_PASSWORD || 'postgres';
  const dbName = process.env.DB_NAME || 'jachasun';
  const dbSsl = process.env.DB_SSL === 'true';

  validateSafeEnvironment(host, dbName);

  return {
    dbHost: host,
    dbPort: port,
    dbUser: user,
    dbPassword: password,
    dbName: dbName,
    dbSsl: dbSsl,
  };
}

export interface SeedMetadata {
  generator_name: string;
  generator_version: string;
  faker_version: string;
  seed: number;
  profile: string;
  generated_at: string;
  is_synthetic: true;
  notice: string;
  cohort_size: number;
  start_year: number;
  end_year: number;
  counts: Record<string, number>;
}

export function createSeedMetadata(
  seed: number,
  profile: string,
  cohortSize: number,
  startYear: number,
  endYear: number,
  counts: Record<string, number>
): SeedMetadata {
  return {
    generator_name: 'uatf-seed-generator',
    generator_version: '1.0.0',
    faker_version: '10.6.0',
    seed,
    profile,
    generated_at: new Date().toISOString(),
    is_synthetic: true,
    notice:
      'DATOS 100% SINTÉTICOS Y FICTICIOS PARA DESARROLLO Y PRUEBAS. NO REPRESENTAN EVIDENCIA NI INFORMACIÓN REAL DE LA UATF.',
    cohort_size: cohortSize,
    start_year: startYear,
    end_year: endYear,
    counts,
  };
}
