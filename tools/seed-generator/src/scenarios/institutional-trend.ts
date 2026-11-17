/**
 * Escenarios institucionales longitudinales.
 *
 * Un escenario describe, gestión por gestión, cómo se mueven los grandes
 * impulsores de una universidad pública: la demanda de postulantes, la
 * selectividad del ingreso, el rendimiento académico, la deserción, la
 * titulación y la apertura de oferta académica. El simulador de cohortes
 * consulta estos factores en cada gestión; los conteos que ve el DW (admisión,
 * cursado, retención, titulación) emergen de la simulación, no se fijan aquí.
 *
 * Escenario `decline-growth` (narrativa solicitada):
 *   - <= 2009  meseta estable (línea base = 1.0).
 *   - 2010-2015 declive: cae la demanda (~-45 %), sube la deserción, baja el
 *               rendimiento y la institución se vuelve menos selectiva para
 *               sostener la matrícula. 2015 es el piso.
 *   - 2016-hoy  recuperación y crecimiento: la demanda supera la línea base
 *               desde 2019, mejora el rendimiento, baja la deserción y se abren
 *               carreras en subsedes (2017-2021). En 2020 el crecimiento se
 *               frena (pandemia: clases virtuales, notas algo infladas y
 *               deserción levemente mayor) sin revertir la tendencia.
 */

export type ScenarioName = 'stable' | 'decline-growth';

export interface YearFactors {
  /** Multiplicador del volumen de postulantes respecto de la línea base. */
  demand: number;
  /** Multiplicador de la tasa de admisión de cada modalidad (tope 0.98). */
  admissionRate: number;
  /** Desplazamiento (en desviaciones estándar) del rendimiento en cursado. */
  performanceShift: number;
  /** Multiplicador de la probabilidad de deserción por periodo. */
  dropoutMultiplier: number;
  /** Probabilidad de que un apto rinda y apruebe la defensa ese año. */
  graduationRate: number;
  /** Etiqueta narrativa de la fase, exportada en el manifiesto. */
  phase: 'BASELINE' | 'DECLINE' | 'RECOVERY' | 'GROWTH' | 'PANDEMIC';
}

const BASELINE: YearFactors = {
  demand: 1.0,
  admissionRate: 1.0,
  performanceShift: 0,
  dropoutMultiplier: 1.0,
  graduationRate: 0.8,
  phase: 'BASELINE',
};

/**
 * Puntos de control anuales del escenario `decline-growth`. Las gestiones
 * posteriores al último punto extrapolan suavemente la tendencia de
 * crecimiento (+3 % anual de demanda).
 */
const DECLINE_GROWTH: Record<number, Omit<YearFactors, 'phase'>> = {
  2009: { demand: 1.0, admissionRate: 1.0, performanceShift: 0.0, dropoutMultiplier: 1.0, graduationRate: 0.8 },
  2010: { demand: 0.94, admissionRate: 1.02, performanceShift: -0.08, dropoutMultiplier: 1.12, graduationRate: 0.77 },
  2011: { demand: 0.86, admissionRate: 1.05, performanceShift: -0.16, dropoutMultiplier: 1.25, graduationRate: 0.73 },
  2012: { demand: 0.77, admissionRate: 1.08, performanceShift: -0.25, dropoutMultiplier: 1.4, graduationRate: 0.68 },
  2013: { demand: 0.69, admissionRate: 1.11, performanceShift: -0.33, dropoutMultiplier: 1.55, graduationRate: 0.63 },
  2014: { demand: 0.61, admissionRate: 1.14, performanceShift: -0.4, dropoutMultiplier: 1.68, graduationRate: 0.6 },
  2015: { demand: 0.55, admissionRate: 1.16, performanceShift: -0.45, dropoutMultiplier: 1.78, graduationRate: 0.58 },
  2016: { demand: 0.62, admissionRate: 1.12, performanceShift: -0.32, dropoutMultiplier: 1.55, graduationRate: 0.62 },
  2017: { demand: 0.73, admissionRate: 1.07, performanceShift: -0.18, dropoutMultiplier: 1.32, graduationRate: 0.68 },
  2018: { demand: 0.86, admissionRate: 1.02, performanceShift: -0.05, dropoutMultiplier: 1.14, graduationRate: 0.74 },
  2019: { demand: 1.0, admissionRate: 0.98, performanceShift: 0.05, dropoutMultiplier: 1.0, graduationRate: 0.8 },
  2020: { demand: 1.03, admissionRate: 1.0, performanceShift: 0.18, dropoutMultiplier: 1.12, graduationRate: 0.7 },
  2021: { demand: 1.12, admissionRate: 0.96, performanceShift: 0.12, dropoutMultiplier: 0.95, graduationRate: 0.82 },
  2022: { demand: 1.22, admissionRate: 0.94, performanceShift: 0.15, dropoutMultiplier: 0.88, graduationRate: 0.85 },
  2023: { demand: 1.3, admissionRate: 0.92, performanceShift: 0.18, dropoutMultiplier: 0.83, graduationRate: 0.86 },
  2024: { demand: 1.37, admissionRate: 0.9, performanceShift: 0.2, dropoutMultiplier: 0.8, graduationRate: 0.87 },
  2025: { demand: 1.43, admissionRate: 0.89, performanceShift: 0.22, dropoutMultiplier: 0.78, graduationRate: 0.88 },
  2026: { demand: 1.48, admissionRate: 0.88, performanceShift: 0.23, dropoutMultiplier: 0.76, graduationRate: 0.88 },
};

function phaseFor(year: number): YearFactors['phase'] {
  if (year <= 2009) return 'BASELINE';
  if (year <= 2015) return 'DECLINE';
  if (year === 2020) return 'PANDEMIC';
  if (year <= 2018) return 'RECOVERY';
  return 'GROWTH';
}

export class InstitutionalScenario {
  constructor(public readonly name: ScenarioName = 'stable') {}

  public static parse(value: string | undefined): InstitutionalScenario {
    const name = (value || 'stable') as ScenarioName;
    if (name !== 'stable' && name !== 'decline-growth') {
      throw new Error(`Escenario desconocido '${value}'. Valores válidos: stable, decline-growth`);
    }
    return new InstitutionalScenario(name);
  }

  public factorsFor(year: number): YearFactors {
    if (this.name === 'stable') return { ...BASELINE };

    const years = Object.keys(DECLINE_GROWTH).map(Number).sort((a, b) => a - b);
    const first = years[0];
    const last = years[years.length - 1];
    if (year <= first) return { ...DECLINE_GROWTH[first], phase: phaseFor(year) };
    if (year <= last) return { ...DECLINE_GROWTH[year], phase: phaseFor(year) };

    // Extrapolación del crecimiento más allá del último punto de control.
    const extra = year - last;
    const tail = DECLINE_GROWTH[last];
    return {
      ...tail,
      demand: Number((tail.demand * Math.pow(1.03, extra)).toFixed(3)),
      phase: 'GROWTH',
    };
  }

  /**
   * Año desde el cual una carrera está abierta. En `decline-growth` las
   * carreras de subsedes (fuera de la sede central) se crean durante la fase
   * de crecimiento; el resto existe desde el inicio de la simulación.
   */
  public programOpeningYear(program: { id_programa: string; id_sede?: number }, index: number): number {
    if (this.name === 'stable') return 0;
    if (!program.id_sede || program.id_sede === 1) return 0;
    return 2017 + (index % 5); // 2017..2021, determinista por posición en catálogo
  }
}
