'use client';

import { gsap } from 'gsap';
import { useGSAP } from '@gsap/react';

gsap.registerPlugin(useGSAP);

/**
 * Motion tokens mirrored from globals.css (--dur-*, --ease-out-expo) so GSAP
 * and CSS transitions share one rhythm. Portals are Operate surfaces: motion
 * only conveys a state change, and stays between 160 and 400 ms.
 */
export const MOTION = {
  fast: 0.16,
  base: 0.22,
  slow: 0.4,
  scene: 0.7,
  easeOut: 'expo.out',
  easeInOut: 'power3.inOut',
} as const;

export function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

export { gsap, useGSAP };
