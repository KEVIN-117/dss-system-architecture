'use client';

import { AlertCircle, ExternalLink, Table2 } from 'lucide-react';
import type { CellEntry, QueryResult } from '@dss-monorepo/olap-models';
import { Loader } from '../../atoms/loader';

export interface CellsetTableProps {
  result?: QueryResult | null;
  loading?: boolean;
  error?: string;
  emptyMessage?: string;
  maxHeight?: number | string;
  className?: string;
  onDrillthrough?: (
    cell: CellEntry,
    position?: string,
    coordinates?: { row: number; col: number },
  ) => void;
  selectedCell?: { row: number; col: number } | null;
}

/** Accessible, token-styled table for an OLAP cellset, including status, drillthrough and empty states. */
export function CellsetTable({
  result,
  loading = false,
  error,
  emptyMessage = 'La consulta no devolvió celdas.',
  maxHeight = 560,
  className,
  onDrillthrough,
  selectedCell,
}: CellsetTableProps) {
  const displayError = error ?? result?.error;
  const rows = result?.cellset ?? [];
  const hasCells = rows.some((row) => row.length > 0);

  if (loading) {
    return (
      <Loader text="Ejecutando consulta…" fullScreen={false} className={`rounded-lg border border-border ${className ?? ''}`} />
    );
  }

  if (displayError) {
    return (
      <div
        className={`flex min-h-32 items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4 ${className ?? ''}`}
        role="alert"
      >
        <AlertCircle
          aria-hidden="true"
          className="mt-0.5 size-4 shrink-0 text-destructive"
        />
        <div>
          <p className="text-sm font-medium text-foreground">
            No se pudo cargar el resultado
          </p>
          <p className="mt-1 text-sm text-muted-foreground">{displayError}</p>
        </div>
      </div>
    );
  }

  if (!hasCells) {
    return (
      <div
        className={`flex min-h-40 flex-col items-center justify-center rounded-lg border border-dashed border-border px-4 text-center ${className ?? ''}`}
        role="status"
      >
        <Table2 aria-hidden="true" className="size-5 text-muted-foreground" />
        <p className="mt-2 text-sm font-medium text-foreground">
          Sin resultados
        </p>
        <p className="mt-1 text-xs text-muted-foreground">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div
      className={`w-full overflow-auto rounded-lg border border-border bg-background ${className ?? ''}`}
      style={{ maxHeight }}
      role="region"
      aria-label="Resultado de la consulta"
      tabIndex={0}
    >
      <table className="w-full border-collapse text-left text-sm">
        <caption className="sr-only">
          Resultado OLAP{result?.query?.name ? `: ${result.query.name}` : ''}
        </caption>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr
              key={`row-${rowIndex}`}
              className="border-b border-border last:border-b-0"
            >
              {row.map((cell, columnIndex) =>
                renderCell(
                  cell,
                  rowIndex,
                  columnIndex,
                  onDrillthrough,
                  selectedCell?.row === rowIndex && selectedCell?.col === columnIndex,
                ),
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function renderCell(
  cell: CellEntry,
  rowIndex: number,
  columnIndex: number,
  onDrillthrough?: (
    cell: CellEntry,
    position?: string,
    coordinates?: { row: number; col: number },
  ) => void,
  isSelected = false,
) {
  const key = `cell-${rowIndex}-${columnIndex}`;
  const content = cell.value || (cell.type === 'EMPTY' ? '—' : '');
  const baseClass =
    'min-w-28 max-w-72 border-r border-border px-3 py-2 align-middle last:border-r-0';

  if (cell.type === 'COLUMN_HEADER' || cell.type === 'ROW_HEADER_HEADER') {
    return (
      <th
        key={key}
        scope="col"
        className={`${baseClass} bg-muted/70 font-medium text-foreground`}
      >
        {content}
      </th>
    );
  }
  if (cell.type === 'ROW_HEADER') {
    return (
      <th
        key={key}
        scope="row"
        className={`${baseClass} bg-muted/30 font-medium text-foreground`}
      >
        {content}
      </th>
    );
  }
  if (cell.type === 'ERROR') {
    return (
      <td key={key} className={`${baseClass} text-destructive`} title={content}>
        {content}
      </td>
    );
  }

  // DATA_CELL with drillthrough support
  const isDataCell =
    cell.type === 'DATA_CELL' ||
    (cell.type !== 'EMPTY' && content !== '—' && !isNaN(Number(content.replace(/[^0-9.-]/g, ''))));
  const canDrill = Boolean(onDrillthrough && isDataCell && content !== '—');

  if (canDrill) {
    return (
      <td
        key={key}
        className={`${baseClass} group/cell relative cursor-pointer text-foreground tabular-nums transition-colors hover:bg-primary/10 hover:text-primary ${
          isSelected ? 'bg-primary/15 ring-1 ring-inset ring-primary' : ''
        }`}
        title={`Ver detalle transaccional (Drillthrough): ${content}`}
        tabIndex={0}
        role="button"
        aria-label={`Detalle de celda con valor ${content}`}
        onClick={() =>
          onDrillthrough!(cell, cell.properties?.position, {
            row: rowIndex,
            col: columnIndex,
          })
        }
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onDrillthrough!(cell, cell.properties?.position, {
              row: rowIndex,
              col: columnIndex,
            });
          }
        }}
      >
        <div className="flex items-center justify-between gap-1.5">
          <span>{content}</span>
          <ExternalLink
            aria-hidden="true"
            className="size-3 shrink-0 opacity-0 transition-opacity group-hover/cell:opacity-100 text-primary"
          />
        </div>
      </td>
    );
  }

  return (
    <td key={key} className={`${baseClass} text-foreground tabular-nums`}>
      {content}
    </td>
  );
}
