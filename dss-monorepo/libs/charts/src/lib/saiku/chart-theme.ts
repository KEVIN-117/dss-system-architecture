import { DEFAULT_DARK_THEME, type ChartThemeTokens } from '../core/theme';

export interface ThemeTokens {
  fg: string;
  fgMuted: string;
  bg: string;
  bgMuted: string;
  border: string;
  accent: string;
  chartColors: string[];
  highContrast?: boolean;
  positive?: string;
  danger?: string;
  sequentialRamp?: string[];
}

export function resolvePalette(_id: string | undefined, tokens: ThemeTokens): string[] {
	// The design-system chart tokens are the single categorical palette source.
	// Legacy palette ids remain accepted so saved Saiku chart configs still load.
	return tokens.chartColors;
}

export const DEFAULT_THEME_TOKENS: ThemeTokens = {
  fg: DEFAULT_DARK_THEME.foreground,
  fgMuted: DEFAULT_DARK_THEME.mutedForeground,
  bg: DEFAULT_DARK_THEME.background,
  bgMuted: DEFAULT_DARK_THEME.gridLine,
  border: DEFAULT_DARK_THEME.gridLine,
  accent: DEFAULT_DARK_THEME.primary ?? DEFAULT_DARK_THEME.chartColors[0],
  chartColors: DEFAULT_DARK_THEME.chartColors,
  positive: DEFAULT_DARK_THEME.riskColors.none,
  danger: DEFAULT_DARK_THEME.riskColors.high,
  sequentialRamp: [
    DEFAULT_DARK_THEME.alpha(DEFAULT_DARK_THEME.background, 0.12),
    DEFAULT_DARK_THEME.alpha(DEFAULT_DARK_THEME.primary ?? DEFAULT_DARK_THEME.chartColors[0], 0.36),
    DEFAULT_DARK_THEME.alpha(DEFAULT_DARK_THEME.primary ?? DEFAULT_DARK_THEME.chartColors[0], 0.68),
    DEFAULT_DARK_THEME.primary ?? DEFAULT_DARK_THEME.chartColors[0],
  ],
};

export function toSaikuTheme(tokens: ChartThemeTokens): ThemeTokens {
  const accent = tokens.primary ?? tokens.chartColors[0] ?? DEFAULT_THEME_TOKENS.accent;
  return {
    fg: tokens.foreground,
    fgMuted: tokens.mutedForeground,
    bg: tokens.background,
    bgMuted: tokens.gridLine,
    border: tokens.gridLine,
    accent,
    chartColors: tokens.chartColors,
    positive: tokens.riskColors.none,
    danger: tokens.riskColors.high,
    sequentialRamp: [
      tokens.alpha(tokens.background, 0.12),
      tokens.alpha(accent, 0.36),
      tokens.alpha(accent, 0.68),
      accent,
    ],
  };
}

export function applyColorBlindSafe(tokens: ThemeTokens, enabled: boolean): ThemeTokens {
  return enabled
    ? { ...tokens, highContrast: true }
    : tokens;
}
