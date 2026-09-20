import * as React from 'react';
import { cn } from 'cn';
import { Label } from '../atoms/label';
import { Typography } from '../atoms/typography';

export interface FormFieldProps extends React.HTMLAttributes<HTMLDivElement> {
  label: string;
  htmlFor?: string;
  description?: string;
  error?: string;
  required?: boolean;
}

export const FormField = React.forwardRef<HTMLDivElement, FormFieldProps>(
  (
    {
      className,
      label,
      htmlFor,
      description,
      error,
      required,
      children,
      ...props
    },
    ref,
  ) => {
    return (
      <div
        ref={ref}
        className={cn('flex flex-col space-y-2', className)}
        {...props}
      >
        <div className="flex justify-between items-baseline">
          <Label
            htmlFor={htmlFor}
            className={cn(
              'font-heading tracking-wide uppercase text-xs',
              error ? 'text-destructive' : 'text-primary/80',
            )}
          >
            {label}
            {required && <span className="text-destructive ml-1">*</span>}
          </Label>
          {error && (
            <Typography
              variant="small"
              className="text-destructive font-mono text-[10px] animate-pulse uppercase"
            >
              {error}
            </Typography>
          )}
        </div>

        {/* The actual input element injected as children */}
        <div className="relative group/field">
          {children}
          {/* Cyberpunk accent frame */}
          <div
            className={cn(
              'absolute -inset-0.5 rounded-md pointer-events-none opacity-0 transition-opacity duration-300',
              error
                ? 'bg-destructive/10 ring-1 ring-destructive/50 opacity-100'
                : 'group-focus-within/field:opacity-100 ring-1 ring-primary/30',
            )}
          />
        </div>

        {description && !error && (
          <Typography
            variant="muted"
            className="text-[11px] font-mono opacity-60"
          >
            {description}
          </Typography>
        )}
      </div>
    );
  },
);
FormField.displayName = 'FormField';
