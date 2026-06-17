/**
 * Shared canvas drawing theme for the welcome surfaces (hero orderbook +
 * project-card FX). Consolidates the color literals and mono-font stack that
 * were previously duplicated across the canvas/fx files so they stay in sync.
 */

export const MONO_FONT_STACK = 'ui-monospace, Menlo, Monaco, Consolas, monospace';

export const DARK_SURFACE_HEX = '#07090c';

const DARK_SURFACE_RGB: readonly [number, number, number] = [7, 9, 12];

export function darkSurface(alpha: number): string {
  return `rgba(${DARK_SURFACE_RGB[0]},${DARK_SURFACE_RGB[1]},${DARK_SURFACE_RGB[2]},${alpha})`;
}

export const DEFAULT_ACCENT_RGB: readonly [number, number, number] = [96, 165, 250];
export const DEFAULT_GREEN_RGB: readonly [number, number, number] = [76, 217, 100];
export const DEFAULT_RED_RGB: readonly [number, number, number] = [255, 79, 88];

export const HEX_COLOR_PATTERN = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i;
export const HEX_RADIX = 16;
