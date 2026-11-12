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
  /**
   * One-hue magnitude ramp, ordered low → high value. Light mode runs
   * light → dark; dark mode flips the anchor so low values recede into the
   * dark surface. Optional for compatibility with existing token objects.
   */
  sequentialColors?: string[];
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

/**
 * Light-mode categorical palette (tokens.css :root --chart-1..8).
 *
 * The slot ORDER is the colour-blind-safety mechanism: it was chosen by
 * enumerating orderings and keeping only those whose adjacent pairs stay
 * distinguishable under protan/deutan simulation (OKLab ΔE ≥ 9.2) and under
 * normal vision (ΔE ≥ 19.6) on both the light (#fdfcfb) and dark (#161921)
 * surfaces. The first three slots also pass all-pairs (scatter, maps).
 * Do not reorder, cycle or insert hues without re-running the validation.
 * Aqua, yellow and magenta sit below 3:1 on the light surface, so charts
 * that rely on them must also offer direct labels, textures or a table.
 */
export const LIGHT_CHART_COLORS: string[] = [
  '#b0182a', // --chart-1  saiku red (brand)
  '#2a78d6', // --chart-2  blue
  '#1baf7a', // --chart-3  aqua
  '#eb6834', // --chart-4  orange
  '#6250d6', // --chart-5  violet
  '#eda100', // --chart-6  yellow
  '#e87ba4', // --chart-7  magenta
  '#008300', // --chart-8  green
];

/** Dark-mode steps of the same eight hues, validated against #161921. */
export const DARK_CHART_COLORS: string[] = [
  '#ef5a6b', // --chart-1  saiku red (brand)
  '#3987e5', // --chart-2  blue
  '#199e70', // --chart-3  aqua
  '#d95926', // --chart-4  orange
  '#9085e9', // --chart-5  violet
  '#c98500', // --chart-6  yellow
  '#d55181', // --chart-7  magenta
  '#008300', // --chart-8  green
];

/** Single-hue blue magnitude ramp (low → high) for light surfaces. */
export const LIGHT_SEQUENTIAL_COLORS: string[] = [
  '#cde2fb', '#9ec5f4', '#6da7ec', '#3987e5', '#256abf', '#184f95', '#0d366b',
];

/** Same ramp with the anchor flipped for dark surfaces (low → high). */
export const DARK_SEQUENTIAL_COLORS: string[] = [
  '#0d366b', '#184f95', '#256abf', '#3987e5', '#6da7ec', '#9ec5f4', '#cde2fb',
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
  sequentialColors: LIGHT_SEQUENTIAL_COLORS,
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
  sequentialColors: DARK_SEQUENTIAL_COLORS,
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
 * When no fallback is passed, the light or dark defaults are chosen from the
 * luminance of the resolved `--background`, so variables a stylesheet leaves
 * undefined never mix dark-mode colours into a light page (or vice versa).
 * Without a document (SSR, workers) it falls back to DEFAULT_DARK_THEME.
 */
export function resolveChartTheme(
  fallback?: ChartThemeTokens,
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
  if (!fallback) {
    const background = cs
      ? get('--background', get('--bg', ''))
      : '';
    fallback = background && isDarkColor(background) ? DEFAULT_DARK_THEME
      : background ? DEFAULT_LIGHT_THEME : DEFAULT_DARK_THEME;
  }
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
      // Risk is a status, never a series colour: fall back to the status
      // defaults rather than borrowing a categorical slot.
      medium: get('--warning', fallback.riskColors.medium),
      none: get('--success', fallback.riskColors.none),
    },
    sequentialColors: fallback.sequentialColors ?? (fallback === DEFAULT_LIGHT_THEME ? LIGHT_SEQUENTIAL_COLORS : DARK_SEQUENTIAL_COLORS),
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
    sequentialColors: (merged.sequentialColors?.length ? merged.sequentialColors : cssTheme.sequentialColors ?? [])
      .map((color, i) => normalizeChartColor(color, cssTheme.sequentialColors?.[i] ?? color)),
  };
}

/** WCAG relative luminance of a resolved hex/rgb(a) colour, or undefined. */
export function relativeLuminance(color: string): number | undefined {
  const normalized = normalizeChartColor(color, '');
  let channels: number[] | undefined;
  if (normalized.startsWith('#')) {
    let hex = normalized.slice(1);
    if (hex.length <= 4) hex = [...hex].map((c) => c + c).join('');
    channels = [0, 2, 4].map((offset) => parseInt(hex.slice(offset, offset + 2), 16));
  } else {
    channels = normalized.match(/[\d.]+/g)?.slice(0, 3).map(Number);
  }
  if (!channels || channels.length < 3 || channels.some((c) => !Number.isFinite(c))) return undefined;
  const [r, g, b] = channels.map((c) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** True when a resolved hex/rgb(a) colour has WCAG relative luminance < 0.2. */
export function isDarkColor(color: string): boolean {
  const luminance = relativeLuminance(color);
  return luminance !== undefined && luminance < 0.2;
}

const LIGHT_INK = '#ffffff';
const DARK_INK = '#0b0b0b';

/**
 * Text colour for a label drawn INSIDE a filled mark: whichever of white or
 * near-black ink has the higher WCAG contrast against that fill. Series
 * colours never become text colours; this only picks the ink.
 */
export function labelInkFor(fill: string): string {
  const luminance = relativeLuminance(fill);
  if (luminance === undefined) return DARK_INK;
  const dark = relativeLuminance(DARK_INK) ?? 0;
  const onWhite = 1.05 / (luminance + 0.05);
  const onDark = (luminance + 0.05) / (dark + 0.05);
  return onWhite >= onDark ? LIGHT_INK : DARK_INK;
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
