'use client';

import { useRef, type RefObject } from 'react';
import { gsap, MOTION, prefersReducedMotion, useGSAP } from './gsap';

/**
 * Tweens a rendered number from its previous value to the new one.
 *
 * - The first paint shows the final value: there is no count-up on load.
 * - Text is written through the ref, so the tween causes no React renders.
 * - Under prefers-reduced-motion the value is set at once.
 *
 * Pair the animated node with `aria-hidden` and a visually hidden copy of the
 * final value, so screen readers never hear intermediate numbers.
 */
export function useCountUp(
  ref: RefObject<HTMLElement | null>,
  value: number | null | undefined,
  format: (value: number) => string,
): void {
  const previous = useRef<number | null>(null);
  const tween = useRef<gsap.core.Tween | null>(null);
  const formatRef = useRef(format);
  formatRef.current = format;

  useGSAP(
    () => {
      const element = ref.current;
      if (!element || value == null || !Number.isFinite(value)) {
        previous.current = null;
        return;
      }

      const from = previous.current ?? value;
      previous.current = value;
      if (from === value) return;

      tween.current?.kill();
      if (prefersReducedMotion()) {
        element.textContent = formatRef.current(value);
        return;
      }

      const state = { current: from };
      tween.current = gsap.to(state, {
        current: value,
        duration: MOTION.slow,
        ease: MOTION.easeOut,
        onUpdate: () => {
          element.textContent = formatRef.current(state.current);
        },
        onComplete: () => {
          element.textContent = formatRef.current(value);
        },
      });
    },
    { dependencies: [value], scope: ref },
  );
}
