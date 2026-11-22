import * as React from 'react';
import { cn } from 'cn';

export interface PageHeaderProps
  extends Omit<React.HTMLAttributes<HTMLElement>, 'title'> {
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Section label above the title. Keep it for pages that already show one. */
  eyebrow?: React.ReactNode;
  /** Breadcrumb element rendered above everything else. */
  breadcrumb?: React.ReactNode;
  /** Buttons and links aligned to the end; put at most one `brand` button here. */
  actions?: React.ReactNode;
  /** Small status line next to the actions, e.g. "Actualizado hoy, 08:42". */
  meta?: React.ReactNode;
  headingLevel?: 'h1' | 'h2';
}

/** The one page header every portal page uses. */
export function PageHeader({
  title,
  description,
  eyebrow,
  breadcrumb,
  actions,
  meta,
  headingLevel = 'h1',
  className,
  ...props
}: PageHeaderProps) {
  const Heading = headingLevel;
  return (
    <header
      data-slot="page-header"
      className={cn('flex flex-col gap-3', className)}
      {...props}
    >
      {breadcrumb}
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <div className="min-w-0 flex-[1_1_22rem]">
          {eyebrow ? (
            <p className="mb-2 font-mono text-[0.6875rem] leading-4 tracking-[0.18em] text-muted-foreground uppercase">
              {eyebrow}
            </p>
          ) : null}
          <Heading className="font-heading text-2xl leading-tight font-semibold tracking-tight text-balance">
            {title}
          </Heading>
          {description ? (
            <p className="mt-2 max-w-[62ch] text-sm text-muted-foreground">
              {description}
            </p>
          ) : null}
        </div>
        {actions || meta ? (
          <div className="flex flex-wrap items-center gap-2">
            {meta ? (
              <span className="mr-1 text-xs text-muted-foreground">{meta}</span>
            ) : null}
            {actions}
          </div>
        ) : null}
      </div>
    </header>
  );
}

export interface PageContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  width?: 'default' | 'narrow';
}

/** Shared page width and vertical rhythm; the template already pads the edges. */
export function PageContainer({
  width = 'default',
  className,
  ...props
}: PageContainerProps) {
  return (
    <div
      data-slot="page-container"
      className={cn(
        'mx-auto flex w-full min-w-0 flex-col gap-6 lg:gap-8',
        width === 'default' ? 'max-w-[1600px]' : 'max-w-5xl',
        className,
      )}
      {...props}
    />
  );
}
