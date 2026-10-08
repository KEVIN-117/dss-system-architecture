import * as React from 'react';
import { cn } from 'cn';

type TextareaTone = 'default' | 'destructive';

type TextareaProps = Omit<React.ComponentProps<'textarea'>, 'className'> & {
  className?: string;
  tone?: TextareaTone;
};

function Textarea({
  className,
  tone = 'default',
  rows = 4,
  ...props
}: TextareaProps) {
  return (
    <textarea
      {...props}
      rows={rows}
      data-slot="textarea"
      data-tone={tone}
      aria-invalid={tone === 'destructive' ? true : props['aria-invalid']}
      className={cn(
        'w-full resize-y rounded-lg border border-input bg-transparent px-2.5 py-2 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40',
        tone === 'destructive' &&
          'border-destructive focus-visible:border-destructive focus-visible:ring-destructive/30',
        className,
      )}
    />
  );
}

export { Textarea };
export type { TextareaProps, TextareaTone };
