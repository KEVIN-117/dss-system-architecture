'use client';

import {
  AcademicHeatmapChart,
  BaseChart,
  type ChartOptionFactory,
} from '@dss-monorepo/charts';

import type { ModelSummary } from '../../data-access/ml-operations';

export function algorithmName(algorithm: string | null | undefined): string {
  if (algorithm === 'random_forest') return 'Random Forest';
  if (algorithm === 'xgboost') return 'XGBoost';
  if (algorithm === 'ridge') return 'Regresión Ridge';
  return algorithm ?? 'Algoritmo';
}

export function percent(value: number | null | undefined, digits = 1): string {
  return typeof value === 'number' && Number.isFinite(value)
    ? `${new Intl.NumberFormat('es-BO', { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(value * 100)} %`
    : '—';
}

export function decimal(value: number | null | undefined, digits = 3): string {
  return typeof value === 'number' && Number.isFinite(value)
    ? new Intl.NumberFormat('es-BO', { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(value)
    : '—';
}

export function dateTime(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? '—'
    : new Intl.DateTimeFormat('es-BO', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

export function isRegressionModel(model: Pick<ModelSummary, 'task_kind'>): boolean {
  return model.task_kind === 'regression';
}

/** The three metrics that summarise a candidate: recall/F1/precision, or MAE/RMSE/R² for regression. */
export function headlineMetrics(model: ModelSummary): Array<{ label: string; value: string }> {
  if (isRegressionModel(model)) {
    const metrics = model.regression_metrics;
    return [
      { label: 'MAE', value: decimal(metrics?.mae) },
      { label: 'RMSE', value: decimal(metrics?.rmse) },
      { label: 'R²', value: decimal(metrics?.r2) },
    ];
  }
  return [
    { label: 'Recall', value: percent(model.test_metrics.recall) },
    { label: 'F1-Score', value: percent(model.test_metrics.f1_score) },
    { label: 'Precisión', value: percent(model.test_metrics.precision) },
  ];
}

/** Short, stable label for a candidate in chart legends and axes. */
export function modelLabel(model: Pick<ModelSummary, 'algorithm' | 'created_at' | 'model_id'>): string {
  const date = model.created_at ? new Date(model.created_at) : null;
  const when =
    date && !Number.isNaN(date.getTime())
      ? new Intl.DateTimeFormat('es-BO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(date)
      : model.model_id.slice(0, 8);
  return `${algorithmName(model.algorithm)} · ${when}`;
}

function groupedBars(
  categories: string[],
  series: Array<{ name: string; values: Array<number | null> }>,
  options: { valueAxisMax?: number; percentAxis?: boolean } = {},
): ChartOptionFactory {
  return (theme, width) => {
    const compact = width < 560;
    const asPercent = options.percentAxis ?? true;
    return {
      backgroundColor: 'transparent',
      color: theme.chartColors,
      aria: { enabled: true },
      grid: { left: 8, right: 16, top: 44, bottom: 8, containLabel: true },
      legend: { top: 0, type: 'scroll', textStyle: { color: theme.mutedForeground } },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        valueFormatter: (value: unknown) =>
          typeof value === 'number' ? (asPercent ? percent(value) : decimal(value)) : '—',
      },
      xAxis: {
        type: 'category',
        data: categories,
        axisLabel: { color: theme.mutedForeground, interval: 0, rotate: compact && categories.length > 3 ? 30 : 0 },
        axisLine: { lineStyle: { color: theme.gridLine } },
      },
      yAxis: {
        type: 'value',
        min: 0,
        max: options.valueAxisMax ?? 1,
        axisLabel: {
          color: theme.mutedForeground,
          formatter: (value: number) => (asPercent ? `${Math.round(value * 100)} %` : String(value)),
        },
        splitLine: { lineStyle: { color: theme.gridLine } },
      },
      series: series.map((item) => ({
        name: item.name,
        type: 'bar',
        barMaxWidth: 28,
        data: item.values.map((value) => (typeof value === 'number' && Number.isFinite(value) ? value : null)),
        label: {
          show: !compact && series.length * categories.length <= 12,
          position: 'top',
          color: theme.foreground,
          fontSize: 11,
          formatter: ({ value }: { value: unknown }) => (typeof value === 'number' ? percent(value, 0) : ''),
        },
      })),
    };
  };
}

const COMPARED_METRICS: Array<{ label: string; pick: (model: ModelSummary) => number | null }> = [
  { label: 'Recall', pick: (m) => m.test_metrics.recall },
  { label: 'Precisión', pick: (m) => m.test_metrics.precision },
  { label: 'F1-Score', pick: (m) => m.test_metrics.f1_score },
  { label: 'PR-AUC', pick: (m) => m.test_metrics.pr_auc },
  { label: 'ROC-AUC', pick: (m) => m.test_metrics.roc_auc },
];

/** Test-set metrics of several candidates, side by side. */
export function MetricsComparisonChart({ models }: { models: ModelSummary[] }) {
  return (
    <BaseChart
      height={340}
      ariaLabel="Comparación de métricas de prueba entre modelos candidatos"
      option={groupedBars(
        COMPARED_METRICS.map((metric) => metric.label),
        models.map((model) => ({ name: modelLabel(model), values: COMPARED_METRICS.map((metric) => metric.pick(model)) })),
      )}
    />
  );
}

/** Cross-validation versus final test, to spot over- or under-fitting. */
export function ValidationVsTestChart({ models }: { models: ModelSummary[] }) {
  return (
    <BaseChart
      height={320}
      ariaLabel="Recall y F1-Score en validación cruzada y en la prueba final"
      option={groupedBars(models.map(modelLabel), [
        { name: 'Recall · validación', values: models.map((m) => m.validation.mean_recall) },
        { name: 'Recall · prueba', values: models.map((m) => m.test_metrics.recall) },
        { name: 'F1 · validación', values: models.map((m) => m.validation.mean_f1) },
        { name: 'F1 · prueba', values: models.map((m) => m.test_metrics.f1_score) },
      ])}
    />
  );
}

/** Precision, recall and F1 for each class of one candidate. */
export function PerClassChart({ model }: { model: ModelSummary }) {
  const classes = model.per_class.map((item) => classLabel(item.class_name));
  return (
    <BaseChart
      height={280}
      ariaLabel="Precisión, recall y F1-Score por clase"
      option={groupedBars(classes, [
        { name: 'Precisión', values: model.per_class.map((item) => item.precision) },
        { name: 'Recall', values: model.per_class.map((item) => item.recall) },
        { name: 'F1-Score', values: model.per_class.map((item) => item.f1_score) },
      ])}
    />
  );
}

export function classLabel(name: string | null | undefined): string {
  if (name === 'RISK') return 'En riesgo';
  if (name === 'NO_RISK') return 'Sin riesgo';
  return name ?? '—';
}

/** Confusion matrix of the final test: rows are actual, columns predicted. */
export function ConfusionMatrixChart({ model }: { model: ModelSummary }) {
  const matrix = model.confusion_matrix;
  if (!matrix || matrix.values.length === 0) {
    return <p className="text-sm text-muted-foreground">El candidato no publicó matriz de confusión.</p>;
  }
  const labels = matrix.label_names.map(classLabel);
  const data: Array<[number, number, number]> = [];
  matrix.values.forEach((row, actual) =>
    row.forEach((count, predicted) => data.push([predicted, actual, count])),
  );
  return (
    <AcademicHeatmapChart
      height={300}
      ariaLabel="Matriz de confusión: filas reales, columnas predichas"
      data={{
        xAxisLabels: labels.map((label) => `Predicho: ${label}`),
        yAxisLabels: labels.map((label) => `Real: ${label}`),
        data,
        min: 0,
        max: Math.max(...data.map(([, , count]) => count), 1),
      }}
    />
  );
}
