'use client';

import * as React from 'react';
import { cn } from 'cn';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../molecules/dialog';

const sizeClasses = {
  sm: 'sm:max-w-sm',
  md: 'sm:max-w-lg',
  lg: 'sm:max-w-2xl',
  xl: 'sm:max-w-4xl',
  full: 'sm:max-w-6xl',
} as const;

export type OlapModalSize = keyof typeof sizeClasses;

export interface OlapModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: OlapModalSize;
  className?: string;
  bodyClassName?: string;
  showCloseButton?: boolean;
}

/** Shared dialog shell for OLAP workflows. Business state stays with its caller. */
export function OlapModal({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  size = 'md',
  className,
  bodyClassName,
  showCloseButton = true,
}: OlapModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={showCloseButton}
        className={cn(
          'flex max-h-[calc(100dvh-2rem)] flex-col gap-0 overflow-hidden p-0',
          sizeClasses[size],
          className,
        )}
      >
        <DialogHeader className="shrink-0 border-b border-border px-6 py-4 pr-14">
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        <div className={cn('min-h-0 flex-1 overflow-y-auto px-6 py-5', bodyClassName)}>
          {children}
        </div>
        {footer ? (
          <DialogFooter className="mt-0 shrink-0 rounded-b-xl border-t border-border bg-muted/50 px-6 py-4">
            {footer}
          </DialogFooter>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
