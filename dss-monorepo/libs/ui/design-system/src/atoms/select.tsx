import * as React from 'react';
import { ChevronDownIcon } from 'lucide-react';
import { cn } from 'cn';

type SelectSize = 'sm' | 'md' | 'lg';

type SelectProps = Omit<React.ComponentProps<'select'>, 'className' | 'size'> & {
  className?: string;
  size?: SelectSize;
};

function Select({
  className,
  size = 'md',
  multiple = false,
  children,
  ...props
}: SelectProps) {
  return (
    <span className="relative inline-flex w-full items-center">
      <select
        {...props}
        multiple={multiple}
        data-slot="select"
        data-size={size}
        className={cn(
          'w-full min-w-0 rounded-lg border border-input bg-background text-sm text-foreground transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40',
          multiple
            ? 'min-h-24 overflow-auto p-1'
            : cn(
                'cursor-pointer appearance-none',
                {
                  sm: 'h-7 py-1 pl-2.5 pr-7 text-xs',
                  md: 'h-8 py-1 pl-3 pr-8 text-sm',
                  lg: 'h-10 py-2 pl-3.5 pr-8 text-sm',
                }[size],
              ),
          className,
        )}
      >
        {children}
      </select>
      {!multiple && (
        <ChevronDownIcon
          aria-hidden="true"
          className={cn(
            'pointer-events-none absolute size-3.5 text-muted-foreground',
            size === 'sm' ? 'right-2' : 'right-2.5',
          )}
        />
      )}
    </span>
  );
}

export { Select };
export type { SelectProps, SelectSize };
