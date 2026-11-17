'use client';

import * as React from 'react';
import { Badge, Button } from '@dss-monorepo/design-system';
import { BarChart3, CheckCircle2, CircleSlash, Power, RefreshCw, ShieldCheck } from 'lucide-react';

import {
  getModelRegistry,
  type ModelRegistrySnapshot,
  type ModelSummary,
} from '../data-access/ml-operations';
import { ActivateModelDialog, DeactivateModelDialog, scopeLabel } from './ml/model-actions';
import {
  ConfusionMatrixChart,
  MetricsComparisonChart,
  PerClassChart,
  ValidationVsTestChart,
  algorithmName,
  dateTime,
  decimal,
  modelLabel,
  percent,
} from './ml/model-charts';

const MAX_COMPARED = 4;

function evidenceBadge(model: ModelSummary) {
  const kind = model.dataset.evidence_kind;
  if (kind === 'synthetic_fixture') return <Badge variant="outline">Sintético</Badge>;
  if (kind === 'exploratory_unapproved') return <Badge variant="outline">Exploratorio</Badge>;
  if (model.activatable) return <Badge variant="secondary">Datos aprobados</Badge>;
  return <Badge variant="outline">Sin aprobación</Badge>;
}

function statusCell(model: ModelSummary) {
  if (model.is_active)
    return (
      <span className="inline-flex items-center gap-1.5 font-medium text-emerald-600 dark:text-emerald-400">
        <CheckCircle2 aria-hidden="true" className="size-4" /> Activo
      </span>
    );
  if (model.activatable) return <span className="text-muted-foreground">Activable</span>;
  return (
    <span className="inline-flex items-center gap-1.5 text-muted-foreground" title={model.not_activatable_reason ?? undefined}>
      <CircleSlash aria-hidden="true" className="size-4" /> No activable
    </span>
  );
}

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-border bg-background/60 p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Panel({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-card p-5 sm:p-6">
      <h2 className="font-semibold">{title}</h2>
      {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function AdminModelValidationPage() {
  const [snapshot, setSnapshot] = React.useState<ModelRegistrySnapshot | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [scope, setScope] = React.useState<string>('');
  const [onlyActivatable, setOnlyActivatable] = React.useState(true);
  const [compared, setCompared] = React.useState<string[]>([]);
  const [focusedId, setFocusedId] = React.useState<string | null>(null);
  const [activateOpen, setActivateOpen] = React.useState(false);
  const [deactivateOpen, setDeactivateOpen] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setSnapshot(await getModelRegistry());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo consultar el registro de modelos.');
    } finally {
      setLoading(false);
    }
  }, []);
  React.useEffect(() => void load(), [load]);

  const models = React.useMemo(() => snapshot?.models ?? [], [snapshot]);
  const scopes = React.useMemo(
    () => Array.from(new Set(models.map((m) => m.scope_key).filter((key): key is string => Boolean(key)))).sort(),
    [models],
  );
  React.useEffect(() => {
    if (!scope && scopes.length) {
      // Prefer the scope that already has activatable candidates.
      const preferred = scopes.find((key) => models.some((m) => m.scope_key === key && m.activatable)) ?? scopes[0];
      setScope(preferred);
    }
  }, [scope, scopes, models]);

  const visible = React.useMemo(
    () => models.filter((m) => m.scope_key === scope && (!onlyActivatable || m.activatable || m.is_active)),
    [models, scope, onlyActivatable],
  );
  React.useEffect(() => {
    setCompared((current) => {
      const kept = current.filter((id) => visible.some((m) => m.model_id === id));
      return kept.length ? kept : visible.slice(0, 2).map((m) => m.model_id);
    });
    setFocusedId((current) =>
      current && visible.some((m) => m.model_id === current)
        ? current
        : (visible.find((m) => m.is_active) ?? visible[0])?.model_id ?? null,
    );
  }, [visible]);

  const comparedModels = visible.filter((m) => compared.includes(m.model_id));
  const focused = visible.find((m) => m.model_id === focusedId) ?? null;
  const activeInScope = models.find((m) => m.scope_key === scope && m.is_active) ?? null;

  function toggleCompared(id: string) {
    setCompared((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : current.length >= MAX_COMPARED
          ? current
          : [...current, id],
    );
  }

  return (
    <section className="mx-auto w-full max-w-7xl space-y-7 p-5 sm:p-7" aria-labelledby="model-validation-title">
      <header className="flex flex-wrap items-end justify-between gap-5 border-b border-border pb-6">
        <div>
          <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            <BarChart3 aria-hidden="true" className="size-4" /> DSS · validación de modelos
          </p>
          <h1 id="model-validation-title" className="text-3xl font-semibold tracking-tight">
            Validación de modelos
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
            Compara los candidatos con las métricas de la prueba final (cortes más recientes, nunca vistos en el
            entrenamiento) y con la validación cruzada. Activa el que responderá las predicciones.
          </p>
        </div>
        <Button variant="outline" onClick={() => void load()} disabled={loading}>
          <RefreshCw aria-hidden="true" className="mr-2 size-4" /> Actualizar
        </Button>
      </header>

      {error && (
        <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-end gap-5">
        <label className="space-y-2 text-sm font-medium">
          Tipo de modelo
          <select
            aria-label="Tipo de modelo"
            value={scope}
            onChange={(event) => setScope(event.target.value)}
            className="h-10 min-w-64 rounded-md border border-input bg-background px-3"
          >
            {scopes.map((key) => (
              <option key={key} value={key}>{scopeLabel(key)}</option>
            ))}
          </select>
        </label>
        <label className="flex h-10 items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={onlyActivatable}
            onChange={(event) => setOnlyActivatable(event.target.checked)}
            className="size-4 accent-primary"
          />
          Solo candidatos con datos aprobados
        </label>
        <p className="ml-auto text-sm text-muted-foreground">
          Activo:{' '}
          <span className="font-medium text-foreground">{activeInScope ? modelLabel(activeInScope) : 'ninguno'}</span>
        </p>
      </div>

      {!loading && visible.length === 0 && (
        <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          No hay candidatos para este tipo de modelo. Entrena uno desde Operaciones ML.
        </p>
      )}

      {visible.length > 0 && (
        <section className="overflow-hidden rounded-xl border border-border bg-card" aria-labelledby="candidates-title">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-5">
            <div>
              <h2 id="candidates-title" className="font-semibold">Candidatos</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Marca hasta {MAX_COMPARED} para compararlos. Haz clic en una fila para ver su detalle.
              </p>
            </div>
            <span className="text-sm text-muted-foreground">{visible.length} candidatos</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[56rem] text-left text-sm">
              <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3"><span className="sr-only">Comparar</span></th>
                  <th className="px-4 py-3">Modelo</th>
                  <th className="px-4 py-3">Datos</th>
                  <th className="px-4 py-3 text-right">Recall</th>
                  <th className="px-4 py-3 text-right">Precisión</th>
                  <th className="px-4 py-3 text-right">F1-Score</th>
                  <th className="px-4 py-3 text-right">PR-AUC</th>
                  <th className="px-4 py-3 text-right">ROC-AUC</th>
                  <th className="px-4 py-3">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {visible.map((model) => (
                  <tr
                    key={`${model.model_id}-${model.version}`}
                    onClick={() => setFocusedId(model.model_id)}
                    aria-selected={model.model_id === focusedId}
                    className={`cursor-pointer transition-colors hover:bg-muted/40 ${model.model_id === focusedId ? 'bg-primary/5' : ''}`}
                  >
                    <td className="px-4 py-3" onClick={(event) => event.stopPropagation()}>
                      <input
                        type="checkbox"
                        aria-label={`Comparar ${modelLabel(model)}`}
                        checked={compared.includes(model.model_id)}
                        disabled={!compared.includes(model.model_id) && compared.length >= MAX_COMPARED}
                        onChange={() => toggleCompared(model.model_id)}
                        className="size-4 accent-primary"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium">{algorithmName(model.algorithm)}</p>
                      <p className="text-xs text-muted-foreground">{dateTime(model.created_at)}</p>
                    </td>
                    <td className="px-4 py-3">{evidenceBadge(model)}</td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums">{percent(model.test_metrics.recall)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{percent(model.test_metrics.precision)}</td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums">{percent(model.test_metrics.f1_score)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{decimal(model.test_metrics.pr_auc)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{decimal(model.test_metrics.roc_auc)}</td>
                    <td className="px-4 py-3">{statusCell(model)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {comparedModels.length > 0 && (
        <div className="grid gap-6 xl:grid-cols-2">
          <Panel
            title="Métricas de la prueba final"
            description="Recall: qué parte de los casos en riesgo detecta. Precisión: qué parte de las alertas es correcta. F1-Score: equilibrio entre ambas."
          >
            <MetricsComparisonChart models={comparedModels} />
          </Panel>
          <Panel
            title="Validación cruzada frente a prueba final"
            description="Si la prueba cae mucho respecto de la validación, el modelo no generaliza bien a cortes nuevos."
          >
            <ValidationVsTestChart models={comparedModels} />
          </Panel>
        </div>
      )}

      {focused && (
        <section className="space-y-6 rounded-xl border border-border bg-card/40 p-5 sm:p-6" aria-labelledby="focused-title">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 id="focused-title" className="text-xl font-semibold">{modelLabel(focused)}</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {scopeLabel(focused.scope_key)} · versión <span className="font-mono">{focused.version}</span>
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {focused.is_active ? (
                <Button variant="outline" onClick={() => setDeactivateOpen(true)}>
                  <Power aria-hidden="true" className="mr-2 size-4" /> Desactivar
                </Button>
              ) : (
                <Button onClick={() => setActivateOpen(true)} disabled={!focused.activatable}>
                  <ShieldCheck aria-hidden="true" className="mr-2 size-4" /> Activar este modelo
                </Button>
              )}
            </div>
          </div>
          {!focused.activatable && !focused.is_active && focused.not_activatable_reason && (
            <p className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-200">
              No se puede activar: {focused.not_activatable_reason}
            </p>
          )}

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Kpi label="Recall" value={percent(focused.test_metrics.recall)} hint={`Validación: ${percent(focused.validation.mean_recall)}`} />
            <Kpi label="F1-Score" value={percent(focused.test_metrics.f1_score)} hint={`Validación: ${percent(focused.validation.mean_f1)}`} />
            <Kpi label="Precisión" value={percent(focused.test_metrics.precision)} hint={`PR-AUC ${decimal(focused.test_metrics.pr_auc)} · ROC-AUC ${decimal(focused.test_metrics.roc_auc)}`} />
            <Kpi
              label="Alertas en prueba"
              value={percent(focused.test_metrics.alert_rate)}
              hint={`Umbral ${decimal(focused.decision_threshold)} · ${focused.test_metrics.test_row_count ?? '—'} casos`}
            />
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <Panel title="Matriz de confusión" description="Casos de la prueba final según su resultado real y la predicción del modelo.">
              <ConfusionMatrixChart model={focused} />
            </Panel>
            <Panel title="Métricas por clase" description="Cómo rinde el modelo en cada clase por separado.">
              <PerClassChart model={focused} />
            </Panel>
          </div>

          <dl className="grid gap-x-8 gap-y-3 rounded-lg border border-border bg-background/60 p-4 text-sm sm:grid-cols-2">
            <div><dt className="text-muted-foreground">Objetivo</dt><dd className="font-mono text-xs">{focused.dataset.target_definition_ref ?? '—'}</dd></div>
            <div><dt className="text-muted-foreground">Población</dt><dd className="font-mono text-xs">{focused.dataset.population_definition_ref ?? '—'}</dd></div>
            <div><dt className="text-muted-foreground">Conjunto de datos</dt><dd className="font-mono text-xs">{focused.dataset.dataset_ref ?? '—'}</dd></div>
            <div>
              <dt className="text-muted-foreground">Validación cruzada</dt>
              <dd>{focused.validation.method ?? '—'} · {focused.validation.n_splits ?? '—'} particiones · {focused.validation.candidate_count ?? '—'} configuraciones</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-muted-foreground">Hiperparámetros elegidos</dt>
              <dd className="font-mono text-xs">{focused.hyperparameters ? JSON.stringify(focused.hyperparameters) : '—'}</dd>
            </div>
          </dl>
        </section>
      )}

      <ActivateModelDialog
        model={focused}
        currentActive={activeInScope}
        open={activateOpen}
        onOpenChange={setActivateOpen}
        onDone={() => void load()}
      />
      <DeactivateModelDialog
        scopeKey={focused?.scope_key ?? null}
        model={activeInScope}
        open={deactivateOpen}
        onOpenChange={setDeactivateOpen}
        onDone={() => void load()}
      />
    </section>
  );
}
