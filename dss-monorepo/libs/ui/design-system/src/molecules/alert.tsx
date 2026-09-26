import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from 'cn';

const alertVariants = cva(
  'relative w-full rounded-lg border px-4 py-4 text-sm [&>svg+div]:translate-y-[-3px] [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4 [&>svg]:text-foreground [&>svg~*]:pl-7 overflow-hidden',
  {
    variants: {
      variant: {
        default:
          'bg-background/50 backdrop-blur-sm text-foreground border-primary/20',
        destructive:
          'border-destructive/50 text-destructive bg-destructive/10 backdrop-blur-sm dark:border-destructive [&>svg]:text-destructive shadow-[0_0_15px_theme(colors.destructive.DEFAULT/15%)] border-l-4 border-l-destructive',
        system:
          'border-primary/40 text-primary bg-primary/5 backdrop-blur-sm [&>svg]:text-primary shadow-[0_0_15px_theme(colors.primary.DEFAULT/15%)] border-l-4 border-l-primary font-mono',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

const Alert = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof alertVariants>
>(({ className, variant, ...props }, ref) => (
  <div
    ref={ref}
    role="alert"
    className={cn(alertVariants({ variant }), className)}
    {...props}
  />
));
Alert.displayName = 'Alert';

const AlertTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, children, ...props }, ref) => (
  <h5
    ref={ref}
    className={cn(
      'mb-1 font-heading font-medium leading-none tracking-tight',
      className,
    )}
    {...props}
  >
    {children}
  </h5>
));
AlertTitle.displayName = 'AlertTitle';

const AlertDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('text-sm [&_p]:leading-relaxed opacity-90', className)}
    {...props}
  />
));
AlertDescription.displayName = 'AlertDescription';

export { Alert, AlertTitle, AlertDescription, alertVariants };
