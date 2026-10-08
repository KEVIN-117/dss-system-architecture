import * as React from 'react';
import { Button } from '../../atoms/button';
import { Label } from '../../atoms/label';
import { MonacoExpressionEditor } from './monaco-expression-editor';

export interface OlapModalActionsProps {
  onCancel: () => void;
  onApply: () => void;
  cancelLabel?: string;
  applyLabel?: string;
  disabled?: boolean;
  busy?: boolean;
}

export type OlapModalMode = 'simple' | 'mdx';

export interface OlapModalModeSwitchProps {
  mode: OlapModalMode;
  onChange: (mode: OlapModalMode) => void;
  simpleLabel?: React.ReactNode;
  mdxLabel?: React.ReactNode;
  ariaLabel?: string;
}

/** Shared accessible mode selector for OLAP modals with structured and MDX editing. */
export function OlapModalModeSwitch({
  mode,
  onChange,
  simpleLabel = 'Simple',
  mdxLabel = 'MDX',
  ariaLabel = 'Modo de edición',
}: OlapModalModeSwitchProps) {
  return (
    <div className="mb-4 flex gap-2" role="group" aria-label={ariaLabel}>
      <Button
        type="button"
        size="sm"
        variant={mode === 'simple' ? 'secondary' : 'outline'}
        aria-pressed={mode === 'simple'}
        onClick={() => onChange('simple')}
      >
        {simpleLabel}
      </Button>
      <Button
        type="button"
        size="sm"
        variant={mode === 'mdx' ? 'secondary' : 'outline'}
        aria-pressed={mode === 'mdx'}
        onClick={() => onChange('mdx')}
      >
        {mdxLabel}
      </Button>
    </div>
  );
}

export function OlapModalActions({
  onCancel,
  onApply,
  cancelLabel = 'Cancelar',
  applyLabel = 'Aplicar',
  disabled = false,
  busy = false,
}: OlapModalActionsProps) {
  return (
    <>
      <Button variant="outline" onClick={onCancel} disabled={busy}>
        {cancelLabel}
      </Button>
      <Button onClick={onApply} disabled={disabled || busy}>
        {busy ? 'Procesando…' : applyLabel}
      </Button>
    </>
  );
}

export interface OlapModalFieldProps {
  id: string;
  label: React.ReactNode;
  description?: React.ReactNode;
  error?: React.ReactNode;
  children: React.ReactNode;
}

export function OlapModalField({
  id,
  label,
  description,
  error,
  children,
}: OlapModalFieldProps) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id} id={`${id}-label`}>
        {label}
      </Label>
      {children}
      {description ? (
        <p className="text-sm text-muted-foreground">{description}</p>
      ) : null}
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export interface OlapExpressionEditorProps {
  id: string;
  label: React.ReactNode;
  value: string;
  onChange: (value: string) => void;
  minRows?: number;
  description?: React.ReactNode;
}

export function OlapExpressionEditor({
  id,
  label,
  value,
  onChange,
  minRows = 8,
  description,
}: OlapExpressionEditorProps) {
  return (
    <OlapModalField id={id} label={label} description={description}>
      <MonacoExpressionEditor
        id={id}
        value={value}
        onChange={onChange}
        minRows={minRows}
      />
    </OlapModalField>
  );
}
