'use client';

import { AlertCircle, Table2 } from 'lucide-react';
import type { CellEntry, QueryResult } from '@dss-monorepo/olap-models';
import { Loader } from '../../atoms/loader';

export interface CellsetTableProps {
  result?: QueryResult | null;
  loading?: boolean;
  error?: string;
  emptyMessage?: string;
  maxHeight?: number | string;
  className?: string;
}

/** Accessible, token-styled table for an OLAP cellset, including status and empty states. */
export function CellsetTable({
  result,
  loading = false,
  error,
  emptyMessage = 'La consulta no devolvió celdas.',
  maxHeight = 560,
  className,
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
                renderCell(cell, rowIndex, columnIndex),
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function renderCell(cell: CellEntry, rowIndex: number, columnIndex: number) {
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
  return (
    <td key={key} className={`${baseClass} text-foreground tabular-nums`}>
      {content}
    </td>
  );
}
