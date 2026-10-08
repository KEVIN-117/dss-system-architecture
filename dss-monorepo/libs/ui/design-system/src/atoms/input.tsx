import * as React from 'react';
import { cn } from 'cn';

type InputSize = 'sm' | 'default' | 'lg';
type InputTone = 'default' | 'destructive';

type InputProps = Omit<React.ComponentProps<'input'>, 'className' | 'size'> & {
  className?: string;
  size?: InputSize;
  tone?: InputTone;
  iconLeft?: React.ReactNode;
};

function Input({
  className,
  type,
  size = 'default',
  tone = 'default',
  iconLeft,
  ...props
}: InputProps) {
  const input = (
    <input
      {...props}
      type={type}
      data-slot="input"
      data-size={size}
      data-tone={tone}
      aria-invalid={tone === 'destructive' ? true : props['aria-invalid']}
      className={cn(
        'w-full min-w-0 rounded-lg border border-input bg-transparent text-base transition-colors outline-none file:inline-flex file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40',
        {
          sm: 'h-7 px-2 text-xs',
          default: 'h-8 px-2.5 py-1',
          lg: 'h-10 px-3.5 py-2',
        }[size],
        tone === 'destructive' &&
          'border-destructive focus-visible:border-destructive focus-visible:ring-destructive/30',
        iconLeft && 'pl-8',
        className,
      )}
    />
  );

  if (!iconLeft) return input;

  return (
    <span className="relative block w-full">
      <span className="pointer-events-none absolute inset-y-0 left-2.5 inline-flex items-center text-muted-foreground">
        {iconLeft}
      </span>
      {input}
    </span>
  );
}

export { Input };
export type { InputProps, InputSize, InputTone };
