import * as React from 'react';
import { cn } from 'cn';
import { ChevronDown } from 'lucide-react';

export interface NativeSelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface NativeSelectProps
  extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'children'> {
  label: string;
  /** Visually hide the label but keep it for assistive technology. */
  hideLabel?: boolean;
  options?: NativeSelectOption[];
  children?: React.ReactNode;
  hint?: string;
  containerClassName?: string;
}

/**
 * Styled native <select> with a real label and a visible focus ring. It keeps
 * the native element (and its onChange contract) so mobile pickers and
 * keyboard type-ahead keep working.
 */
export const NativeSelect = React.forwardRef<HTMLSelectElement, NativeSelectProps>(
  function NativeSelect(
    {
      label,
      hideLabel = false,
      options,
      children,
      hint,
      id,
      className,
      containerClassName,
      ...props
    },
    ref,
  ) {
    const generatedId = React.useId();
    const selectId = id ?? generatedId;
    const hintId = hint ? `${selectId}-hint` : undefined;

    return (
      <div
        data-slot="native-select"
        className={cn('flex min-w-0 flex-col gap-1.5', containerClassName)}
      >
        <label
          htmlFor={selectId}
          className={cn(
            'text-xs font-medium text-muted-foreground',
            hideLabel && 'sr-only',
          )}
        >
          {label}
        </label>
        <div className="relative">
          <select
            ref={ref}
            id={selectId}
            aria-describedby={hintId}
            className={cn(
              'h-10 w-full min-w-44 cursor-pointer appearance-none rounded-lg border border-(--glass-border) bg-background/70 pr-9 pl-3 text-sm text-foreground transition-[border-color,box-shadow] duration-(--dur-fast)',
              // The option list is drawn by the browser: give it opaque, theme-aware colours.
              '[&_option]:bg-popover [&_option]:text-popover-foreground',
              'hover:border-role-accent/50 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 focus-visible:outline-none',
              'disabled:cursor-not-allowed disabled:opacity-50',
              className,
            )}
            {...props}
          >
            {options?.map((option) => (
              <option
                key={option.value}
                value={option.value}
                disabled={option.disabled}
              >
                {option.label}
              </option>
            ))}
            {children}
          </select>
          <ChevronDown
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground"
          />
        </div>
        {hint ? (
          <p id={hintId} className="text-xs text-muted-foreground">
            {hint}
          </p>
        ) : null}
      </div>
    );
  },
);
