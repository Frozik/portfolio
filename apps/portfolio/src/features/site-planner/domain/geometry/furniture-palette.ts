import type { Rgb } from './mesh-builder';

/**
 * The furniture palette, one hue per material the pieces are made of. Wood and
 * porcelain echo the plan's furniture/plumbing fills, so a piece reads as the
 * same object in 2D and 3D.
 */
export const WOOD: Rgb = [0.63, 0.48, 0.33];

export const WOOD_DARK: Rgb = [0.5, 0.37, 0.25];

export const FABRIC: Rgb = [0.45, 0.51, 0.62];

export const FABRIC_DARK: Rgb = [0.36, 0.41, 0.5];

export const LINEN: Rgb = [0.88, 0.88, 0.86];

export const PORCELAIN: Rgb = [0.91, 0.93, 0.95];

export const PORCELAIN_SHADE: Rgb = [0.78, 0.82, 0.86];

export const APPLIANCE: Rgb = [0.85, 0.86, 0.88];

export const APPLIANCE_DARK: Rgb = [0.2, 0.22, 0.26];

export const METAL: Rgb = [0.65, 0.68, 0.72];

export const GLASS: Rgb = [0.62, 0.76, 0.88];

export const WATER: Rgb = [0.55, 0.72, 0.85];

export const HALF = 0.5;

export const CYLINDER_SEGMENT_COUNT = 10;

export const FULL_TURN_RADIANS = 2 * Math.PI;

/** The catalogue box the model must fill, pre-halved where symmetry wants it. */
export interface PieceFrame {
  readonly halfWidth: number;
  readonly halfDepth: number;
  readonly height: number;
}
