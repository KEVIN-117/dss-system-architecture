import * as React from 'react';
import { cn } from 'cn';

export interface FilterBarProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Accessible name of the group, e.g. "Filtros del resumen". */
  label?: string;
  /** Stick under the portal header while the page scrolls. */
  sticky?: boolean;
  /** Content aligned to the end, e.g. a scope note. */
  aside?: React.ReactNode;
}

/** Glass strip that groups a page's filters. */
export function FilterBar({
  label = 'Filtros',
  sticky = true,
  aside,
  className,
  children,
  ...props
}: FilterBarProps) {
  return (
    <div
      role="group"
      aria-label={label}
      data-slot="filter-bar"
      className={cn(
        'glass-chrome z-20 flex flex-wrap items-end gap-x-4 gap-y-3 rounded-2xl border border-(--glass-border) px-4 py-3 shadow-glass',
        sticky && 'sticky top-(--dss-header-offset)',
        className,
      )}
      {...props}
    >
      {children}
      {aside ? (
        <div className="ml-auto flex items-center gap-2 self-center text-xs text-muted-foreground [&_svg]:size-4">
          {aside}
        </div>
      ) : null}
    </div>
  );
}
