/** Student-level prediction objectives with population publications (PRED-108). */
export type PredictionEventType = 'program_dropout' | 'student_backlog' | 'student_gpa';

export interface PredictionObjective {
  eventType: PredictionEventType;
  /** Short label for the selector. */
  label: string;
  /** Page title while the objective is selected. */
  title: string;
  description: string;
  kind: 'classification' | 'regression';
  /** Classification outcomes, as shown in the results table. */
  positiveLabel?: string;
  negativeLabel?: string;
}

export const PREDICTION_OBJECTIVES: PredictionObjective[] = [
  {
    eventType: 'program_dropout',
    label: 'Deserción',
    title: 'Riesgo de abandono del programa',
    description: 'Estudiantes en sus tres primeros años con riesgo de desertar en el siguiente corte.',
    kind: 'classification',
    positiveLabel: 'Riesgo de deserción',
    negativeLabel: 'Sin riesgo previsto',
  },
  {
    eventType: 'student_backlog',
    label: 'Rezago',
    title: 'Riesgo de rezago académico',
    description: 'Estudiantes cuyas materias arrastradas podrían aumentar en el siguiente corte.',
    kind: 'classification',
    positiveLabel: 'Riesgo de rezago',
    negativeLabel: 'Sin rezago previsto',
  },
  {
    eventType: 'student_gpa',
    label: 'PPA',
    title: 'Promedio ponderado acumulado proyectado',
    description: 'PPA esperado de cada estudiante en el siguiente corte, con su intervalo de predicción.',
    kind: 'regression',
  },
];

export function objectiveFor(eventType: PredictionEventType): PredictionObjective {
  return PREDICTION_OBJECTIVES.find((objective) => objective.eventType === eventType) ?? PREDICTION_OBJECTIVES[0];
}

export interface PredictionResultRow {
  predicted_class?: 'POSITIVE_EVENT' | 'NEGATIVE_EVENT' | null;
  event_probability?: number | null;
  predicted_value?: number | null;
  prediction_interval?: Record<string, { lower: number; upper: number }> | null;
}

const decimal = (value: number) => new Intl.NumberFormat('es-BO', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(value);

/** Outcome and its uncertainty for one published row, worded for the selected objective. */
export function describeResult(row: PredictionResultRow, objective: PredictionObjective): { outcome: string; detail: string } {
  if (objective.kind === 'regression') {
    if (row.predicted_value == null) return { outcome: 'No disponible', detail: '—' };
    // Prefer the 80 % interval; fall back to whichever level the model published.
    const levels = Object.keys(row.prediction_interval ?? {}).sort();
    const level = levels.find((key) => Number(key) === 0.8) ?? levels[0];
    const interval = level ? row.prediction_interval?.[level] : undefined;
    return {
      outcome: decimal(row.predicted_value),
      detail: interval ? `${Math.round(Number(level) * 100)} %: ${decimal(interval.lower)} – ${decimal(interval.upper)}` : '—',
    };
  }
  const outcome = row.predicted_class === 'POSITIVE_EVENT' ? objective.positiveLabel ?? 'Evento previsto' : objective.negativeLabel ?? 'Sin evento previsto';
  const detail = row.event_probability == null ? 'No disponible' : `${(row.event_probability * 100).toFixed(1)}%`;
  return { outcome, detail };
}
