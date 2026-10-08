import { Handle, Position } from '@xyflow/react';
import { KeyRound, Link2, MoreHorizontal, Table2, X } from 'lucide-react';
import { Badge } from '../../atoms/badge';
import { Button } from '../../atoms/button';
import type { CubeTableNodeData } from './types';

export function CubeTableNode({
  id,
  data,
  selected,
}: {
  id: string;
  data: CubeTableNodeData;
  selected?: boolean;
}) {
  const { table, onRemove } = data;
  return (
    <article
      className={`w-64 overflow-hidden rounded-lg border bg-card text-card-foreground shadow-sm transition-shadow ${selected ? 'border-primary ring-2 ring-primary/20 shadow-md' : 'border-border'}`}
    >
      <header className="flex items-center gap-2 border-b border-border bg-muted/40 px-3 py-2">
        <span className="flex size-7 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Table2 className="size-4" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-semibold" title={table.name}>
            {table.name}
          </h3>
          <p className="truncate text-xs text-muted-foreground">
            {table.schema || 'Default schema'}
          </p>
        </div>
        <Badge variant={table.role === 'fact' ? 'default' : 'secondary'}>
          {table.role === 'fact' ? 'Fact' : 'Dimension'}
        </Badge>
        {onRemove && (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={`Remove ${table.name}`}
            onClick={(event) => {
              event.stopPropagation();
              onRemove(id);
            }}
            className="nodrag"
          >
            <X className="size-3.5" />
          </Button>
        )}
      </header>
      <ul className="divide-y divide-border">
        {table.columns.map((column) => (
          <li
            key={column.name}
            className="relative flex items-center gap-2 px-3 py-1.5 text-xs"
          >
            <Handle
              id={`target:${column.name}`}
              type="target"
              position={Position.Left}
              className="!size-2 !border-2 !border-background !bg-muted-foreground"
              aria-label={`Join into ${table.name}.${column.name}`}
            />
            {column.isPrimaryKey ? (
              <KeyRound
                className="size-3 shrink-0 text-primary"
                aria-label="Primary key"
              />
            ) : column.isForeignKey ? (
              <Link2
                className="size-3 shrink-0 text-muted-foreground"
                aria-label="Foreign key"
              />
            ) : (
              <span className="size-3 shrink-0" />
            )}
            <span className="min-w-0 flex-1 truncate" title={column.name}>
              {column.name}
            </span>
            <span className="text-muted-foreground">{column.dataType}</span>
            <Handle
              id={`source:${column.name}`}
              type="source"
              position={Position.Right}
              className="!size-2 !border-2 !border-background !bg-primary"
              aria-label={`Join from ${table.name}.${column.name}`}
            />
          </li>
        ))}
      </ul>
      <footer className="flex items-center justify-between bg-muted/30 px-3 py-1.5 text-[11px] text-muted-foreground">
        <span>{table.columns.length} columns</span>
        <MoreHorizontal className="size-3.5" aria-hidden="true" />
      </footer>
    </article>
  );
}
