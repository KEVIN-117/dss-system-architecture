'use client';

import * as React from 'react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@dss-monorepo/design-system';

import {
  activateModel,
  deactivateModel,
  type ModelCadence,
  type ModelEventCode,
  type ModelSummary,
} from '../../data-access/ml-operations';
import { modelLabel, percent } from './model-charts';

export function scopeLabel(scopeKey: string | null | undefined): string {
  if (!scopeKey) return 'Sin alcance declarado';
  const [event, cadence] = scopeKey.split('|');
  const eventName =
    event === 'PROGRAM_DROPOUT_NEXT_EXPECTED_CLOSURE'
      ? 'Deserción de carrera'
      : event === 'COURSE_ABANDONMENT'
        ? 'Abandono de materia'
        : event;
  const cadenceName = cadence === 'SEMESTRAL' ? 'Semestral' : cadence === 'ANUAL' ? 'Anual' : cadence;
  return `${eventName} · ${cadenceName}`;
}

export function splitScope(scopeKey: string): { event_code: ModelEventCode; cadence: ModelCadence } | null {
  const [event, cadence] = scopeKey.split('|');
  if ((event === 'PROGRAM_DROPOUT_NEXT_EXPECTED_CLOSURE' || event === 'COURSE_ABANDONMENT') &&
      (cadence === 'SEMESTRAL' || cadence === 'ANUAL')) {
    return { event_code: event, cadence };
  }
  return null;
}

function ReasonField({ value, onChange, id }: { value: string; onChange: (value: string) => void; id: string }) {
  return (
    <label htmlFor={id} className="block space-y-2 text-sm font-medium">
      Motivo <span className="font-normal text-muted-foreground">(queda en el historial)</span>
      <textarea
        id={id}
        required
        minLength={3}
        maxLength={500}
        rows={3}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        placeholder="Por ejemplo: mejor recall en validación y prueba con la política del 20 %"
      />
    </label>
  );
}

export function ActivateModelDialog({
  model,
  currentActive,
  open,
  onOpenChange,
  onDone,
}: {
  model: ModelSummary | null;
  currentActive: ModelSummary | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
}) {
  const [reason, setReason] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  React.useEffect(() => {
    if (open) {
      setReason('');
      setError(null);
    }
  }, [open]);
  if (!model) return null;

  async function submit() {
    if (!model || reason.trim().length < 3 || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await activateModel({ model_id: model.model_id, version: model.version, reason: reason.trim() });
      onOpenChange(false);
      onDone();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo activar el modelo.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Activar modelo</DialogTitle>
          <DialogDescription>
            {modelLabel(model)} pasará a responder las predicciones de {scopeLabel(model.scope_key)}.
          </DialogDescription>
        </DialogHeader>
        <dl className="grid grid-cols-3 gap-3 rounded-lg border border-border bg-muted/30 p-3 text-sm">
          <div><dt className="text-xs text-muted-foreground">Recall</dt><dd className="font-semibold">{percent(model.test_metrics.recall)}</dd></div>
          <div><dt className="text-xs text-muted-foreground">F1-Score</dt><dd className="font-semibold">{percent(model.test_metrics.f1_score)}</dd></div>
          <div><dt className="text-xs text-muted-foreground">Precisión</dt><dd className="font-semibold">{percent(model.test_metrics.precision)}</dd></div>
        </dl>
        {currentActive && currentActive.model_id !== model.model_id && (
          <p className="text-sm text-muted-foreground">
            Reemplaza al modelo activo actual ({modelLabel(currentActive)}, recall {percent(currentActive.test_metrics.recall)}).
            Para volver atrás, actívalo de nuevo desde esta pantalla.
          </p>
        )}
        <ReasonField id="activate-reason" value={reason} onChange={setReason} />
        {error && (
          <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </p>
        )}
        <DialogFooter>
          <Button type="button" variant="outline" disabled={submitting} onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="button" disabled={submitting || reason.trim().length < 3} onClick={() => void submit()}>
            {submitting ? 'Activando…' : 'Activar modelo'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function DeactivateModelDialog({
  scopeKey,
  model,
  open,
  onOpenChange,
  onDone,
}: {
  scopeKey: string | null;
  model: ModelSummary | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
}) {
  const [reason, setReason] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  React.useEffect(() => {
    if (open) {
      setReason('');
      setError(null);
    }
  }, [open]);
  const scope = scopeKey ? splitScope(scopeKey) : null;
  if (!scope) return null;

  async function submit() {
    if (!scope || reason.trim().length < 3 || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await deactivateModel({ ...scope, reason: reason.trim() });
      onOpenChange(false);
      onDone();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo desactivar el modelo.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Desactivar modelo</DialogTitle>
          <DialogDescription>
            {scopeLabel(scopeKey)} quedará sin modelo activo
            {model ? ` (hoy: ${modelLabel(model)})` : ''}. Los portales mostrarán que no hay predicciones
            disponibles hasta que se active otro candidato.
          </DialogDescription>
        </DialogHeader>
        <ReasonField id="deactivate-reason" value={reason} onChange={setReason} />
        {error && (
          <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </p>
        )}
        <DialogFooter>
          <Button type="button" variant="outline" disabled={submitting} onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="button" variant="destructive" disabled={submitting || reason.trim().length < 3} onClick={() => void submit()}>
            {submitting ? 'Desactivando…' : 'Desactivar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
