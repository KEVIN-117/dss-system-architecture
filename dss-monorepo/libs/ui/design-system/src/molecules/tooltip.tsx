'use client';

import * as React from 'react';
import {
  Tooltip as TooltipRoot,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../atoms/tooltip';

/** Compact hint composition matching Saiku UI's Tooltip wrapper. */
export interface TooltipProps {
  text?: React.ReactNode;
  delayMs?: number;
  side?: React.ComponentProps<typeof TooltipContent>['side'];
  children: React.ReactElement;
}

export function Tooltip({ text, delayMs = 300, side = 'top', children }: TooltipProps) {
  if (text == null || text === '') return children;

  return (
    <TooltipProvider delayDuration={delayMs}>
      <TooltipRoot>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        <TooltipContent side={side} sideOffset={6}>
          {text}
        </TooltipContent>
      </TooltipRoot>
    </TooltipProvider>
  );
}
