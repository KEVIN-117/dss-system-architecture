'use client';

import * as React from 'react';
import {
  Popover as PopoverRoot,
  PopoverContent,
  PopoverTrigger,
} from '../atoms/popover';

/** Saiku-style popover composition: one trigger paired with one content panel. */
export interface PopoverProps {
  trigger: React.ReactElement;
  children: React.ReactNode;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  side?: React.ComponentProps<typeof PopoverContent>['side'];
  align?: React.ComponentProps<typeof PopoverContent>['align'];
  sideOffset?: number;
  className?: string;
}

export function Popover({
  trigger,
  children,
  side = 'bottom',
  align = 'center',
  sideOffset = 6,
  className,
  ...stateProps
}: PopoverProps) {
  return (
    <PopoverRoot {...stateProps}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent side={side} align={align} sideOffset={sideOffset} className={className}>
        {children}
      </PopoverContent>
    </PopoverRoot>
  );
}
