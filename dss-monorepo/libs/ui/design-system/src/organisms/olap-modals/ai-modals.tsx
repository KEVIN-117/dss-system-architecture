'use client';

import * as React from 'react';
import { Button } from '../../atoms/button';
import { Checkbox } from '../../atoms/checkbox';
import { Input } from '../../atoms/input';
import { Textarea } from '../../atoms/textarea';
import { OlapModal } from './olap-modal';
import { OlapModalActions, OlapModalField } from './modal-parts';

export interface EmailMeThisPayload {
  subject: string;
  summary: string;
  attachChart: boolean;
  attachPdf: boolean;
}

export interface EmailMeThisModalProps {
  open: boolean;
  defaultSubject: string;
  defaultSummary?: string;
  recipient?: string | null;
  canGenerateSummary?: boolean;
  generating?: boolean;
  sending?: boolean;
  onGenerateSummary?: () => void;
  onSend: (payload: EmailMeThisPayload) => void;
  onClose: () => void;
}

export function EmailMeThisModal({
  open,
  defaultSubject,
  defaultSummary = '',
  recipient,
  canGenerateSummary = false,
  generating = false,
  sending = false,
  onGenerateSummary,
  onSend,
  onClose,
}: EmailMeThisModalProps) {
  const [subject, setSubject] = React.useState(defaultSubject);
  const [summary, setSummary] = React.useState(defaultSummary);
  const [attachChart, setAttachChart] = React.useState(true);
  const [attachPdf, setAttachPdf] = React.useState(true);
  React.useEffect(() => {
    if (open) {
      setSubject(defaultSubject);
      setSummary(defaultSummary);
      setAttachChart(true);
      setAttachPdf(true);
    }
  }, [open, defaultSubject, defaultSummary]);
  const ready = !!recipient && !!subject.trim() && !sending;

  return (
    <OlapModal
      open={open}
      onOpenChange={(nextOpen) => { if (!nextOpen) onClose(); }}
      title="Enviarme este análisis"
      size="lg"
      footer={<OlapModalActions onCancel={onClose} onApply={() => onSend({ subject: subject.trim(), summary: summary.trim(), attachChart, attachPdf })} applyLabel="Enviar" disabled={!ready} busy={sending} />}
    >
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          {recipient ? <>Se enviará a <strong className="font-medium text-foreground">{recipient}</strong>.</> : 'No hay una dirección de envío configurada.'}
        </p>
        <OlapModalField id="email-subject" label="Asunto">
          <Input id="email-subject" value={subject} onChange={(event) => setSubject(event.target.value)} />
        </OlapModalField>
        <OlapModalField id="email-summary" label="Resumen">
          <Textarea id="email-summary" value={summary} onChange={(event) => setSummary(event.target.value)} rows={6} />
        </OlapModalField>
        <div className="flex flex-wrap items-center gap-4">
          <Checkbox checked={attachChart} onCheckedChange={(checked) => setAttachChart(checked === true)} label="Adjuntar gráfico" />
          <Checkbox checked={attachPdf} onCheckedChange={(checked) => setAttachPdf(checked === true)} label="Adjuntar informe PDF" />
          {onGenerateSummary ? <Button variant="outline" size="sm" onClick={onGenerateSummary} disabled={!canGenerateSummary || generating}>{generating ? 'Generando…' : 'Generar resumen'}</Button> : null}
        </div>
      </div>
    </OlapModal>
  );
}

export interface OssieAiMessage {
  role: 'user' | 'assistant';
  content: string;
  query?: unknown;
}

export interface OssieAskAiModalProps {
  open: boolean;
  connection: string;
  modelName: string;
  messages: OssieAiMessage[];
  running?: boolean;
  error?: string | null;
  onAsk: (question: string) => void;
  onApplyQuery?: (query: unknown) => void;
  onClose: () => void;
}

export function OssieAskAiModal({
  open,
  connection,
  modelName,
  messages,
  running = false,
  error,
  onAsk,
  onApplyQuery,
  onClose,
}: OssieAskAiModalProps) {
  const [question, setQuestion] = React.useState('');
  React.useEffect(() => { if (open) setQuestion(''); }, [open]);
  function ask() {
    const value = question.trim();
    if (!value || running) return;
    onAsk(value);
    setQuestion('');
  }
  const lastQuery = [...messages].reverse().find((message) => message.role === 'assistant' && message.query !== undefined)?.query;

  return (
    <OlapModal open={open} onOpenChange={(nextOpen) => { if (!nextOpen) onClose(); }} title="Preguntar a Ossie AI" size="xl" footer={<><Button variant="outline" onClick={onClose}>Cerrar</Button>{lastQuery !== undefined && onApplyQuery ? <Button onClick={() => onApplyQuery(lastQuery)}>Aplicar consulta</Button> : null}</>}>
      <div className="grid min-h-[26rem] gap-4 lg:grid-cols-[minmax(16rem,0.8fr)_minmax(0,1.2fr)]">
        <section className="flex min-h-0 flex-col gap-3">
          <div className="rounded-md border border-border bg-muted/50 p-3 text-xs text-muted-foreground">
            Conexión: <span className="font-medium text-foreground">{connection}</span><br />
            Modelo: <span className="font-medium text-foreground">{modelName}</span>
          </div>
          <div className="max-h-72 flex-1 space-y-3 overflow-y-auto rounded-md border border-border p-3" aria-live="polite">
            {messages.length ? messages.map((message, index) => (
              <div key={`${message.role}-${index}`} className={`rounded-md p-3 text-sm ${message.role === 'user' ? 'ml-6 bg-primary/10' : 'mr-6 bg-muted'}`}>
                <p className="mb-1 text-xs font-medium text-muted-foreground">{message.role === 'user' ? 'Tú' : 'Ossie'}</p>
                <p className="whitespace-pre-wrap">{message.content}</p>
              </div>
            )) : <p className="text-sm text-muted-foreground">Escribe una pregunta sobre este modelo.</p>}
            {running ? <p className="text-sm text-muted-foreground" role="status">Preparando respuesta…</p> : null}
            {error ? <p className="text-sm text-destructive" role="alert">{error}</p> : null}
          </div>
          <div className="space-y-2">
            <Textarea value={question} onChange={(event) => setQuestion(event.target.value)} rows={3} placeholder="¿Qué quieres consultar?" aria-label="Pregunta para Ossie AI" onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); ask(); } }} />
            <Button className="w-full" onClick={ask} disabled={!question.trim() || running}>Enviar pregunta</Button>
          </div>
        </section>
        <section className="min-h-48 rounded-md border border-border bg-muted/30 p-4" aria-label="Vista previa de la consulta">
          <h3 className="mb-2 text-sm font-medium">Vista previa de consulta</h3>
          {lastQuery !== undefined ? <pre className="max-h-96 overflow-auto whitespace-pre-wrap break-words text-xs text-muted-foreground">{typeof lastQuery === 'string' ? lastQuery : JSON.stringify(lastQuery, null, 2)}</pre> : <p className="text-sm text-muted-foreground">La consulta generada aparecerá aquí cuando esté disponible.</p>}
        </section>
      </div>
    </OlapModal>
  );
}
