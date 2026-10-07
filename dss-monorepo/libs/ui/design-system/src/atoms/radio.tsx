'use client';

import { useId, type ChangeEvent, type InputHTMLAttributes, type ReactNode } from 'react';
import { cn } from 'cn';

type RadioProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'type' | 'value' | 'checked'
> & {
  /** Value represented by this radio option. */
  value: string;
  /** Selected value for a controlled radio group. */
  group?: string;
  /** Called with this option's value when it is selected. */
  onGroupChange?: (value: string) => void;
  label?: ReactNode;
  description?: ReactNode;
};

function Radio({
  group,
  value,
  disabled = false,
  label,
  description,
  className,
  onGroupChange,
  onChange,
  ...props
}: RadioProps) {
  const descriptionId = useId();
  const isControlled = group !== undefined;

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    onChange?.(event);
    if (event.currentTarget.checked) {
      onGroupChange?.(value);
    }
  }

  return (
    <label
      className={cn(
        'inline-flex cursor-pointer items-start gap-2',
        disabled && 'pointer-events-none opacity-50',
      )}
    >
      <span className="relative inline-flex size-4 shrink-0 items-center justify-center">
        <input
          {...props}
          type="radio"
          value={value}
          checked={isControlled ? group === value : undefined}
          disabled={disabled}
          onChange={handleChange}
          aria-describedby={
            description
              ? [props['aria-describedby'], descriptionId].filter(Boolean).join(' ')
              : props['aria-describedby']
          }
          className={cn(
            'peer size-4 shrink-0 cursor-pointer appearance-none rounded-full border border-input bg-background transition-colors checked:border-primary focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none',
            className,
          )}
        />
        {isControlled && group === value && (
          <span
            className="pointer-events-none absolute size-2 rounded-full bg-primary"
            aria-hidden="true"
          />
        )}
        {!isControlled && (
          <span
            className="pointer-events-none absolute size-2 rounded-full bg-primary opacity-0 peer-checked:opacity-100"
            aria-hidden="true"
          />
        )}
      </span>
      {(label || description) && (
        <span className="flex flex-col gap-0.5">
          {label && <span className="text-sm leading-tight text-foreground">{label}</span>}
          {description && (
            <span id={descriptionId} className="text-xs leading-tight text-muted-foreground">
              {description}
            </span>
          )}
        </span>
      )}
    </label>
  );
}

export { Radio };
export type { RadioProps };
