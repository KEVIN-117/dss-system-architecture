'use client';

import { cn } from 'cn';
import { ChevronDown, GraduationCap } from 'lucide-react';
import {
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuRoot,
  DropdownMenuTrigger,
} from '../atoms/dropdown';

export interface AcademicContext {
  id: string;
  /** Faculty or career the viewer acts on, e.g. "Ingeniería de Sistemas". */
  unit: string;
  /** Shown on narrow screens, e.g. "Sistemas". Defaults to `unit`. */
  shortUnit?: string;
  /** The unit's parent, shown in the selector, e.g. the faculty of a career. */
  parent?: string;
}

export interface AcademicContextBadgeProps {
  /** The viewer's role as people say it: "Decano", "Directora de carrera". */
  roleLabel: string;
  contexts: AcademicContext[];
  currentId: string;
  /** Current gestión, e.g. "2025". */
  gestion?: string;
  /** Required for a selector; without it several contexts render read-only. */
  onContextChange?: (id: string) => void;
  className?: string;
}

const PILL =
  'inline-flex h-9 max-w-full min-w-0 items-center gap-2 rounded-full border border-role-accent/40 bg-role-accent/12 pr-3 pl-2.5 text-xs whitespace-nowrap text-foreground';

/**
 * Header badge that tells decanos and directores where they are acting: role,
 * faculty or career, and gestión. With several assignments it becomes a
 * selector that drives the page's unit filter.
 */
export function AcademicContextBadge({
  roleLabel,
  contexts,
  currentId,
  gestion,
  onContextChange,
  className,
}: AcademicContextBadgeProps) {
  const current = contexts.find((context) => context.id === currentId) ?? contexts[0];
  if (!current) return null;

  const spoken = [
    `Contexto académico: ${roleLabel}`,
    current.unit,
    gestion ? `gestión ${gestion}` : null,
  ]
    .filter(Boolean)
    .join(', ');

  const content = (
    <>
      <GraduationCap aria-hidden="true" className="size-4 shrink-0 text-role-accent" />
      <span aria-hidden="true" className="hidden text-muted-foreground md:inline">
        {roleLabel}
      </span>
      <span aria-hidden="true" className="hidden text-muted-foreground/70 md:inline">
        ·
      </span>
      <span aria-hidden="true" className="hidden truncate font-semibold sm:inline">
        {current.unit}
      </span>
      <span aria-hidden="true" className="truncate font-semibold sm:hidden">
        {current.shortUnit ?? current.unit}
      </span>
      {gestion ? (
        <span
          aria-hidden="true"
          className="hidden border-l border-(--glass-border) pl-2 font-mono text-[0.6875rem] text-muted-foreground xl:inline"
        >
          Gestión {gestion}
        </span>
      ) : null}
    </>
  );

  if (contexts.length < 2 || !onContextChange) {
    return (
      <div
        role="note"
        aria-label={spoken}
        data-slot="academic-context-badge"
        className={cn('min-w-0', className)}
      >
        <span className={PILL}>{content}</span>
      </div>
    );
  }

  return (
    <DropdownMenuRoot>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`${spoken}. Cambiar contexto`}
          data-slot="academic-context-badge"
          className={cn(
            PILL,
            'group/context cursor-pointer transition-colors duration-(--dur-fast) hover:border-role-accent focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none',
            className,
          )}
        >
          {content}
          <ChevronDown
            aria-hidden="true"
            className="size-3.5 shrink-0 text-muted-foreground transition-transform duration-(--dur-base) group-data-[state=open]/context:rotate-180"
          />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} className="glass-overlay w-72">
        <DropdownMenuLabel className="font-mono text-[0.6875rem] tracking-[0.16em] text-muted-foreground uppercase">
          Tus contextos académicos
        </DropdownMenuLabel>
        <DropdownMenuRadioGroup value={current.id} onValueChange={onContextChange}>
          {contexts.map((context) => (
            <DropdownMenuRadioItem key={context.id} value={context.id} className="items-start py-2">
              <span className="flex min-w-0 flex-col">
                <span className="font-medium">{context.unit}</span>
                {context.parent ? (
                  <span className="text-xs text-muted-foreground">{context.parent}</span>
                ) : null}
              </span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenuRoot>
  );
}
