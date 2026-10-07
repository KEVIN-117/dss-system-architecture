'use client';

import * as React from 'react';
import { Button } from '../../atoms/button';
import { Checkbox } from '../../atoms/checkbox';
import { Input } from '../../atoms/input';
import { Select } from '../../atoms/select';
import { OlapModal } from './olap-modal';
import { OlapModalActions, OlapModalField } from './modal-parts';

interface BaseProps {
  open: boolean;
  onCancel: () => void;
}

const closeOnRequest = (onCancel: () => void) => (open: boolean) => {
  if (!open) onCancel();
};

export interface DrillAcrossTarget {
  uniqueName: string;
  name: string;
  caption?: string;
}

export interface DrillAcrossModalProps extends BaseProps {
  targets: DrillAcrossTarget[];
  onRun: (target: DrillAcrossTarget) => void;
}

export function DrillAcrossModal({
  targets,
  open,
  onRun,
  onCancel,
}: DrillAcrossModalProps) {
  const [picked, setPicked] = React.useState(targets[0]?.uniqueName ?? '');
  React.useEffect(() => {
    if (open) setPicked(targets[0]?.uniqueName ?? '');
  }, [open, targets]);
  const selected = targets.find((target) => target.uniqueName === picked);
  return (
    <OlapModal
      open={open}
      onOpenChange={closeOnRequest(onCancel)}
      title="Análisis relacionado"
      size="md"
      footer={
        <OlapModalActions
          onCancel={onCancel}
          onApply={() => selected && onRun(selected)}
          applyLabel="Ejecutar"
          disabled={!selected}
        />
      }
    >
      <OlapModalField id="drill-across-target" label="Cubo de destino">
        <Select
          id="drill-across-target"
          value={picked}
          onChange={(event) => setPicked(event.target.value)}
        >
          {targets.map((target) => (
            <option key={target.uniqueName} value={target.uniqueName}>
              {target.caption || target.name}
            </option>
          ))}
        </Select>
      </OlapModalField>
    </OlapModal>
  );
}

export interface DrillField {
  uniqueName: string;
  name: string;
  caption?: string;
}

export interface DrillthroughOptions {
  dimensions: string[];
  measures: string[];
  maxRows: number;
}

export interface DrillthroughModalProps extends BaseProps {
  dimensions: DrillField[];
  measures: DrillField[];
  maxRows: number;
  onRun: (options: DrillthroughOptions) => void;
  onExportCsv: (options: Omit<DrillthroughOptions, 'maxRows'>) => void;
}

export function DrillthroughModal({
  dimensions,
  measures,
  maxRows,
  open,
  onRun,
  onExportCsv,
  onCancel,
}: DrillthroughModalProps) {
  const [pickedDimensions, setPickedDimensions] = React.useState<Set<string>>(
    new Set(),
  );
  const [pickedMeasures, setPickedMeasures] = React.useState<Set<string>>(
    new Set(),
  );
  const [rows, setRows] = React.useState(maxRows);
  React.useEffect(() => {
    if (open) {
      setPickedDimensions(new Set());
      setPickedMeasures(new Set());
      setRows(maxRows);
    }
  }, [open, maxRows]);
  const options = {
    dimensions: [...pickedDimensions],
    measures: [...pickedMeasures],
    maxRows: Math.max(1, Math.floor(rows)),
  };

  function toggle(
    setter: React.Dispatch<React.SetStateAction<Set<string>>>,
    current: Set<string>,
    value: string,
    checked: boolean,
  ) {
    const next = new Set(current);
    if (checked) next.add(value);
    else next.delete(value);
    setter(next);
  }

  return (
    <OlapModal
      open={open}
      onOpenChange={closeOnRequest(onCancel)}
      title="Detalles de celda"
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
          <Button
            variant="outline"
            onClick={() =>
              onExportCsv({
                dimensions: options.dimensions,
                measures: options.measures,
              })
            }
          >
            Exportar CSV
          </Button>
          <Button onClick={() => onRun(options)}>Ejecutar</Button>
        </>
      }
    >
      <div className="grid gap-5 sm:grid-cols-2">
        {[
          {
            id: 'drill-dimensions',
            title: 'Dimensiones',
            items: dimensions,
            selected: pickedDimensions,
            set: setPickedDimensions,
          },
          {
            id: 'drill-measures',
            title: 'Medidas',
            items: measures,
            selected: pickedMeasures,
            set: setPickedMeasures,
          },
        ].map((group) => (
          <section
            key={group.id}
            aria-labelledby={`${group.id}-title`}
            className="min-w-0"
          >
            <h3
              id={`${group.id}-title`}
              className="mb-2 text-sm font-medium text-muted-foreground"
            >
              {group.title}
            </h3>
            <ul className="max-h-60 divide-y divide-border overflow-auto rounded-md border border-border">
              {group.items.map((item) => (
                <li key={item.uniqueName} className="px-3 py-2">
                  <Checkbox
                    checked={group.selected.has(item.uniqueName)}
                    onCheckedChange={(checked) =>
                      toggle(
                        group.set,
                        group.selected,
                        item.uniqueName,
                        checked === true,
                      )
                    }
                    label={item.caption || item.name}
                  />
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
      <div className="mt-4 max-w-48">
        <OlapModalField id="drill-max-rows" label="Máximo de filas">
          <Input
            id="drill-max-rows"
            type="number"
            min={1}
            value={rows}
            onChange={(event) => setRows(Number(event.target.value))}
          />
        </OlapModalField>
      </div>
    </OlapModal>
  );
}

export interface DrillthroughResult {
  columns: string[];
  rows: Array<Array<React.ReactNode>>;
  error?: string | null;
  runtimeMs?: number;
}

export interface DrillthroughResultModalProps {
  result: DrillthroughResult | null;
  onClose: () => void;
  loadingLabel?: string;
  emptyLabel?: string;
  open: boolean;
}

export function DrillthroughResultModal({
  result,
  open,
  onClose,
  loadingLabel = 'Cargando resultados…',
  emptyLabel = 'No hay filas para mostrar.',
}: DrillthroughResultModalProps) {
  return (
    <OlapModal
      open={open}
      onOpenChange={closeOnRequest(onClose)}
      title="Resultados de detalle"
      size="full"
      footer={<Button onClick={onClose}>Cerrar</Button>}
    >
      {!result ? (
        <p className="text-sm text-muted-foreground" role="status">
          {loadingLabel}
        </p>
      ) : result.error ? (
        <p
          className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
          role="alert"
        >
          {result.error}
        </p>
      ) : result.rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{emptyLabel}</p>
      ) : (
        <>
          <div className="max-h-[60vh] overflow-auto rounded-md border border-border">
            <table className="w-full border-collapse text-sm">
              <thead className="sticky top-0 bg-muted text-left">
                <tr>
                  {result.columns.map((column) => (
                    <th
                      key={column}
                      className="border-b border-border px-3 py-2 font-medium"
                    >
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.rows.map((row, rowIndex) => (
                  <tr
                    key={rowIndex}
                    className="border-b border-border last:border-0"
                  >
                    {row.map((cell, cellIndex) => (
                      <td key={cellIndex} className="px-3 py-2">
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {result.rows.length.toLocaleString()} filas
            {result.runtimeMs != null ? ` · ${result.runtimeMs} ms` : ''}
          </p>
        </>
      )}
    </OlapModal>
  );
}
