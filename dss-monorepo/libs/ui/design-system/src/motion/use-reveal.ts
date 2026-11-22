'use client';

import { useRef, type RefObject } from 'react';
import { gsap, MOTION, prefersReducedMotion, useGSAP } from './gsap';

export interface RevealOptions {
  /** Reveal once this turns true (usually "data arrived"). Defaults to true. */
  when?: boolean;
  /** Elements to reveal inside the scope. */
  selector?: string;
  /** Delay between items, in seconds. */
  stagger?: number;
  /** Maximum number of items animated; the rest appear at once. */
  limit?: number;
}

/**
 * One staggered fade-and-rise the first time content arrives. It never runs
 * again on refetch, so filters and refreshes don't replay an entrance. Items
 * start from their visible resting state if GSAP or motion is unavailable.
 */
export function useReveal(
  scope: RefObject<HTMLElement | null>,
  {
    when = true,
    selector = '[data-reveal]',
    stagger = 0.04,
    limit = 8,
  }: RevealOptions = {},
): void {
  const done = useRef(false);

  useGSAP(
    () => {
      if (!when || done.current || !scope.current) return;
      done.current = true;
      if (prefersReducedMotion()) return;

      const items = gsap.utils
        .toArray<HTMLElement>(selector, scope.current)
        .slice(0, limit);
      if (items.length === 0) return;

      gsap.from(items, {
        y: 8,
        opacity: 0,
        duration: MOTION.base,
        ease: MOTION.easeOut,
        stagger,
        clearProps: 'transform,opacity',
      });
    },
    { dependencies: [when], scope },
  );
}
