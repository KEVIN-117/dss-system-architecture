'use client';

import * as React from 'react';
import { Badge, Loader } from '@dss-monorepo/design-system';
import { Trophy } from 'lucide-react';

import { getModelRegistry, type ModelSummary } from '../../../data-access/ml-operations';
import { compareModels, type MlJob, type ModelComparison } from '../../../data-access/ml-studio';
import {
  ConfusionMatrixChart,
  MetricsComparisonChart,
  algorithmName,
  decimal,
  isRegressionModel,
  percent,
} from '../model-charts';
import { ResidualsChart } from '../studio-charts';
import { ErrorAlert, Notice, Panel, errorMessage } from '../studio-ui';

/** Candidates produced by the study's succeeded jobs. */
export function studyCandidateIds(jobs: MlJob[]): string[] {
  return jobs
    .filter((job) => job.status === 'SUCCEEDED' && job.model_candidate?.model_id)
    .map((job) => job.model_candidate?.model_id as string);
}

/**
 * Step 5: candidates of the study side by side. The recommendation comes from validation metrics
 * (prediction-service /v1/models/compare); test metrics are shown for information only.
 */
export function CompareStep({
  jobs,
  selectedModelId,
  onSelect,
}: {
  jobs: MlJob[];
  selectedModelId: string | null;
  onSelect: (modelId: string) => void;
}) {
  const candidateIds = studyCandidateIds(jobs);
  const idsKey = candidateIds.join(',');
  const [models, setModels] = React.useState<ModelSummary[] | null>(null);
  const [comparison, setComparison] = React.useState<ModelComparison | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [comparisonError, setComparisonError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const ids = idsKey ? idsKey.split(',') : [];
    let cancelled = false;
    setError(null);
    setComparisonError(null);
    setComparison(null);
    if (ids.length === 0) {
      setModels([]);
      return undefined;
    }
    getModelRegistry()
      .then((snapshot) => {
        if (!cancelled) setModels(snapshot.models.filter((model) => ids.includes(model.model_id)));
      })
      .catch((cause: unknown) => {
        if (!cancelled) setError(errorMessage(cause, 'No se pudo leer el registro de modelos.'));
      });
    if (ids.length >= 2) {
      compareModels(ids)
        .then((result) => {
          if (!cancelled) setComparison(result);
        })
        .catch((cause: unknown) => {
          if (!cancelled) setComparisonError(errorMessage(cause, 'No se pudo comparar los candidatos.'));
        });
    }
    return () => {
      cancelled = true;
    };
  }, [idsKey]);

  const recommended = comparison?.selected_candidate_by_validation ?? (candidateIds.length === 1 ? candidateIds[0] : null);
  React.useEffect(() => {
    if (!selectedModelId && recommended) onSelect(recommended);
  }, [selectedModelId, recommended, onSelect]);

  if (error) return <ErrorAlert message={error} />;
  if (candidateIds.length === 0) {
    return <Notice>Ningún entrenamiento del estudio terminó con éxito. Vuelve al paso anterior para reintentar.</Notice>;
  }
  if (!models) return <Loader text="Cargando candidatos…" fullScreen={false} className="py-16" />;

  const regression = models.some(isRegressionModel);
  const focused = models.find((model) => model.model_id === selectedModelId) ?? models[0] ?? null;

  return (
    <div className="space-y-6">
      {comparison && (
        <div
          className={`rounded-xl border p-4 text-sm ${
            comparison.decision_status === 'APTO' ? 'border-emerald-500/40 bg-emerald-500/5' : 'border-amber-500/40 bg-amber-500/5'
          }`}
        >
          <p className="flex items-center gap-2 font-semibold">
            <Trophy aria-hidden="true" className="size-4" />
            {comparison.decision_status === 'APTO' ? 'Hay un candidato recomendado' : 'Evidencia insuficiente para recomendar'}
          </p>
          <p className="mt-1 text-muted-foreground">{comparison.decision_reason}</p>
          <p className="mt-1 text-xs text-muted-foreground">Regla: {comparison.selection_rule}</p>
        </div>
      )}
      <ErrorAlert message={comparisonError} />

      <section className="overflow-hidden rounded-xl border border-border bg-card" aria-labelledby="study-candidates-title">
        <div className="border-b border-border p-5">
          <h2 id="study-candidates-title" className="font-semibold">Candidatos del estudio</h2>
          <p className="mt-1 text-sm text-muted-foreground">Elige el candidato que pasará al paso de activación.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[48rem] text-left text-sm">
            <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3"><span className="sr-only">Elegir</span></th>
                <th className="px-4 py-3">Algoritmo</th>
                {regression ? (
                  <>
                    <th className="px-4 py-3 text-right">RMSE validación</th>
                    <th className="px-4 py-3 text-right">MAE prueba</th>
                    <th className="px-4 py-3 text-right">RMSE prueba</th>
                    <th className="px-4 py-3 text-right">R² prueba</th>
                    <th className="px-4 py-3 text-right">MAPE</th>
                  </>
                ) : (
                  <>
                    <th className="px-4 py-3 text-right">Recall validación</th>
                    <th className="px-4 py-3 text-right">Recall prueba</th>
                    <th className="px-4 py-3 text-right">Precisión</th>
                    <th className="px-4 py-3 text-right">F1-Score</th>
                    <th className="px-4 py-3 text-right">PR-AUC</th>
                  </>
                )}
                <th className="px-4 py-3">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {models.map((model) => (
                <tr key={model.model_id} className={model.model_id === focused?.model_id ? 'bg-primary/5' : ''}>
                  <td className="px-4 py-3">
                    <input
                      type="radio"
                      name="study-candidate"
                      aria-label={`Elegir ${algorithmName(model.algorithm)}`}
                      checked={model.model_id === focused?.model_id}
                      onChange={() => onSelect(model.model_id)}
                      className="size-4 accent-primary"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-medium">{algorithmName(model.algorithm)}</span>
                    {model.model_id === recommended && <Badge className="ml-2" variant="secondary">Recomendado</Badge>}
                  </td>
                  {regression ? (
                    <>
                      <td className="px-4 py-3 text-right tabular-nums">{decimal(model.validation.mean_rmse)}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{decimal(model.regression_metrics?.mae)}</td>
                      <td className="px-4 py-3 text-right font-semibold tabular-nums">{decimal(model.regression_metrics?.rmse)}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{decimal(model.regression_metrics?.r2)}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{percent(model.regression_metrics?.mape)}</td>
                    </>
                  ) : (
                    <>
                      <td className="px-4 py-3 text-right tabular-nums">{percent(model.validation.mean_recall)}</td>
                      <td className="px-4 py-3 text-right font-semibold tabular-nums">{percent(model.test_metrics.recall)}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{percent(model.test_metrics.precision)}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{percent(model.test_metrics.f1_score)}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{decimal(model.test_metrics.pr_auc)}</td>
                    </>
                  )}
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {model.is_active ? 'Activo' : model.activatable ? 'Activable' : model.not_activatable_reason ?? 'No activable'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {focused && (
        <div className="grid gap-6 xl:grid-cols-2">
          {regression ? (
            <Panel
              title={`Residuos · ${algorithmName(focused.algorithm)}`}
              description="Error de la prueba final por tramo del valor real. Un sesgo positivo indica que el modelo sobreestima."
            >
              <ResidualsChart metrics={focused.regression_metrics} unit={focused.target_unit} />
            </Panel>
          ) : (
            <>
              <Panel title="Métricas de la prueba final" description="Recall, precisión, F1, PR-AUC y ROC-AUC de cada candidato.">
                <MetricsComparisonChart models={models} />
              </Panel>
              <Panel title={`Matriz de confusión · ${algorithmName(focused.algorithm)}`} description="Filas reales, columnas predichas.">
                <ConfusionMatrixChart model={focused} />
              </Panel>
            </>
          )}
        </div>
      )}
    </div>
  );
}
