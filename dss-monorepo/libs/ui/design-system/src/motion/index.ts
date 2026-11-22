'use client';

/*
 * GSAP lives behind this subpath (@dss-monorepo/design-system/motion) so it only
 * enters bundles of client components that animate.
 */
export { gsap, useGSAP, MOTION, prefersReducedMotion } from './gsap';
export { useCountUp } from './use-count-up';
export { useReveal, type RevealOptions } from './use-reveal';
