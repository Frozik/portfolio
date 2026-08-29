import { DEFAULT_ACCENT_RGB, HEX_COLOR_PATTERN, HEX_RADIX } from '../../../canvasTheme';
import type { TAccentAlpha } from './types';

export function readAccentRgb(): readonly [number, number, number] {
  if (typeof window === 'undefined') {
    return DEFAULT_ACCENT_RGB;
  }
  const raw = getComputedStyle(document.documentElement)
    .getPropertyValue('--color-landing-accent')
    .trim();
  const match = raw.match(HEX_COLOR_PATTERN);
  if (!match) {
    return DEFAULT_ACCENT_RGB;
  }
  return [
    Number.parseInt(match[1], HEX_RADIX),
    Number.parseInt(match[2], HEX_RADIX),
    Number.parseInt(match[3], HEX_RADIX),
  ];
}

/**
 * Deterministic pseudo-random in [0, 1) derived from two integer coordinates.
 * Used to keep heatmap / orderbook patterns stable across frames.
 */
export function pseudoRandom(x: number, y: number): number {
  const value = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return value - Math.floor(value);
}

export function buildAccentFn(rgb: readonly [number, number, number]): TAccentAlpha {
  return (alpha: number) => `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${alpha})`;
}
