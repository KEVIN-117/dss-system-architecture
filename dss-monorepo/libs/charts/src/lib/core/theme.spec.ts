import { describe, it, expect, afterEach } from 'vitest';
import { colorWithAlpha, normalizeChartColor } from './colors';
import {
  resolveChartTheme,
  DEFAULT_DARK_THEME,
  DEFAULT_LIGHT_THEME,
  DARK_SEQUENTIAL_COLORS,
  LIGHT_SEQUENTIAL_COLORS,
  isDarkColor,
} from './theme';

afterEach(() => { document.body.innerHTML = ''; });

describe('Theme resolution', () => {
  it('reads the supplied local container and merges partial overrides', () => {
    const element = document.createElement('div');
    element.style.setProperty('--foreground', '#123456');
    element.style.setProperty('--primary', '#abcdef');
    element.style.setProperty('--chart-1', '#654321');
    document.body.append(element);
    const theme = resolveChartTheme(DEFAULT_DARK_THEME, element, { foreground: '#ffffff', riskColors: { high: '#ff0000' } });
    expect(theme.foreground).toBe('#ffffff');
    expect(theme.primary).toBe('#abcdef');
    expect(theme.chartColors[0]).toBe('#654321');
    expect(theme.riskColors.high).toBe('#ff0000');
    expect(theme.riskColors.none).toBe(DEFAULT_DARK_THEME.riskColors.none);
  });

  it('keeps fallbacks for missing variables and empty override palettes', () => {
    const theme = resolveChartTheme(DEFAULT_DARK_THEME, document.body, { chartColors: [] });
    expect(theme.chartColors).toEqual(DEFAULT_DARK_THEME.chartColors);
    expect(normalizeChartColor('not-a-color', '#000000')).toBe('#000000');
  });
});

describe('Mode-aware fallbacks', () => {
  it('fills undefined slots from the light palette on a light background', () => {
    const element = document.createElement('div');
    element.style.setProperty('--background', '#ffffff');
    document.body.append(element);
    const theme = resolveChartTheme(undefined, element);
    expect(theme.chartColors).toEqual(DEFAULT_LIGHT_THEME.chartColors);
    expect(theme.sequentialColors).toEqual(LIGHT_SEQUENTIAL_COLORS);
  });

  it('fills undefined slots from the dark palette on a dark background', () => {
    const element = document.createElement('div');
    element.style.setProperty('--background', '#060b14');
    document.body.append(element);
    const theme = resolveChartTheme(undefined, element);
    expect(theme.chartColors).toEqual(DEFAULT_DARK_THEME.chartColors);
    expect(theme.sequentialColors).toEqual(DARK_SEQUENTIAL_COLORS);
  });

  it('never borrows a categorical slot for a missing risk status', () => {
    const element = document.createElement('div');
    element.style.setProperty('--background', '#ffffff');
    element.style.setProperty('--chart-2', '#2a78d6');
    document.body.append(element);
    const theme = resolveChartTheme(undefined, element);
    expect(theme.riskColors.none).toBe(DEFAULT_LIGHT_THEME.riskColors.none);
  });

  it.each([
    ['#ffffff', false],
    ['#f5f9ff', false],
    ['#060b14', true],
    ['rgba(22, 25, 33, 1)', true],
  ])('classifies %s as dark=%s', (color, dark) => {
    expect(isDarkColor(color)).toBe(dark);
  });
});

describe('Color alpha', () => {
  it.each([
    ['#abc', 0.5, 'rgba(170, 187, 204, 0.5)'],
    ['#112233', 0, 'rgba(17, 34, 51, 0)'],
    ['#1230', 0.5, 'rgba(17, 34, 51, 0)'],
    ['rgba(10, 20, 30, 0.4)', 0.5, 'rgba(10, 20, 30, 0.2)'],
    ['rgb(10, 20, 30)', 2, 'rgba(10, 20, 30, 1)'],
  ])('applies opacity to %s without corrupting the CSS color', (color, opacity, result) => {
    expect(colorWithAlpha(color, opacity)).toBe(result);
  });
});
