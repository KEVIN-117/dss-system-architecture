import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from 'cn';
import { Slot } from 'radix-ui';

const typographyVariants = cva('text-foreground', {
  variants: {
    variant: {
      h1: 'scroll-m-20 text-4xl font-extrabold tracking-tight lg:text-5xl font-heading',
      h2: 'scroll-m-20 border-b border-primary/20 pb-2 text-3xl font-semibold tracking-tight transition-colors first:mt-0 font-heading',
      h3: 'scroll-m-20 text-2xl font-semibold tracking-tight font-heading',
      h4: 'scroll-m-20 text-xl font-semibold tracking-tight font-heading',
      p: 'leading-7 [&:not(:first-child)]:mt-6',
      blockquote: 'mt-6 border-l-2 border-primary/50 pl-6 italic text-muted-foreground bg-muted/20 py-2 rounded-r-lg',
      list: 'my-6 ml-6 list-disc [&>li]:mt-2',
      inlineCode: 'relative rounded bg-muted px-[0.3rem] py-[0.2rem] font-mono text-sm font-semibold text-primary',
      lead: 'text-xl text-muted-foreground',
      large: 'text-lg font-semibold',
      small: 'text-sm font-medium leading-none',
      muted: 'text-sm text-muted-foreground',
      // Cyberpunk specific
      neon: 'text-primary drop-shadow-[0_0_8px_theme(colors.primary.DEFAULT/60%)] font-heading tracking-widest uppercase',
    },
    color: {
      default: '',
      primary: 'text-primary',
      secondary: 'text-secondary-foreground',
      destructive: 'text-destructive drop-shadow-[0_0_5px_theme(colors.destructive.DEFAULT/40%)]',
      muted: 'text-muted-foreground',
    },
    align: {
      left: 'text-left',
      center: 'text-center',
      right: 'text-right',
      justify: 'text-justify',
    },
  },
  defaultVariants: {
    variant: 'p',
    color: 'default',
    align: 'left',
  },
});

export interface TypographyProps
  extends Omit<React.HTMLAttributes<HTMLElement>, 'color'>,
    VariantProps<typeof typographyVariants> {
  as?: React.ElementType;
  asChild?: boolean;
}

const Typography = React.forwardRef<HTMLElement, TypographyProps>(
  ({ className, variant, color, align, as, asChild, children, ...props }, ref) => {
    const Comp = asChild ? Slot.Root : as || getDefaultElement(variant);

    return (
      <Comp
        ref={ref}
        className={cn(typographyVariants({ variant, color, align, className }))}
        {...props}
      >
        {children}
      </Comp>
    );
  }
);
Typography.displayName = 'Typography';

function getDefaultElement(variant: VariantProps<typeof typographyVariants>['variant']) {
  switch (variant) {
    case 'h1': return 'h1';
    case 'h2': return 'h2';
    case 'h3': return 'h3';
    case 'h4': return 'h4';
    case 'blockquote': return 'blockquote';
    case 'list': return 'ul';
    case 'inlineCode': return 'code';
    case 'neon': return 'span';
    case 'lead':
    case 'large':
    case 'small':
    case 'muted':
    case 'p': 
    default: 
      return 'p';
  }
}

export { Typography, typographyVariants };
