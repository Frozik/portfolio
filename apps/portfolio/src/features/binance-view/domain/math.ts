import type { Milliseconds } from '@frozik/utils/date/types';

import { TEXTURE_WIDTH_FALLBACK, TEXTURE_WIDTH_PREFERRED, Y_AXIS_PANEL_CSS_PX } from './constants';
import type { ITextureLayoutConfig, UnixTimeMs } from './types';

/**
 * Round a timestamp down to the start of its block.
 *
 * Block duration = `snapshotsPerBlock * updateSpeedMs`.
 */
export function floorToBlockStart(
  timestampMs: UnixTimeMs,
  snapshotsPerBlock: number,
  updateSpeedMs: Milliseconds
): UnixTimeMs {
  const blockDurationMs = snapshotsPerBlock * updateSpeedMs;
  return (Math.floor(timestampMs / blockDurationMs) * blockDurationMs) as UnixTimeMs;
}

export function lerp(from: number, to: number, t: number): number {
  return from + (to - from) * t;
}

/**
 * Width of the heatmap plot area in CSS pixels — the full canvas width
 * minus the right-hand Y-axis panel. Clamped to ≥ 1 so downstream
 * divisions never blow up when the canvas is narrower than the panel.
 */
export function plotWidthCssPx(canvasClientWidthCss: number): number {
  return Math.max(1, canvasClientWidthCss - Y_AXIS_PANEL_CSS_PX);
}

/**
 * Same as {@link plotWidthCssPx} but in device pixels — used when the
 * shader needs the plot width in the same units as `viewport.x`.
 */
export function plotWidthDevicePx(canvasDeviceWidthPx: number, devicePixelRatio: number): number {
  return Math.max(1, canvasDeviceWidthPx - Y_AXIS_PANEL_CSS_PX * devicePixelRatio);
}

/**
 * Pick the texture layout based on the adapter's `maxTextureDimension2D`.
 *
 * Preferred: 16384 wide × 1 row/block. Fallback: 8192 wide × 2 rows/block.
 */
export function getTextureLayoutConfig(supportedMaxDimension2D: number): ITextureLayoutConfig {
  if (supportedMaxDimension2D >= TEXTURE_WIDTH_PREFERRED) {
    return { textureWidth: TEXTURE_WIDTH_PREFERRED, rowsPerBlock: 1, snapshotsPerRow: 128 };
  }
  return { textureWidth: TEXTURE_WIDTH_FALLBACK, rowsPerBlock: 2, snapshotsPerRow: 64 };
}
