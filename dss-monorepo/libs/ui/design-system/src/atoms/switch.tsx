'use client';

import * as React from 'react';
import { cn } from 'cn';
import { Switch as SwitchPrimitive } from 'radix-ui';
import { Label } from './label';

type SwitchProps = React.ComponentProps<typeof SwitchPrimitive.Root> & {
  size?: 'sm' | 'default';
  label?: React.ReactNode;
  description?: React.ReactNode;
};

function Switch({
  className,
  size = 'default',
  id,
  disabled = false,
  label,
  description,
  'aria-describedby': ariaDescribedBy,
  ...props
}: SwitchProps) {
  const generatedId = React.useId();
  const controlId = id ?? generatedId;
  const descriptionId = `${controlId}-description`;
  const describedBy = [ariaDescribedBy, description && descriptionId]
    .filter(Boolean)
    .join(' ');

  const control = (
    <SwitchPrimitive.Root
      {...props}
      id={controlId}
      disabled={disabled}
      aria-describedby={describedBy || undefined}
      data-slot="switch"
      data-size={size}
      className={cn(
        'peer group/switch relative inline-flex shrink-0 items-center rounded-full border border-transparent transition-all outline-none group-has-[:focus-visible]/field-label:border-transparent group-has-[:focus-visible]/field-label:ring-0 after:absolute after:-inset-x-3 after:-inset-y-2 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 data-[size=default]:h-[18.4px] data-[size=default]:w-[32px] data-[size=sm]:h-[14px] data-[size=sm]:w-[24px] dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 data-checked:bg-primary data-unchecked:bg-input dark:data-unchecked:bg-input/80 data-disabled:cursor-not-allowed data-disabled:opacity-50',
        className,
      )}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className="pointer-events-none block rounded-full bg-background ring-0 transition-transform group-data-[size=default]/switch:size-4 group-data-[size=sm]/switch:size-3 group-data-[size=default]/switch:data-checked:translate-x-[calc(100%-2px)] group-data-[size=sm]/switch:data-checked:translate-x-[calc(100%-2px)] dark:data-checked:bg-primary-foreground group-data-[size=default]/switch:data-unchecked:translate-x-0 group-data-[size=sm]/switch:data-unchecked:translate-x-0 dark:data-unchecked:bg-foreground"
      />
    </SwitchPrimitive.Root>
  );

  if (!label && !description) return control;

  return (
    <div
      className={cn(
        'flex items-start gap-3',
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

export { Switch };
export type { SwitchProps };
