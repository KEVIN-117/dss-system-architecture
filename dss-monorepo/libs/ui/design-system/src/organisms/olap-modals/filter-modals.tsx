'use client';

import * as React from 'react';
import { Button } from '../../atoms/button';
import { Input } from '../../atoms/input';
import { Radio } from '../../atoms/radio';
import { Select } from '../../atoms/select';
import { OlapModal } from './olap-modal';
import { OlapExpressionEditor, OlapModalActions, OlapModalField, OlapModalModeSwitch, type OlapModalMode } from './modal-parts';

interface BaseProps {
  open: boolean;
  onCancel: () => void;
  title?: React.ReactNode;
}

const closeOnRequest = (onCancel: () => void) => (open: boolean) => {
  if (!open) onCancel();
};

export interface MDXModalProps extends BaseProps {
  mdx: string;
  onRun: (mdx: string) => void;
  onCopied?: () => void;
}

export function MDXModal({ mdx, open, onRun, onCancel, onCopied, title = 'Consulta MDX' }: MDXModalProps) {
  const [buffer, setBuffer] = React.useState(mdx);
  React.useEffect(() => { if (open) setBuffer(mdx); }, [open, mdx]);

  async function copy() {
    await navigator.clipboard?.writeText(buffer);
    onCopied?.();
  }

  return (
    <OlapModal
      open={open}
      onOpenChange={closeOnRequest(onCancel)}
      title={title}
      size="xl"
      footer={
        <>
          <Button variant="outline" onClick={() => void copy()}>Copiar</Button>
          <OlapModalActions onCancel={onCancel} onApply={() => onRun(buffer)} applyLabel="Ejecutar" />
        </>
      }
    >
      <OlapExpressionEditor
        id="mdx-query"
        label="MDX"
        value={buffer}
        onChange={setBuffer}
        minRows={14}
      />
    </OlapModal>
  );
}

export interface FilterModalProps extends BaseProps {
  axis: string;
  expression: string;
  onSave: (expression: string) => void;
  expressionLabel?: string;
}

export function FilterModal({
  axis,
  expression,
  open,
  onSave,
  onCancel,
  title = `Filtro MDX — ${axis}`,
  expressionLabel = 'Expresión del filtro',
}: FilterModalProps) {
  const [buffer, setBuffer] = React.useState(expression);
  React.useEffect(() => { if (open) setBuffer(expression); }, [open, expression]);
  return (
    <OlapModal
      open={open}
      onOpenChange={closeOnRequest(onCancel)}
      title={title}
      size="lg"
      footer={<OlapModalActions onCancel={onCancel} onApply={() => onSave(buffer.trim())} disabled={!buffer.trim()} />}
    >
      <OlapExpressionEditor
        id="axis-filter-expression"
        label={`${axis}: ${expressionLabel}`}
        value={buffer}
        onChange={setBuffer}
        minRows={10}
      />
    </OlapModal>
  );
}

export type FilterOperator = '>' | '>=' | '<' | '<=' | '=' | '!=' | 'BETWEEN' | 'NOT BETWEEN';
const operators: FilterOperator[] = ['>', '>=', '<', '<=', '=', '!=', 'BETWEEN', 'NOT BETWEEN'];

export interface CustomFilterModalProps extends BaseProps {
  measureCaption: string;
  onApply: (operator: FilterOperator, value: string, value2?: string) => void;
}

export function CustomFilterModal({ measureCaption, open, onApply, onCancel }: CustomFilterModalProps) {
  const [operator, setOperator] = React.useState<FilterOperator>('>');
  const [value, setValue] = React.useState('');
  const [value2, setValue2] = React.useState('');
  React.useEffect(() => {
    if (open) { setOperator('>'); setValue(''); setValue2(''); }
  }, [open]);
  const needsSecond = operator === 'BETWEEN' || operator === 'NOT BETWEEN';

  return (
    <OlapModal
      open={open}
      onOpenChange={closeOnRequest(onCancel)}
      title={`Filtro de medida — ${measureCaption}`}
      size="md"
      footer={
        <OlapModalActions
          onCancel={onCancel}
          onApply={() => onApply(operator, value, needsSecond ? value2 : undefined)}
          disabled={!value.trim() || (needsSecond && !value2.trim())}
        />
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <OlapModalField id="filter-operator" label="Operador">
          <Select id="filter-operator" value={operator} onChange={(event) => setOperator(event.target.value as FilterOperator)}>
            {operators.map((item) => <option key={item} value={item}>{item}</option>)}
          </Select>
        </OlapModalField>
        <OlapModalField id="filter-value" label="Valor">
          <Input id="filter-value" type="number" value={value} onChange={(event) => setValue(event.target.value)} />
        </OlapModalField>
        {needsSecond ? (
          <OlapModalField id="filter-value-end" label="Y">
            <Input id="filter-value-end" type="number" value={value2} onChange={(event) => setValue2(event.target.value)} />
          </OlapModalField>
        ) : null}
      </div>
    </OlapModal>
  );
}

export type SortFunction = 'ASC' | 'BASC' | 'DESC' | 'BDESC';
export interface OlapMeasureOption {
  uniqueName: string;
  name: string;
  caption?: string;
}
type Mode = OlapModalMode;

export interface OrderModalProps extends BaseProps {
  axis: string;
  measures: OlapMeasureOption[];
  initialMeasure: string;
  initialSort: SortFunction;
  onSave: (expression: string, sort: SortFunction) => void;
}

export function OrderModal({ axis, measures, initialMeasure, initialSort, open, onSave, onCancel }: OrderModalProps) {
  const seedMeasure = initialMeasure || measures[0]?.uniqueName || '';
  const [mode, setMode] = React.useState<Mode>('simple');
  const [selected, setSelected] = React.useState(seedMeasure);
  const [sort, setSort] = React.useState<SortFunction>(initialSort);
  const [mdx, setMdx] = React.useState(seedMeasure);
  React.useEffect(() => {
    if (open) { setMode('simple'); setSelected(seedMeasure); setSort(initialSort); setMdx(seedMeasure); }
  }, [open, seedMeasure, initialSort]);
  const valid = mode === 'simple' ? !!selected : !!mdx.trim();
  function changeMode(next: Mode) {
    if (next === 'mdx' && selected) setMdx(selected);
    setMode(next);
  }
  function commit() { onSave(mode === 'simple' ? selected : mdx.trim(), sort); }

  return (
    <OlapModal open={open} onOpenChange={closeOnRequest(onCancel)} title={`Ordenar ${axis}`} size={mode === 'mdx' ? 'lg' : 'md'} footer={<OlapModalActions onCancel={onCancel} onApply={commit} disabled={!valid} />}>
      <OlapModalModeSwitch mode={mode} onChange={changeMode} />
      <div className="space-y-4">
        <OlapModalField id="order-sort" label="Dirección">
          <Select id="order-sort" value={sort} onChange={(event) => setSort(event.target.value as SortFunction)}>
            {(['ASC', 'BASC', 'DESC', 'BDESC'] as const).map((value) => <option key={value}>{value}</option>)}
          </Select>
        </OlapModalField>
        {mode === 'simple' ? (
          <OlapModalField id="order-measure" label="Ordenar por medida">
            <Select id="order-measure" value={selected} onChange={(event) => setSelected(event.target.value)}>
              {measures.map((measure) => <option key={measure.uniqueName} value={measure.uniqueName}>{measure.caption || measure.name}</option>)}
            </Select>
          </OlapModalField>
        ) : (
          <OlapExpressionEditor id="order-expression" label="Expresión MDX" value={mdx} onChange={setMdx} minRows={9} />
        )}
      </div>
    </OlapModal>
  );
}

export interface LimitModalProps extends BaseProps {
  axis: string;
  initialCount: number;
  onSave: (expression: string) => void;
}

export function LimitModal({ axis, initialCount, open, onSave, onCancel }: LimitModalProps) {
  const initial = initialCount || 10;
  const [mode, setMode] = React.useState<Mode>('simple');
  const [count, setCount] = React.useState(initial);
  const [mdx, setMdx] = React.useState(String(initial));
  React.useEffect(() => { if (open) { setMode('simple'); setCount(initial); setMdx(String(initial)); } }, [open, initial]);
  const valid = mode === 'simple' ? Number.isFinite(count) && count >= 1 : !!mdx.trim();
  function changeMode(next: Mode) { if (next === 'mdx') setMdx(String(Math.floor(count))); setMode(next); }
  function commit() { onSave(mode === 'simple' ? String(Math.floor(count)) : mdx.trim()); }

  return (
    <OlapModal open={open} onOpenChange={closeOnRequest(onCancel)} title={`Limitar eje ${axis}`} size={mode === 'mdx' ? 'lg' : 'sm'} footer={<OlapModalActions onCancel={onCancel} onApply={commit} disabled={!valid} />}>
      <OlapModalModeSwitch mode={mode} onChange={changeMode} />
      {mode === 'simple' ? (
        <OlapModalField id="limit-count" label="Cantidad de miembros">
          <Input id="limit-count" type="number" min={1} step={1} value={count} onChange={(event) => setCount(Number(event.target.value))} />
        </OlapModalField>
      ) : (
        <OlapExpressionEditor id="limit-expression" label="Expresión MDX" value={mdx} onChange={setMdx} minRows={8} />
      )}
    </OlapModal>
  );
}

export type TopBottomVariant = 'top' | 'bottom';
export interface TopBottomCountModalProps extends BaseProps {
  axis: string;
  variant: TopBottomVariant;
  measures: OlapMeasureOption[];
  initialCount: number;
  initialMeasure: string;
  onSave: (expression: string) => void;
}

export function TopBottomCountModal({ axis, variant, measures, initialCount, initialMeasure, open, onSave, onCancel }: TopBottomCountModalProps) {
  const initial = initialCount || 10;
  const seedMeasure = initialMeasure || measures[0]?.uniqueName || '';
  const [mode, setMode] = React.useState<Mode>('simple');
  const [count, setCount] = React.useState(initial);
  const [selected, setSelected] = React.useState(seedMeasure);
  const [mdx, setMdx] = React.useState(`${initial}, ${seedMeasure}`);
  React.useEffect(() => {
    if (open) { setMode('simple'); setCount(initial); setSelected(seedMeasure); setMdx(`${initial}, ${seedMeasure}`); }
  }, [open, initial, seedMeasure]);
  const valid = mode === 'simple' ? !!selected && count >= 1 : !!mdx.trim();
  function changeMode(next: Mode) { if (next === 'mdx') setMdx(`${Math.floor(count)}, ${selected}`); setMode(next); }
  function commit() { onSave(mode === 'simple' ? `${Math.floor(count)}, ${selected}` : mdx.trim()); }
  const title = variant === 'top' ? 'Top N' : 'Bottom N';

  return (
    <OlapModal open={open} onOpenChange={closeOnRequest(onCancel)} title={`${title} — ${axis}`} size={mode === 'mdx' ? 'lg' : 'md'} footer={<OlapModalActions onCancel={onCancel} onApply={commit} disabled={!valid} />}>
      <OlapModalModeSwitch mode={mode} onChange={changeMode} />
      {mode === 'simple' ? (
        <div className="space-y-4">
          <OlapModalField id="top-bottom-count" label="Cantidad">
            <Input id="top-bottom-count" type="number" min={1} step={1} value={count} onChange={(event) => setCount(Number(event.target.value))} />
          </OlapModalField>
          <OlapModalField id="top-bottom-measure" label="Medida">
            <Select id="top-bottom-measure" value={selected} onChange={(event) => setSelected(event.target.value)}>
              {measures.map((measure) => <option key={measure.uniqueName} value={measure.uniqueName}>{measure.caption || measure.name}</option>)}
            </Select>
          </OlapModalField>
        </div>
      ) : (
        <OlapExpressionEditor id="top-bottom-expression" label={`${title}: N, <medida o expresión>`} value={mdx} onChange={setMdx} minRows={9} />
      )}
    </OlapModal>
  );
}

export type GrowthBasis = 'previous' | 'first' | 'specific';
export interface GrowthModalProps extends BaseProps {
  onApply: (basis: GrowthBasis, referenceValue?: string) => void;
}

export function GrowthModal({ open, onApply, onCancel }: GrowthModalProps) {
  const [basis, setBasis] = React.useState<GrowthBasis>('previous');
  const [reference, setReference] = React.useState('');
  React.useEffect(() => { if (open) { setBasis('previous'); setReference(''); } }, [open]);
  return (
    <OlapModal open={open} onOpenChange={closeOnRequest(onCancel)} title="Crecimiento" size="md" footer={<OlapModalActions onCancel={onCancel} onApply={() => onApply(basis, basis === 'specific' ? reference : undefined)} disabled={basis === 'specific' && !reference.trim()} />}>
      <fieldset className="space-y-3">
        <legend className="mb-2 text-sm font-medium">Comparar con</legend>
        <Radio name="growth-basis" value="previous" group={basis} onGroupChange={(value) => setBasis(value as GrowthBasis)} label="Periodo anterior" />
        <Radio name="growth-basis" value="first" group={basis} onGroupChange={(value) => setBasis(value as GrowthBasis)} label="Primer periodo" />
        <Radio name="growth-basis" value="specific" group={basis} onGroupChange={(value) => setBasis(value as GrowthBasis)} label="Miembro específico" />
      </fieldset>
      {basis === 'specific' ? (
        <div className="mt-4">
          <OlapModalField id="growth-reference" label="Miembro de referencia">
            <Input id="growth-reference" value={reference} onChange={(event) => setReference(event.target.value)} />
          </OlapModalField>
        </div>
      ) : null}
    </OlapModal>
  );
}

export type PercentageAxis = 'COLUMNS' | 'ROWS' | 'GRAND_TOTAL';
export type PercentageScope = 'all' | 'selected';
export interface FormatAsPercentageModalProps extends BaseProps {
  defaultAxis: PercentageAxis;
  scope: PercentageScope;
  onApply: (axis: PercentageAxis, scope: PercentageScope) => void;
}

export function FormatAsPercentageModal({ defaultAxis, scope, open, onApply, onCancel }: FormatAsPercentageModalProps) {
  const [axis, setAxis] = React.useState(defaultAxis);
  const [target, setTarget] = React.useState(scope);
  React.useEffect(() => { if (open) { setAxis(defaultAxis); setTarget(scope); } }, [open, defaultAxis, scope]);
  return (
    <OlapModal open={open} onOpenChange={closeOnRequest(onCancel)} title="Formato porcentual" size="md" footer={<OlapModalActions onCancel={onCancel} onApply={() => onApply(axis, target)} />}>
      <div className="space-y-4">
        <OlapModalField id="percentage-axis" label="Eje base">
          <Select id="percentage-axis" value={axis} onChange={(event) => setAxis(event.target.value as PercentageAxis)}>
            <option value="ROWS">Total de filas</option>
            <option value="COLUMNS">Total de columnas</option>
            <option value="GRAND_TOTAL">Total general</option>
          </Select>
        </OlapModalField>
        <OlapModalField id="percentage-scope" label="Aplicar a">
          <Select id="percentage-scope" value={target} onChange={(event) => setTarget(event.target.value as PercentageScope)}>
            <option value="all">Todas las medidas</option>
            <option value="selected">Solo selección</option>
          </Select>
        </OlapModalField>
      </div>
    </OlapModal>
  );
}
