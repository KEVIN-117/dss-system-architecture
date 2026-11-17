import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import type { SimulationResult } from '../generators/cohorts.js';
import type { InstitutionalScenario } from '../scenarios/institutional-trend.js';
import type { SeedMetadata } from '../config/security.js';

/**
 * Paquete de dataset `uatf-oltp-seed` (formato v1). Estructura:
 *
 *   <dir>/
 *     manifest.json                 contrato: metadatos, archivos, filas, columnas, sha256
 *     sql/seed_oltp.sql             script transaccional cargable en el DDL Jachasun
 *     oltp/<esquema>.<tabla>.csv    volcado de cada tabla poblada (RFC 4180, UTF-8, encabezado)
 *     scenario/year_factors.csv     impulsores del escenario por gestión (entrada)
 *     scenario/yearly_kpis.csv      KPIs esperados por gestión (verdad de referencia)
 *
 * Los CSV de `oltp/` los produce el pipeline Docker desde la base cargada
 * (`\copy`), de modo que reflejan exactamente lo persistido. `buildManifest`
 * se ejecuta al final y sella el paquete.
 */
export const DATASET_FORMAT = 'uatf-oltp-seed';
export const DATASET_FORMAT_VERSION = '1.0.0';

function toCsvValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function writeCsv(filePath: string, header: string[], rows: unknown[][]): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const body = rows.map((row) => row.map(toCsvValue).join(',')).join('\n');
  fs.writeFileSync(filePath, `${header.join(',')}\n${body}${rows.length ? '\n' : ''}`, 'utf-8');
}

function sha256(filePath: string): string {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function csvShape(filePath: string): { columns: string[]; rows: number } {
  const content = fs.readFileSync(filePath, 'utf-8');
  const firstBreak = content.indexOf('\n');
  const header = firstBreak >= 0 ? content.slice(0, firstBreak) : content;
  // Conteo de registros respetando saltos de línea dentro de comillas.
  let rows = 0;
  let inQuotes = false;
  for (let i = firstBreak + 1; i < content.length && firstBreak >= 0; i++) {
    const ch = content[i];
    if (ch === '"') inQuotes = !inQuotes;
    else if (ch === '\n' && !inQuotes) rows++;
  }
  return { columns: header.replace(/\r$/, '').split(',').filter(Boolean), rows };
}

export class DatasetExporter {
  public static writeScenarioArtifacts(
    dir: string,
    sim: SimulationResult,
    scenario: InstitutionalScenario,
    metadata: SeedMetadata,
    startYear: number,
    endYear: number
  ): void {
    const factorRows: unknown[][] = [];
    for (let year = startYear; year <= endYear; year++) {
      const f = scenario.factorsFor(year);
      factorRows.push([year, f.phase, f.demand, f.admissionRate, f.performanceShift, f.dropoutMultiplier, f.graduationRate]);
    }
    writeCsv(
      path.join(dir, 'scenario', 'year_factors.csv'),
      ['gestion', 'fase', 'demanda', 'factor_admision', 'desplazamiento_rendimiento', 'factor_desercion', 'tasa_titulacion'],
      factorRows
    );

    writeCsv(
      path.join(dir, 'scenario', 'yearly_kpis.csv'),
      [
        'gestion', 'fase', 'postulantes', 'admitidos', 'tasa_admision', 'matriculas_periodo',
        'cursados', 'aprobados', 'reprobados', 'tasa_aprobacion', 'abandonos_formales',
        'desertores', 'titulados',
      ],
      sim.yearly.map((y) => {
        const graded = y.aprobados + y.reprobados;
        return [
          y.gestion, y.phase, y.postulantes, y.admitidos,
          y.postulantes ? (y.admitidos / y.postulantes).toFixed(4) : '',
          y.matriculados, y.cursados, y.aprobados, y.reprobados,
          graded ? (y.aprobados / graded).toFixed(4) : '',
          y.abandonos, y.desertores, y.titulados,
        ];
      })
    );

    const partial = {
      format: DATASET_FORMAT,
      format_version: DATASET_FORMAT_VERSION,
      dataset_id: `uatf-seed-${metadata.scenario}-s${metadata.seed}-${metadata.profile}`,
      generator: { name: metadata.generator_name, version: metadata.generator_version, faker: metadata.faker_version },
      generated_at: metadata.generated_at,
      synthetic: true,
      notice: metadata.notice,
      parameters: {
        seed: metadata.seed,
        profile: metadata.profile,
        scenario: metadata.scenario,
        cohort_size_baseline: metadata.cohort_size,
        start_year: startYear,
        end_year: endYear,
      },
      target_schema: {
        engine: 'postgresql',
        ddl: 'infra/postgres-tx/ddl/ddl_jachasun.sql',
        conventions: {
          periods: 'Semestral: id_periodo 1 y 2. Anual: id_periodo 1 (gestión completa).',
          pass_rule: 'GREATEST(nota, nota_2da, nota_ex_mesa) >= 51',
          abandonment: "notas_planilla.estado = 'X' (menos de 2 parciales rendidos)",
        },
      },
      generator_counts: metadata.counts,
    };
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'manifest.partial.json'), JSON.stringify(partial, null, 2), 'utf-8');
  }

  /**
   * Sella el paquete: recorre sql/, oltp/ y scenario/, calcula sha256, filas y
   * columnas de cada archivo y escribe manifest.json.
   */
  public static buildManifest(dir: string): string {
    const partialPath = path.join(dir, 'manifest.partial.json');
    const base = fs.existsSync(partialPath) ? JSON.parse(fs.readFileSync(partialPath, 'utf-8')) : {};
    const files: any[] = [];
    for (const section of ['sql', 'oltp', 'scenario']) {
      const sectionDir = path.join(dir, section);
      if (!fs.existsSync(sectionDir)) continue;
      for (const name of fs.readdirSync(sectionDir).sort()) {
        const full = path.join(sectionDir, name);
        const entry: any = {
          path: `${section}/${name}`,
          role: section === 'sql' ? 'load-script' : section === 'oltp' ? 'table' : 'scenario',
          bytes: fs.statSync(full).size,
          sha256: sha256(full),
        };
        if (name.endsWith('.csv')) {
          const shape = csvShape(full);
          entry.rows = shape.rows;
          entry.columns = shape.columns;
          if (section === 'oltp') entry.table = name.replace(/\.csv$/, '');
        }
        files.push(entry);
      }
    }
    const manifest = {
      ...base,
      sealed_at: new Date().toISOString(),
      csv_dialect: {
        encoding: 'UTF-8', delimiter: ',', quote: '"', escape: '"', header: true,
        null: '(campo vacío)', line_terminator: '\\n',
        date: 'YYYY-MM-DD', timestamp: 'YYYY-MM-DD HH:MM:SS (America/La_Paz, sin zona)',
      },
      files,
    };
    const out = path.join(dir, 'manifest.json');
    fs.writeFileSync(out, JSON.stringify(manifest, null, 2), 'utf-8');
    if (fs.existsSync(partialPath)) fs.unlinkSync(partialPath);
    return out;
  }
}
