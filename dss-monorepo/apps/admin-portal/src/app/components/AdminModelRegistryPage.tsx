'use client';

import * as React from 'react';
import Link from 'next/link';
import { Badge, Button } from '@dss-monorepo/design-system';
import { History, Power, RefreshCw, RotateCcw, ServerCog } from 'lucide-react';

import {
  getModelRegistry,
  type ModelRegistryEvent,
  type ModelRegistrySnapshot,
  type ModelSummary,
} from '../data-access/ml-operations';
import { DeactivateModelDialog, RollbackModelDialog, scopeLabel } from './ml/model-actions';
import { dateTime, headlineMetrics, modelLabel } from './ml/model-charts';

const KNOWN_SCOPES = [
  'PROGRAM_DROPOUT_NEXT_EXPECTED_CLOSURE|SEMESTRAL',
  'PROGRAM_DROPOUT_NEXT_EXPECTED_CLOSURE|ANUAL',
  'COURSE_ABANDONMENT|SEMESTRAL',
  'COURSE_ABANDONMENT|ANUAL',
];

const ACTION_LABELS: Record<ModelRegistryEvent['action'], string> = {
  ACTIVATE: 'Activación',
  DEACTIVATE: 'Desactivación',
  PROMOTE: 'Promoción PRED-004',
  ROLLBACK: 'Reversión',
};

function actionVariant(action: ModelRegistryEvent['action']): React.ComponentProps<typeof Badge>['variant'] {
  if (action === 'DEACTIVATE') return 'destructive';
  if (action === 'ROLLBACK') return 'outline';
  return 'secondary';
}

export function AdminModelRegistryPage() {
  const [snapshot, setSnapshot] = React.useState<ModelRegistrySnapshot | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [deactivating, setDeactivating] = React.useState<string | null>(null);
  const [rollingBack, setRollingBack] = React.useState<string | null>(null);

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

  const models = snapshot?.models ?? [];
  const findModel = (modelId: string | undefined, version: string | undefined): ModelSummary | null =>
    models.find((m) => m.model_id === modelId && m.version === version) ?? null;
  const scopes = Array.from(
    new Set([...KNOWN_SCOPES, ...Object.keys(snapshot?.active_by_scope ?? {})]),
  ).filter((key) => snapshot?.active_by_scope[key] || models.some((m) => m.scope_key === key));
  const events = [...(snapshot?.events ?? [])].reverse();
  const deactivatingModel = deactivating
    ? findModel(snapshot?.active_by_scope[deactivating]?.model_id, snapshot?.active_by_scope[deactivating]?.version)
    : null;

  return (
    <section className="mx-auto w-full max-w-7xl space-y-7 p-5 sm:p-7" aria-labelledby="model-registry-title">
      <header className="flex flex-wrap items-end justify-between gap-5 border-b border-border pb-6">
        <div>
          <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            <ServerCog aria-hidden="true" className="size-4" /> DSS · modelos en servicio
          </p>
          <h1 id="model-registry-title" className="text-3xl font-semibold tracking-tight">
            Modelos activos
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
            Cada tipo de modelo responde las predicciones con un único modelo activo. Desde aquí puedes
            volver a la versión anterior, desactivarlo y revisar quién activó o desactivó cada modelo, y por qué.
            Los candidatos nuevos se entrenan y activan desde ML Studio.
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

      <div className="grid gap-5 lg:grid-cols-2">
        {scopes.map((key) => {
          const pointer = snapshot?.active_by_scope[key];
          const model = pointer ? findModel(pointer.model_id, pointer.version) : null;
          return (
            <section key={key} className="rounded-xl border border-border bg-card p-5 sm:p-6" aria-label={scopeLabel(key)}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-semibold">{scopeLabel(key)}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {pointer ? `Activo desde ${dateTime(pointer.activated_at)}` : 'Sin modelo activo: no se generan predicciones.'}
                  </p>
                </div>
                {pointer ? (
                  <Badge variant="secondary">En servicio</Badge>
                ) : (
                  <Badge variant="outline">Inactivo</Badge>
                )}
              </div>
              {pointer && (
                <>
                  <p className="mt-4 font-medium">{model ? modelLabel(model) : pointer.version}</p>
                  {model && (
                    <dl className="mt-3 grid grid-cols-3 gap-3 text-sm">
                      {headlineMetrics(model).map((metric) => (
                        <div key={metric.label}>
                          <dt className="text-xs text-muted-foreground">{metric.label}</dt>
                          <dd className="text-lg font-semibold tabular-nums">{metric.value}</dd>
                        </div>
                      ))}
                    </dl>
                  )}
                  <p className="mt-3 break-all text-xs text-muted-foreground">
                    Activado por <span className="font-mono">{pointer.approved_by}</span>
                    {pointer.activation_kind === 'ADMIN_ACTIVATION' ? ' desde el portal admin' : ' con evaluación PRED-004'}
                  </p>
                </>
              )}
              <div className="mt-5 flex flex-wrap gap-3">
                <Button asChild variant="outline">
                  <Link href="/ml-models">{pointer ? 'Comparar y cambiar' : 'Elegir un modelo'}</Link>
                </Button>
                {pointer && (
                  <Button variant="outline" onClick={() => setRollingBack(key)}>
                    <RotateCcw aria-hidden="true" className="mr-2 size-4" /> Rollback
                  </Button>
                )}
                {pointer && (
                  <Button variant="destructive" onClick={() => setDeactivating(key)}>
                    <Power aria-hidden="true" className="mr-2 size-4" /> Desactivar
                  </Button>
                )}
              </div>
            </section>
          );
        })}
        {!loading && scopes.length === 0 && (
          <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground lg:col-span-2">
            Todavía no hay modelos entrenados.
          </p>
        )}
      </div>

      <section className="overflow-hidden rounded-xl border border-border bg-card" aria-labelledby="registry-history-title">
        <div className="flex items-center gap-3 border-b border-border p-5">
          <History aria-hidden="true" className="size-5 text-primary" />
          <div>
            <h2 id="registry-history-title" className="font-semibold">Historial</h2>
            <p className="mt-1 text-sm text-muted-foreground">Cada cambio de modelo activo, del más reciente al más antiguo.</p>
          </div>
        </div>
        {events.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">Sin cambios registrados.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[52rem] text-left text-sm">
              <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Fecha</th>
                  <th className="px-4 py-3">Acción</th>
                  <th className="px-4 py-3">Tipo de modelo</th>
                  <th className="px-4 py-3">Modelo</th>
                  <th className="px-4 py-3">Operador</th>
                  <th className="px-4 py-3">Motivo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {events.map((event, index) => {
                  const pointer = event.active ?? event.previous;
                  const model = findModel(pointer?.model_id, pointer?.version);
                  return (
                    <tr key={`${event.action}-${event.at ?? pointer?.activated_at ?? index}-${index}`}>
                      <td className="whitespace-nowrap px-4 py-3">{dateTime(event.at ?? event.active?.activated_at)}</td>
                      <td className="px-4 py-3"><Badge variant={actionVariant(event.action)}>{ACTION_LABELS[event.action] ?? event.action}</Badge></td>
                      <td className="px-4 py-3">{scopeLabel(event.scope_key)}</td>
                      <td className="px-4 py-3">{model ? modelLabel(model) : pointer?.version ?? '—'}</td>
                      <td className="max-w-40 truncate px-4 py-3 font-mono text-xs" title={event.approved_by ?? pointer?.approved_by}>
                        {event.approved_by ?? pointer?.approved_by ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{event.reason ?? '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <RollbackModelDialog
        scopeKey={rollingBack}
        open={rollingBack !== null}
        onOpenChange={(open) => !open && setRollingBack(null)}
        onDone={() => void load()}
      />
      <DeactivateModelDialog
        scopeKey={deactivating}
        model={deactivatingModel}
        open={deactivating !== null}
        onOpenChange={(open) => !open && setDeactivating(null)}
        onDone={() => void load()}
      />
    </section>
  );
}
