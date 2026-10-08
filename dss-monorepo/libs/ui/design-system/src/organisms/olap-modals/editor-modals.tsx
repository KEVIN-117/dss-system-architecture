'use client';

import * as React from 'react';
import { Button } from '../../atoms/button';
import { Checkbox } from '../../atoms/checkbox';
import { Input } from '../../atoms/input';
import { Select } from '../../atoms/select';
import { Textarea } from '../../atoms/textarea';
import { OlapModal } from './olap-modal';
import { OlapModalActions, OlapModalField } from './modal-parts';

type ChartValue = string | number | boolean;
export type ChartEditorField =
  | { name: string; label: string; type: 'text'; description?: string }
  | { name: string; label: string; type: 'number'; min?: number; max?: number; step?: number; description?: string }
  | { name: string; label: string; type: 'select'; options: Array<{ value: string; label: string }>; description?: string }
  | { name: string; label: string; type: 'checkbox'; description?: string };

export interface ChartEditorModalProps {
  open: boolean;
  title?: React.ReactNode;
  fields: ChartEditorField[];
  initialValues: Record<string, ChartValue>;
  onSave: (values: Record<string, ChartValue>) => void;
  onCancel: () => void;
  children?: React.ReactNode;
}

/** Schema-driven chart editor shell; chart-specific options stay with the chart owner. */
export function ChartEditorModal({
  open,
  title = 'Editor de gráficos',
  fields,
  initialValues,
  onSave,
  onCancel,
  children,
}: ChartEditorModalProps) {
  const [values, setValues] = React.useState(initialValues);
  React.useEffect(() => { if (open) setValues(initialValues); }, [open, initialValues]);
  const setValue = (name: string, value: ChartValue) => setValues((current) => ({ ...current, [name]: value }));

  return (
    <OlapModal
      open={open}
      onOpenChange={(nextOpen) => { if (!nextOpen) onCancel(); }}
      title={title}
      size="xl"
      footer={<OlapModalActions onCancel={onCancel} onApply={() => onSave(values)} applyLabel="Aplicar cambios" />}
    >
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="space-y-4">
          {fields.map((field) => {
            const id = `chart-${field.name}`;
            if (field.type === 'checkbox') {
              return (
                <Checkbox
                  key={field.name}
                  checked={values[field.name] === true}
                  onCheckedChange={(checked: boolean | 'indeterminate') => setValue(field.name, checked === true)}
                  label={field.label}
                  description={field.description}
                />
              );
            }
            return (
              <OlapModalField key={field.name} id={id} label={field.label} description={field.description}>
                {field.type === 'select' ? (
                  <Select id={id} value={String(values[field.name] ?? '')} onChange={(event) => setValue(field.name, event.target.value)}>
                    {field.options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </Select>
                ) : (
                  <Input
                    id={id}
                    type={field.type}
                    min={field.type === 'number' ? field.min : undefined}
                    max={field.type === 'number' ? field.max : undefined}
                    step={field.type === 'number' ? field.step : undefined}
                    value={String(values[field.name] ?? '')}
                    onChange={(event) => setValue(field.name, field.type === 'number' ? Number(event.target.value) : event.target.value)}
                  />
                )}
              </OlapModalField>
            );
          })}
        </div>
        {children ? <div className="min-w-0 rounded-md border border-border bg-muted/40 p-4">{children}</div> : null}
      </div>
    </OlapModal>
  );
}

export interface CalculatedMember {
  name: string;
  parent: string;
  formula: string;
  formatString: string;
  dimension?: string;
}

export interface CalculatedMemberModalProps {
  open: boolean;
  initial?: CalculatedMember;
  hierarchies: string[];
  measures?: Array<{ caption: string; uniqueName: string }>;
  title?: React.ReactNode;
  onSave: (member: CalculatedMember) => void;
  onCancel: () => void;
}

const defaultMember: CalculatedMember = { name: '', parent: '[Measures]', formula: '', formatString: '#,##0.00' };
const formatOptions = [
  { label: 'Entero', value: '#,##0' },
  { label: 'Decimal (2)', value: '#,##0.00' },
  { label: 'Decimal (4)', value: '#,##0.0000' },
  { label: 'Porcentaje', value: '0.00%' },
  { label: 'Moneda (USD)', value: '$#,##0.00' },
  { label: 'Moneda (EUR)', value: '€#,##0.00' },
  { label: 'Científico', value: '0.00E+00' },
  { label: 'Estándar', value: 'Standard' },
];
const formulaSnippets = ['IIF(<condición>, <verdadero>, <falso>)', 'SUM(<conjunto>)', 'AVG(<conjunto>)', 'COUNT(<conjunto>)', 'PARALLELPERIOD(<nivel>, 1, <miembro>)'];

export function CalculatedMemberModal({
  open,
  initial = defaultMember,
  hierarchies,
  measures = [],
  title = 'Miembro calculado',
  onSave,
  onCancel,
}: CalculatedMemberModalProps) {
  const [member, setMember] = React.useState<CalculatedMember>({ ...initial });
  React.useEffect(() => { if (open) setMember({ ...initial }); }, [open, initial]);
  const update = (key: keyof CalculatedMember, value: string) => setMember((current) => ({ ...current, [key]: value }));
  const valid = !!member.name.trim() && !!member.formula.trim();

  return (
    <OlapModal open={open} onOpenChange={(nextOpen) => { if (!nextOpen) onCancel(); }} title={title} size="lg" footer={<OlapModalActions onCancel={onCancel} onApply={() => onSave({ ...member, name: member.name.trim() })} applyLabel="Guardar miembro" disabled={!valid} />}>
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <OlapModalField id="calc-member-name" label="Nombre"><Input id="calc-member-name" value={member.name} onChange={(event) => update('name', event.target.value)} /></OlapModalField>
          <OlapModalField id="calc-member-parent" label="Jerarquía">
            <Select id="calc-member-parent" value={member.parent} onChange={(event) => update('parent', event.target.value)}>
              {hierarchies.map((hierarchy) => <option key={hierarchy} value={hierarchy}>{hierarchy}</option>)}
            </Select>
          </OlapModalField>
          {measures.length ? (
            <OlapModalField id="calc-member-measure" label="Insertar medida">
              <Select id="calc-member-measure" value="" onChange={(event) => update('formula', `${member.formula}${event.target.value}`)}>
                <option value="">Selecciona una medida</option>
                {measures.map((measure) => <option key={measure.uniqueName} value={measure.uniqueName}>{measure.caption}</option>)}
              </Select>
            </OlapModalField>
          ) : null}
          <OlapModalField id="calc-member-format" label="Formato numérico">
            <Select id="calc-member-format" value={member.formatString} onChange={(event) => update('formatString', event.target.value)}>
              {formatOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </Select>
          </OlapModalField>
        </div>
        <OlapModalField id="calc-member-formula" label="Fórmula MDX">
          <Textarea id="calc-member-formula" value={member.formula} onChange={(event) => update('formula', event.target.value)} rows={9} className="font-mono text-sm" spellCheck={false} />
        </OlapModalField>
        <div className="flex flex-wrap gap-2" aria-label="Plantillas de fórmula">
          {formulaSnippets.map((snippet) => <Button key={snippet} type="button" size="sm" variant="outline" onClick={() => update('formula', `${member.formula}${snippet}`)}>{snippet.split('(')[0]}</Button>)}
        </div>
      </div>
    </OlapModal>
  );
}
