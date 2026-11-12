import type { ChartThemeTokens } from './theme';

/** ECharts decal pattern; mirrors `DecalObject` without importing ECharts internals. */
export interface ChartDecal {
  symbol: 'rect';
  symbolSize: number;
  color: string;
  dashArrayX: number[];
  dashArrayY: number[];
  rotation: number;
}

const DIAGONAL = Math.PI / 4;
/** Stripe thickness / gap per slot: dense-thin, dense-thick, sparse-thin, sparse-thick. */
const STRIPES: Array<[number, number]> = [
  [1, 3],
  [1, 3],
  [2, 4],
  [2, 4],
  [1, 6],
  [1, 6],
  [3, 6],
  [3, 6],
];

/**
 * Secondary encoding for colour-blind, print and forced-colours readers:
 * one directional line fill at 45° and its 135° mirror only, inked in the
 * surface colour so it reads as a texture rather than a new colour. Slots
 * alternate direction and step stripe density so adjacent series differ
 * even when their hues collapse. Order matches the categorical palette.
 */
export function buildChartDecals(theme: ChartThemeTokens): ChartDecal[] {
  const ink = theme.alpha(theme.background, 0.55);
  return STRIPES.map(([thickness, gap], index) => ({
    symbol: 'rect',
    symbolSize: 1,
    color: ink,
    dashArrayX: [1, 0],
    dashArrayY: [thickness, gap],
    rotation: index % 2 === 0 ? DIAGONAL : -DIAGONAL,
  }));
}
