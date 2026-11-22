'use client';

/*
 * Page-level primitives shared by every portal (@dss-monorepo/design-system/page).
 * KpiCard animates with GSAP, so it is exported only from this subpath and
 * never from the root barrel.
 */
export { KpiCard, type KpiCardProps } from './molecules/kpi-card';
export * from './molecules/delta-badge';
export * from './molecules/page-header';
export * from './molecules/filter-bar';
export * from './molecules/native-select';
export * from './molecules/feedback';
export * from './molecules/chart-frame';
export * from './molecules/academic-context-badge';
export * from './hooks/use-async-resource';
