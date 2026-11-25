'use client';

import * as React from 'react';
import Link from 'next/link';
import { Button, Loader } from '@dss-monorepo/design-system';
import { History, RotateCcw, ShieldCheck } from 'lucide-react';

import { activateModel, getModelRegistry, type ModelSummary } from '../../../data-access/ml-operations';
import { getModelHistory, rollbackModel, type RegistryEvent } from '../../../data-access/ml-studio';
import { scopeLabel, splitScope } from '../model-actions';
import { dateTime, headlineMetrics, modelLabel } from '../model-charts';
import { ErrorAlert, Kpi, Notice, Panel, errorMessage } from '../studio-ui';

const ACTION_LABELS: Record<RegistryEvent['action'], string> = {
  ACTIVATE: 'Activado',
  PROMOTE: 'Promovido',
  ROLLBACK: 'Rollback',
  DEACTIVATE: 'Desactivado',
};

function ReasonInput({ id, value, onChange, placeholder }: { id: string; value: string; onChange: (value: string) => void; placeholder: string }) {
  return (
    <label htmlFor={id} className="block space-y-2 text-sm font-medium">
      Motivo <span className="font-normal text-muted-foreground">(obligatorio, queda en el historial)</span>
      <textarea
        id={id}
        rows={2}
        maxLength={500}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
      />
    </label>
  );
}

/**
 * Step 6: activate the chosen candidate for its event and cadence, roll the scope back to the
 * previous version, and read the audited history. Activation never requires a DSA (PRED-101).
 */
export function ActivateStep({ modelId }: { modelId: string }) {
  const [models, setModels] = React.useState<ModelSummary[] | null>(null);
  const [history, setHistory] = React.useState<RegistryEvent[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [actionError, setActionError] = React.useState<string | null>(null);
  const [message, setMessage] = React.useState<string | null>(null);
  const [reason, setReason] = React.useState('');
  const [rollbackReason, setRollbackReason] = React.useState('');
  const [busy, setBusy] = React.useState<'activate' | 'rollback' | null>(null);

  const load = React.useCallback(async () => {
    setError(null);
    try {
      const [snapshot, modelHistory] = await Promise.all([
        getModelRegistry(),
        getModelHistory(modelId).catch(() => ({ events: [] as RegistryEvent[] })),
      ]);
      setModels(snapshot.models);
      setHistory(modelHistory.events);
    } catch (cause) {
      setError(errorMessage(cause, 'No se pudo leer el registro de modelos.'));
    }
  }, [modelId]);
  React.useEffect(() => void load(), [load]);

  if (error) return <ErrorAlert message={error} />;
  if (!models) return <Loader text="Cargando el candidato…" fullScreen={false} className="py-16" />;
  const model = models.find((item) => item.model_id === modelId);
  if (!model) return <Notice tone="warning">El candidato {modelId} ya no está en el registro.</Notice>;
  const active = models.find((item) => item.scope_key === model.scope_key && item.is_active) ?? null;
  const scope = model.scope_key ? splitScope(model.scope_key) : null;

  async function activate() {
    if (!model || reason.trim().length < 3) return;
    setBusy('activate');
    setActionError(null);
    setMessage(null);
    try {
      await activateModel({ model_id: model.model_id, version: model.version, reason: reason.trim() });
      setReason('');
      setMessage(`${modelLabel(model)} responde ahora las predicciones de ${scopeLabel(model.scope_key)}.`);
      await load();
    } catch (cause) {
      setActionError(errorMessage(cause, 'No se pudo activar el modelo.'));
    } finally {
      setBusy(null);
    }
  }

  async function rollback() {
    if (!scope || rollbackReason.trim().length < 3) return;
    setBusy('rollback');
    setActionError(null);
    setMessage(null);
    try {
      const restored = await rollbackModel({ ...scope, reason: rollbackReason.trim() });
      setRollbackReason('');
      setMessage(`Se restauró la versión ${restored.version} en ${scopeLabel(model?.scope_key)}.`);
      await load();
    } catch (cause) {
      setActionError(errorMessage(cause, 'No se pudo volver a la versión anterior.'));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Candidato" value={<span className="text-lg">{modelLabel(model)}</span>} hint={scopeLabel(model.scope_key)} />
        {headlineMetrics(model).map((metric) => (
          <Kpi key={metric.label} label={`${metric.label} · prueba`} value={metric.value} />
        ))}
      </div>

      {message && (
        <p role="status" className="rounded-md border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm text-emerald-800 dark:text-emerald-200">
          {message}
        </p>
      )}
      <ErrorAlert message={actionError} />

      <div className="grid gap-6 xl:grid-cols-2">
        <Panel
          title="Activar"
          description={
            active
              ? `Hoy responde ${modelLabel(active)}. Al activar este candidato el anterior queda disponible para rollback.`
              : 'No hay un modelo activo para este objetivo y cadencia.'
          }
        >
          {model.is_active ? (
            <Notice>Este candidato ya es el modelo activo.</Notice>
          ) : !model.activatable ? (
            <Notice tone="warning">No se puede activar: {model.not_activatable_reason ?? 'el candidato no cumple los requisitos.'}</Notice>
          ) : (
            <div className="space-y-3">
              <ReasonInput id="studio-activate-reason" value={reason} onChange={setReason} placeholder="Por ejemplo: menor RMSE en validación" />
              <Button onClick={() => void activate()} disabled={busy !== null || reason.trim().length < 3}>
                <ShieldCheck aria-hidden="true" className="mr-2 size-4" /> {busy === 'activate' ? 'Activando…' : 'Activar modelo'}
              </Button>
            </div>
          )}
        </Panel>

        <Panel title="Volver a la versión anterior" description="Restaura el modelo que estaba activo antes del actual para este objetivo y cadencia.">
          {!scope || !active ? (
            <Notice>No hay un modelo activo que revertir.</Notice>
          ) : (
            <div className="space-y-3">
              <ReasonInput id="studio-rollback-reason" value={rollbackReason} onChange={setRollbackReason} placeholder="Por ejemplo: el nuevo modelo empeoró las alertas" />
              <Button variant="outline" onClick={() => void rollback()} disabled={busy !== null || rollbackReason.trim().length < 3}>
                <RotateCcw aria-hidden="true" className="mr-2 size-4" /> {busy === 'rollback' ? 'Restaurando…' : 'Hacer rollback'}
              </Button>
            </div>
          )}
        </Panel>
      </div>

      <Panel
        title="Historial del candidato"
        description="Activaciones, rollbacks y desactivaciones en las que participó, con su responsable y motivo."
        actions={
          <Link href="/ml-registry" className="text-sm font-medium text-primary hover:underline">
            Ver todos los modelos activos
          </Link>
        }
      >
        {history.length === 0 ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <History aria-hidden="true" className="size-4" /> Sin eventos todavía.
          </p>
        ) : (
          <ol className="space-y-3">
            {history.map((event, index) => (
              <li key={`${event.at ?? index}-${event.action}`} className="rounded-lg border border-border p-3 text-sm">
                <p className="font-medium">
                  {ACTION_LABELS[event.action] ?? event.action}
                  <span className="font-normal text-muted-foreground"> · {dateTime(event.at)} · {event.approved_by ?? '—'}</span>
                </p>
                {event.reason && <p className="mt-1 text-muted-foreground">{event.reason}</p>}
              </li>
            ))}
          </ol>
        )}
      </Panel>
    </div>
  );
}
