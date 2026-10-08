'use client';

import * as React from 'react';
import { cn } from 'cn';
import {
  DropdownMenuContent,
  DropdownMenuRoot,
  DropdownMenuTrigger,
} from '../atoms/dropdown';

/** Saiku-style composition around the lower-level dropdown menu primitives. */
export interface DropdownMenuProps {
  trigger: React.ReactElement;
  children: React.ReactNode;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  side?: React.ComponentProps<typeof DropdownMenuContent>['side'];
  align?: React.ComponentProps<typeof DropdownMenuContent>['align'];
  sideOffset?: number;
  width?: string;
  className?: string;
}

export function DropdownMenu({
  trigger,
  children,
  side = 'bottom',
  align = 'end',
  sideOffset = 6,
  width = 'w-56',
  className,
  ...stateProps
}: DropdownMenuProps) {
  return (
    <DropdownMenuRoot {...stateProps}>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent
        side={side}
        align={align}
        sideOffset={sideOffset}
        className={cn(width, className)}
        role="menu"
      >
        {children}
      </DropdownMenuContent>
    </DropdownMenuRoot>
  );
}
