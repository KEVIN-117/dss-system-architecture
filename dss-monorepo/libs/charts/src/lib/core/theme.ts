/**
 * Core Theme Tokens for Charts.
 * Decoupled from the application's CSS framework to ensure portability.
 * Incorporates the robust color palettes originally designed in saiku-ui.
 */
export interface ChartThemeTokens {
  /** Categorical color cycle for series (bars, pie slices, etc.) */
  chartColors: string[];
  destructive: string;
  background: string;
  foreground: string;
  mutedForeground: string;
  gridLine: string;
  /** Helper to apply opacity to hex colors */
  alpha: (hex: string, opacity: number) => string;
}

const hexWithAlpha = (hex: string, opacity: number): string => {
  const cleanHex = hex.replace('#', '');
  const alphaHex = Math.round(opacity * 255).toString(16).padStart(2, '0');
  return `#${cleanHex}${alphaHex}`;
};

/**
 * Categorical series palette from saiku-ui (Indigo-anchored defaults)
 */
export const CHART_FALLBACK_COLORS = [
  '#4f46e5', // indigo
  '#0ea5e9', // sky blue
  '#10b981', // emerald
  '#f59e0b', // amber
  '#ef4444', // red
  '#a855f7', // purple
  '#ec4899', // pink
  '#14b8a6'  // teal
];

/**
 * Okabe-Ito 8-color qualitative palette (Color-Blind Safe)
 */
export const COLORBLIND_SAFE_COLORS = [
  '#000000', // black
  '#e69f00', // orange
  '#56b4e9', // sky blue
  '#009e73', // bluish green
  '#f0e442', // yellow
  '#0072b2', // blue
  '#d55e00', // vermillion
  '#cc79a7'  // reddish purple
];

/**
 * Light theme maintaining the saiku-ui color scale.
 */
export const DEFAULT_LIGHT_THEME: ChartThemeTokens = {
  chartColors: CHART_FALLBACK_COLORS,
  destructive: '#ef4444',
  background: '#ffffff',
  foreground: '#0f172a',
  mutedForeground: '#475569',
  gridLine: '#e2e8f0',
  alpha: hexWithAlpha,
};

/**
 * Dark theme / Cyberpunk adjusting the contrast for dark backgrounds
 * while maintaining the vibrant categorical palette from saiku-ui.
 */
export const DEFAULT_DARK_THEME: ChartThemeTokens = {
  chartColors: CHART_FALLBACK_COLORS, // Same vibrant colors work well on dark
  destructive: '#ff003c',
  background: '#09090b',
  foreground: '#fafafa',
  mutedForeground: '#a1a1aa',
  gridLine: '#27272a',
  alpha: hexWithAlpha,
};
