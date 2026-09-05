import type { TRgb } from '../../../../../../shared/lib/cssRgbToken';
import { readCssRgbToken } from '../../../../../../shared/lib/cssRgbToken';
import { ACCENT_TOKEN, DEFAULT_ACCENT_RGB } from '../../../canvasTheme';
import type { TAccentAlpha } from './types';

export function readAccentRgb(): TRgb {
  return readCssRgbToken(ACCENT_TOKEN, DEFAULT_ACCENT_RGB);
}

/**
 * Deterministic pseudo-random in [0, 1) derived from two integer coordinates.
 * Used to keep heatmap / orderbook patterns stable across frames.
 */
export function pseudoRandom(x: number, y: number): number {
  const value = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return value - Math.floor(value);
}

export function buildAccentFn(rgb: TRgb): TAccentAlpha {
  return (alpha: number) => `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${alpha})`;
}
