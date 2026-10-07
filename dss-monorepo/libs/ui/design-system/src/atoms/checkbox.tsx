'use client';

import * as React from 'react';
import { cn } from 'cn';
import { Checkbox as CheckboxPrimitive } from 'radix-ui';
import { CheckIcon, MinusIcon } from 'lucide-react';
import { Label } from './label';

type CheckboxProps = React.ComponentProps<typeof CheckboxPrimitive.Root> & {
  indeterminate?: boolean;
  label?: React.ReactNode;
  description?: React.ReactNode;
};

function Checkbox({
  className,
  id,
  checked,
  disabled = false,
  indeterminate = false,
  label,
  description,
  'aria-describedby': ariaDescribedBy,
  ...props
}: CheckboxProps) {
  const generatedId = React.useId();
  const controlId = id ?? generatedId;
  const isIndeterminate = indeterminate || checked === 'indeterminate';
  const descriptionId = `${controlId}-description`;
  const describedBy = [ariaDescribedBy, description && descriptionId]
    .filter(Boolean)
    .join(' ');

  const control = (
    <CheckboxPrimitive.Root
      {...props}
      id={controlId}
      disabled={disabled}
      checked={isIndeterminate ? 'indeterminate' : checked}
      aria-describedby={describedBy || undefined}
      data-slot="checkbox"
      className={cn(
        'peer relative flex size-4 shrink-0 items-center justify-center rounded-[4px] border border-input transition-colors outline-none group-has-disabled/field:opacity-50 group-has-[:focus-visible]/field-label:ring-0 group-has-[:focus-visible]/field-label:not-data-checked:border-input after:absolute after:-inset-x-3 after:-inset-y-2 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 aria-invalid:aria-checked:border-primary dark:bg-input/30 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 data-checked:border-primary data-checked:bg-primary data-checked:text-primary-foreground data-[state=indeterminate]:border-primary data-[state=indeterminate]:bg-primary data-[state=indeterminate]:text-primary-foreground group-has-[:focus-visible]/field-label:data-checked:border-primary dark:data-checked:bg-primary',
        className,
      )}
    >
      <CheckboxPrimitive.Indicator
        data-slot="checkbox-indicator"
        className="grid place-content-center text-current transition-none [&>svg]:size-3.5"
      >
        {isIndeterminate ? <MinusIcon /> : <CheckIcon />}
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );

  if (!label && !description) return control;

  return (
    <div
      className={cn(
        'flex items-start gap-2',
        disabled && 'pointer-events-none opacity-50',
      )}
    >
      {control}
      <span className="flex flex-col gap-0.5">
        {label && <Label htmlFor={controlId}>{label}</Label>}
        {description && (
          <span id={descriptionId} className="text-xs leading-tight text-muted-foreground">
            {description}
          </span>
        )}
      </span>
    </div>
  );
}

export { Checkbox };
export type { CheckboxProps };
