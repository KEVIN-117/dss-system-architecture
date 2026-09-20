import { colorWithAlpha, normalizeChartColor } from './colors';

/**
 * Chart Theme Tokens — centralized color system for @dss-monorepo/charts.
 *
 * Architecture:
 *   DSS Design System CSS variables (source of truth)
 *       ↓  getComputedStyle()
 *   resolveChartTheme() → ChartThemeTokens (resolved hex/rgb)
 *       ↓
 *   Pure builders (buildBarOption, etc.)
 *
 * ECharts Canvas cannot evaluate CSS var() references. Every color
 * passed to a builder must be a resolved string (hex, rgb, hsl).
 * resolveChartTheme() bridges that gap at runtime. The static
 * DEFAULT_*_THEME constants serve as fallbacks for SSR / Vitest /
 * Storybook initial render — legacy fallbacks are retained for API compatibility.
 */

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

export interface ChartThemeTokens {
  /** DSS role accent; optional for compatibility with existing token objects. */
  primary?: string;
  /** Categorical series palette (--chart-1..8 resolved) */
  chartColors: string[];
  /** Primary text color (--text-primary / --fg) */
  foreground: string;
  /** Secondary text color (--text-muted / --fg-subtle) */
  mutedForeground: string;
  /** Page background (--page / --bg) */
  background: string;
  /** Grid / split lines (--border-subtle / --border) */
  gridLine: string;
  /** Destructive / error accent (--error-action / --danger) */
  destructive: string;
  /** Semantic risk level colors */
  riskColors: { high: string; medium: string; none: string };
  /** Apply alpha to any resolved color string */
  alpha: (color: string, opacity: number) => string;
}

// ---------------------------------------------------------------------------
// Alpha helper
// ---------------------------------------------------------------------------

/**
 * Appends an alpha channel to a hex color.
 * Handles 3-char (#abc), 6-char (#aabbcc) and pass-through for non-hex.
 */
/** @deprecated Historical name; now handles normalized RGB/HSL/OKLCH too. */
export const hexWithAlpha = colorWithAlpha;

export type ChartThemeOverrides = Partial<Omit<ChartThemeTokens, 'riskColors'>> & {
  riskColors?: Partial<ChartThemeTokens['riskColors']>;
};

// ---------------------------------------------------------------------------
// Static fallbacks — values copied from tokens.css
// ---------------------------------------------------------------------------

/** Light-mode chart series colors (tokens.css :root --chart-1..8) */
export const LIGHT_CHART_COLORS: string[] = [
  '#b0182a', // --chart-1  saiku red
  '#0ea5e9', // --chart-2  sky
  '#10b981', // --chart-3  emerald
  '#f59e0b', // --chart-4  amber
  '#a855f7', // --chart-5  purple
  '#ec4899', // --chart-6  pink
  '#14b8a6', // --chart-7  teal
  '#6366f1', // --chart-8  indigo
];

/** Dark-mode chart series colors (tokens.css [data-theme='dark'] --chart-1..8) */
export const DARK_CHART_COLORS: string[] = [
  '#ef5a6b', // --chart-1
  '#38bdf8', // --chart-2
  '#34d399', // --chart-3
  '#fbbf24', // --chart-4
  '#c084fc', // --chart-5
  '#f472b6', // --chart-6
  '#2dd4bf', // --chart-7
  '#818cf8', // --chart-8
];

/**
 * Okabe-Ito 8-color qualitative palette — color-blind safe.
 * Consumers can swap this in via themeTokens.chartColors for accessible charts.
 */
export const COLORBLIND_SAFE_COLORS: string[] = [
  '#000000',
  '#e69f00',
  '#56b4e9',
  '#009e73',
  '#f0e442',
  '#0072b2',
  '#d55e00',
  '#cc79a7',
];

// ---------------------------------------------------------------------------
// Static theme objects (SSR / test fallbacks)
// ---------------------------------------------------------------------------

/** Fallback for light mode — aligned with tokens.css :root values. */
export const DEFAULT_LIGHT_THEME: ChartThemeTokens = {
  chartColors: LIGHT_CHART_COLORS,
  foreground: hslToHex(20, 16, 12), // --neutral-900 (clay)  ≈ #1a1410
  mutedForeground: hslToHex(28, 10, 46), // --neutral-500 (clay) ≈ #796b5f
  background: hslToHex(36, 24, 99), // --neutral-25 (clay)   ≈ #fdfcfb
  gridLine: hslToHex(36, 18, 84), // --neutral-200 (clay)  ≈ #ddd6cd
  destructive: hslToHex(0, 75, 50), // --error-500 (rose)    ≈ #df2020
  riskColors: {
    high: hslToHex(0, 75, 50), // --error-500
    medium: hslToHex(32, 90, 44), // --warning-500
    none: hslToHex(158, 64, 38), // --success-500
  },
  alpha: hexWithAlpha,
};

/** Fallback for dark mode — aligned with tokens.css [data-theme='dark']. */
export const DEFAULT_DARK_THEME: ChartThemeTokens = {
  chartColors: DARK_CHART_COLORS,
  foreground: hslToHex(220, 15, 99), // --slate-25      ≈ #fcfcfd
  mutedForeground: hslToHex(220, 10, 50), // --slate-400 ≈ #737d8c
  background: hslToHex(220, 15, 10), // --slate-900      ≈ #161921
  gridLine: hslToHex(220, 13, 22), // --slate-700      ≈ #313845
  destructive: hslToHex(0, 72, 82), // --error-200      ≈ #f1a0a0
  riskColors: {
    high: hslToHex(0, 72, 82), // --error-200 (dark uses lighter tint)
    medium: hslToHex(32, 80, 76), // --warning-200
    none: hslToHex(158, 55, 76), // --success-200
  },
  alpha: hexWithAlpha,
};

// ---------------------------------------------------------------------------
// Runtime resolver
// ---------------------------------------------------------------------------

/**
 * Reads the live CSS custom properties from :root and returns a fully
 * resolved ChartThemeTokens. Call this client-side after the DOM has
 * the design-system stylesheet loaded.
 *
 * Falls back to DEFAULT_DARK_THEME when no document is available.
 */
export function resolveChartTheme(
  fallback: ChartThemeTokens = DEFAULT_DARK_THEME,
  element?: HTMLElement,
  overrides?: ChartThemeOverrides,
): ChartThemeTokens {
  const target = element ?? (typeof document === 'undefined' ? undefined : document.documentElement);
  const cs = target ? getComputedStyle(target) : undefined;
  const get = (name: string, fb: string): string => {
    let raw = cs?.getPropertyValue(name).trim();
    if (!raw) return fb;
    if (/^-?[\d.]+\s+[\d.]+%\s+[\d.]+%/.test(raw)) raw = 'hsl(' + raw + ')';
    return normalizeChartColor(raw, fb);
  };
  const chartColors = fallback.chartColors.map((color, i) => get('--chart-' + (i + 1), color));
  const cssTheme: ChartThemeTokens = {
    primary: get('--primary', fallback.primary ?? chartColors[0]),
    chartColors,
    foreground: get('--foreground', get('--fg', fallback.foreground)),
    mutedForeground: get('--muted-foreground', get('--fg-subtle', fallback.mutedForeground)),
    background: get('--background', get('--bg', fallback.background)),
    gridLine: get('--border', fallback.gridLine),
    destructive: get('--destructive', get('--danger', fallback.destructive)),
    riskColors: {
      high: get('--destructive', get('--danger', fallback.riskColors.high)),
      medium: get('--warning', get('--chart-4', fallback.riskColors.medium)),
      none: get('--success', get('--chart-2', fallback.riskColors.none)),
    },
    alpha: colorWithAlpha,
  };
  const merged = { ...cssTheme, ...overrides,
    chartColors: overrides?.chartColors?.length ? overrides.chartColors : cssTheme.chartColors,
    riskColors: { ...cssTheme.riskColors, ...overrides?.riskColors },
  };
  return {
    ...merged,
    primary: normalizeChartColor(merged.primary ?? chartColors[0], cssTheme.primary),
    chartColors: merged.chartColors.map((color, i) => normalizeChartColor(color, chartColors[i % chartColors.length])),
    foreground: normalizeChartColor(merged.foreground, cssTheme.foreground),
    mutedForeground: normalizeChartColor(merged.mutedForeground, cssTheme.mutedForeground),
    background: normalizeChartColor(merged.background, cssTheme.background),
    gridLine: normalizeChartColor(merged.gridLine, cssTheme.gridLine),
    destructive: normalizeChartColor(merged.destructive, cssTheme.destructive),
    riskColors: {
      high: normalizeChartColor(merged.riskColors.high, cssTheme.riskColors.high),
      medium: normalizeChartColor(merged.riskColors.medium, cssTheme.riskColors.medium),
      none: normalizeChartColor(merged.riskColors.none, cssTheme.riskColors.none),
    },
  };
}

// ---------------------------------------------------------------------------
// HSL → Hex utility (used only for static fallbacks above)
// ---------------------------------------------------------------------------

/** Convert HSL (deg, %, %) to a 6-digit hex string. */
function hslToHex(h: number, s: number, l: number): string {
  const sN = s / 100;
  const lN = l / 100;
  const a = sN * Math.min(lN, 1 - lN);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = lN - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color)
      .toString(16)
      .padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}
