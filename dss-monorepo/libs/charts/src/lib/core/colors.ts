/** Converts CSS colors once per theme refresh, never during server rendering. */
let context: CanvasRenderingContext2D | null | undefined;
const cache = new Map<string, string>();

export function normalizeChartColor(color: string, fallback = '#172033'): string {
  const input = color.trim();
  if (/^#[\da-f]{3,8}$/i.test(input) && [4, 5, 7, 9].includes(input.length)) return input;
  // Already-normalized colors work in node/SSR without a canvas implementation.
  if (/^rgba?\([\d.,\s]+\)$/.test(input)) return input;
  const cached = cache.get(input);
  if (cached) return cached;
  if (typeof document === 'undefined' || !globalThis.CSS?.supports('color', input)) return fallback;
  if (context === undefined) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 1;
    context = canvas.getContext('2d', { willReadFrequently: true });
  }
  if (!context) return fallback;
  context.clearRect(0, 0, 1, 1);
  context.fillStyle = input;
  context.fillRect(0, 0, 1, 1);
  const [r, g, b, a] = context.getImageData(0, 0, 1, 1).data;
  const result = `rgba(${r}, ${g}, ${b}, ${a / 255})`;
  if (cache.size >= 128) cache.clear();
  cache.set(input, result);
  return result;
}

/** Multiplies existing alpha; accepts normalized HEX and RGB(A), including #RGBA. */
export function colorWithAlpha(color: string, opacity: number): string {
  const normalized = normalizeChartColor(color);
  const alpha = Number.isFinite(opacity) ? Math.max(0, Math.min(1, opacity)) : 1;
  if (normalized.startsWith('#')) {
    let hex = normalized.slice(1);
    if (hex.length <= 4) hex = [...hex].map((c) => c + c).join('');
    const channels = [0, 2, 4].map((offset) => parseInt(hex.slice(offset, offset + 2), 16));
    const originalAlpha = hex.length === 8 ? parseInt(hex.slice(6), 16) / 255 : 1;
    return `rgba(${channels.join(', ')}, ${originalAlpha * alpha})`;
  }
  const channels = normalized.match(/[\d.]+/g)?.map(Number) ?? [23, 32, 51];
  return `rgba(${channels.slice(0, 3).join(', ')}, ${(channels[3] ?? 1) * alpha})`;
}
