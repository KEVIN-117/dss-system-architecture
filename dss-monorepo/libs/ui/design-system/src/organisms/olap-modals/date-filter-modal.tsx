'use client';

import * as React from 'react';
import { Button } from '../../atoms/button';
import { Input } from '../../atoms/input';
import { Select } from '../../atoms/select';
import { OlapModal } from './olap-modal';
import { OlapModalActions, OlapModalField } from './modal-parts';

export type DateFilterMode = 'relative' | 'absolute' | 'compare';
export type DateFilterPreset =
  | 'TODAY'
  | 'YESTERDAY'
  | 'LAST_N_DAYS'
  | 'LAST_N_WEEKS'
  | 'LAST_N_MONTHS'
  | 'LAST_N_QUARTERS'
  | 'LAST_N_YEARS'
  | 'ROLLING_N'
  | 'MONTH_TO_DATE'
  | 'QUARTER_TO_DATE'
  | 'YEAR_TO_DATE';
export type DateFilterShiftUnit = 'year' | 'quarter' | 'month' | 'week' | 'day';

export interface DateFilterConfig {
  mode: DateFilterMode;
  preset: DateFilterPreset;
  count: number;
  from: string;
  to: string;
  compare: 'NONE' | 'PRIOR_PERIOD' | 'PRIOR_YEAR';
  shiftUnit: DateFilterShiftUnit;
  shiftCount: number;
}

export interface DateFilterModalProps {
  open: boolean;
  hierarchyCaption: string;
  defaultConfig: DateFilterConfig;
  supportedPresets?: DateFilterPreset[];
  previewMdx?: (config: DateFilterConfig) => string;
  onApply: (config: DateFilterConfig) => void;
  onCancel: () => void;
}

const presetOptions: Array<{
  value: DateFilterPreset;
  label: string;
  needsCount?: boolean;
}> = [
  { value: 'TODAY', label: 'Hoy' },
  { value: 'YESTERDAY', label: 'Ayer' },
  { value: 'LAST_N_DAYS', label: 'Últimos N días', needsCount: true },
  { value: 'LAST_N_WEEKS', label: 'Últimas N semanas', needsCount: true },
  { value: 'LAST_N_MONTHS', label: 'Últimos N meses', needsCount: true },
  { value: 'LAST_N_QUARTERS', label: 'Últimos N trimestres', needsCount: true },
  { value: 'LAST_N_YEARS', label: 'Últimos N años', needsCount: true },
  { value: 'ROLLING_N', label: 'Periodo móvil', needsCount: true },
  { value: 'MONTH_TO_DATE', label: 'Mes hasta hoy' },
  { value: 'QUARTER_TO_DATE', label: 'Trimestre hasta hoy' },
  { value: 'YEAR_TO_DATE', label: 'Año hasta hoy' },
];

const defaultConfig: DateFilterConfig = {
  mode: 'relative',
  preset: 'LAST_N_DAYS',
  count: 7,
  from: '',
  to: '',
  compare: 'NONE',
  shiftUnit: 'year',
  shiftCount: 1,
};

export function DateFilterModal({
  open,
  hierarchyCaption,
  defaultConfig: initialConfig,
  supportedPresets,
  previewMdx,
  onApply,
  onCancel,
}: DateFilterModalProps) {
  const [config, setConfig] = React.useState<DateFilterConfig>({
    ...defaultConfig,
    ...initialConfig,
  });
  React.useEffect(() => {
    if (open) setConfig({ ...defaultConfig, ...initialConfig });
  }, [open, initialConfig]);
  const presets = presetOptions.filter(
    (option) => !supportedPresets || supportedPresets.includes(option.value),
  );
  const selectedPreset = presets.find(
    (option) => option.value === config.preset,
  );
  const needsCount = selectedPreset?.needsCount ?? false;
  const absoluteValid =
    !!config.from && !!config.to && config.from <= config.to;
  const relativeValid =
    !needsCount || (Number.isFinite(config.count) && config.count >= 1);
  const compareValid = absoluteValid && config.shiftCount >= 1;
  const valid =
    config.mode === 'relative'
      ? relativeValid
      : config.mode === 'absolute'
        ? absoluteValid
        : compareValid;
  const patch = (change: Partial<DateFilterConfig>) =>
    setConfig((current) => ({ ...current, ...change }));
  const preview = previewMdx?.(config) ?? '';

  return (
    <OlapModal
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onCancel();
      }}
      title={`Filtro de fechas — ${hierarchyCaption}`}
      size="lg"
      footer={
        <OlapModalActions
          onCancel={onCancel}
          onApply={() => onApply(config)}
          applyLabel="Aplicar filtro"
          disabled={!valid}
        />
      }
    >
      <div className="space-y-4">
        <div
          className="flex flex-wrap gap-2"
          role="tablist"
          aria-label="Tipo de filtro temporal"
        >
          {(['relative', 'absolute', 'compare'] as const).map((mode) => (
            <Button
              key={mode}
              type="button"
              size="sm"
              variant={config.mode === mode ? 'secondary' : 'outline'}
              role="tab"
              aria-selected={config.mode === mode}
              onClick={() => patch({ mode })}
            >
              {
                {
                  relative: 'Relativo',
                  absolute: 'Fechas exactas',
                  compare: 'Comparar periodos',
                }[mode]
              }
            </Button>
          ))}
        </div>
        {config.mode === 'relative' ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <OlapModalField id="date-preset" label="Periodo">
              <Select
                id="date-preset"
                value={config.preset}
                onChange={(event) =>
                  patch({ preset: event.target.value as DateFilterPreset })
                }
              >
                {presets.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </OlapModalField>
            {needsCount ? (
              <OlapModalField id="date-count" label="Cantidad">
                <Input
                  id="date-count"
                  type="number"
                  min={1}
                  value={config.count}
                  onChange={(event) =>
                    patch({ count: Number(event.target.value) })
                  }
                />
              </OlapModalField>
            ) : null}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <OlapModalField id="date-from" label="Desde">
              <Input
                id="date-from"
                type="date"
                value={config.from}
                onChange={(event) => patch({ from: event.target.value })}
              />
            </OlapModalField>
            <OlapModalField id="date-to" label="Hasta">
              <Input
                id="date-to"
                type="date"
                value={config.to}
                onChange={(event) => patch({ to: event.target.value })}
              />
            </OlapModalField>
            {config.mode === 'absolute' ? (
              <OlapModalField id="date-compare" label="Comparación">
                <Select
                  id="date-compare"
                  value={config.compare}
                  onChange={(event) =>
                    patch({
                      compare: event.target
                        .value as DateFilterConfig['compare'],
                    })
                  }
                >
                  <option value="NONE">Sin comparación</option>
                  <option value="PRIOR_PERIOD">Periodo anterior</option>
                  <option value="PRIOR_YEAR">Año anterior</option>
                </Select>
              </OlapModalField>
            ) : (
              <>
                <OlapModalField id="date-shift-unit" label="Desplazar por">
                  <Select
                    id="date-shift-unit"
                    value={config.shiftUnit}
                    onChange={(event) =>
                      patch({
                        shiftUnit: event.target.value as DateFilterShiftUnit,
                      })
                    }
                  >
                    {(['year', 'quarter', 'month', 'week', 'day'] as const).map(
                      (unit) => (
                        <option key={unit} value={unit}>
                          {unit}
                        </option>
                      ),
                    )}
                  </Select>
                </OlapModalField>
                <OlapModalField
                  id="date-shift-count"
                  label="Cantidad de periodos"
                >
                  <Input
                    id="date-shift-count"
                    type="number"
                    min={1}
                    value={config.shiftCount}
                    onChange={(event) =>
                      patch({ shiftCount: Number(event.target.value) })
                    }
                  />
                </OlapModalField>
              </>
            )}
          </div>
        )}
        {config.mode !== 'relative' && !absoluteValid ? (
          <p className="text-sm text-destructive" role="alert">
            Selecciona un rango de fechas válido.
          </p>
        ) : null}
        {preview ? (
          <div className="space-y-2">
            <p className="text-sm font-medium">Vista previa MDX</p>
            <pre className="max-h-36 overflow-auto rounded-md border border-border bg-muted p-3 text-xs text-foreground">
              {preview}
            </pre>
          </div>
        ) : null}
      </div>
    </OlapModal>
  );
}
