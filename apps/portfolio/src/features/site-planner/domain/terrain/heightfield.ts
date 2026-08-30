import type { Vector2 } from '@frozik/utils/math/vector2';
import { clamp } from 'lodash-es';

import type { BoundingBox } from '../geometry/bounding-box';
import type { Meters } from '../units';

/**
 * The sampled terrain: a square, axis-aligned grid of elevations covering the
 * plot's bounding box. Square rather than rectangular because the 3D stage
 * renders it as one grid mesh with a single cell size, and an isotropic cell
 * keeps slopes and contours free of directional bias.
 */
export interface Heightfield {
  /** Samples per side; the grid holds `resolution²` of them. */
  readonly resolution: number;
  /** Plan position of sample (0, 0) — the south-west corner of the grid. */
  readonly originMeters: Vector2;
  readonly cellSizeMeters: Meters;
  /** Row-major: sample (column, row) lives at `row * resolution + column`. */
  readonly heights: Float32Array;
}

/** Two samples per side is the coarsest grid that still spans an area. */
export const MIN_HEIGHTFIELD_RESOLUTION = 2;
/** Matches the ceiling the plan settings advertise; 512² floats is 1 MB. */
export const MAX_HEIGHTFIELD_RESOLUTION = 512;

/** A grid finer than this would resolve nothing the feature's ±10 cm needs. */
const MIN_CELL_SIZE_METERS: Meters = 0.001;

/**
 * A grid over `bounds` with at most `targetResolution` samples per side. The
 * longer side of the box decides the cell size, so the grid always covers the
 * whole box — over-covering the shorter side rather than cropping it.
 */
export function createHeightfieldForBounds(
  bounds: BoundingBox,
  targetResolution: number
): Heightfield {
  const resolution = Number.isFinite(targetResolution)
    ? clamp(Math.floor(targetResolution), MIN_HEIGHTFIELD_RESOLUTION, MAX_HEIGHTFIELD_RESOLUTION)
    : MIN_HEIGHTFIELD_RESOLUTION;
  const extent: Meters = Math.max(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY);
  const cellSizeMeters =
    Number.isFinite(extent) && extent > 0
      ? Math.max(extent / (resolution - 1), MIN_CELL_SIZE_METERS)
      : MIN_CELL_SIZE_METERS;

  return {
    resolution,
    originMeters: { x: bounds.minX, y: bounds.minY },
    cellSizeMeters,
    heights: new Float32Array(resolution * resolution),
  };
}

/** Lowest and highest sample of a grid; equal when the terrain is level. */
export interface ElevationRange {
  readonly minElevation: Meters;
  readonly maxElevation: Meters;
}

/**
 * The vertical extent of the sampled terrain — what the camera has to frame and
 * what the 3D view shades its height tint against.
 */
export function computeElevationRange(field: Heightfield): ElevationRange {
  const { heights } = field;

  if (heights.length === 0) {
    return { minElevation: 0, maxElevation: 0 };
  }

  let minElevation = heights[0];
  let maxElevation = heights[0];

  for (const elevation of heights) {
    minElevation = Math.min(minElevation, elevation);
    maxElevation = Math.max(maxElevation, elevation);
  }

  return { minElevation, maxElevation };
}

/** Plan position of a grid sample. */
export function samplePosition(field: Heightfield, column: number, row: number): Vector2 {
  return {
    x: field.originMeters.x + column * field.cellSizeMeters,
    y: field.originMeters.y + row * field.cellSizeMeters,
  };
}

/**
 * Bilinear elevation at a plan point. A point outside the grid is clamped to its
 * edge rather than extrapolated: the grid covers the plot, and objects nudged
 * past its border should stand on the nearest ground, not on a runaway slope.
 */
export function sampleHeight(field: Heightfield, x: Meters, y: Meters): Meters {
  const { resolution, originMeters, cellSizeMeters, heights } = field;
  const lastIndex = resolution - 1;
  const columnFloat = clamp((x - originMeters.x) / cellSizeMeters, 0, lastIndex);
  const rowFloat = clamp((y - originMeters.y) / cellSizeMeters, 0, lastIndex);
  const column = Math.min(Math.floor(columnFloat), lastIndex - 1);
  const row = Math.min(Math.floor(rowFloat), lastIndex - 1);
  const columnFraction = columnFloat - column;
  const rowFraction = rowFloat - row;

  const bottomLeft = heights[row * resolution + column];
  const bottomRight = heights[row * resolution + column + 1];
  const topLeft = heights[(row + 1) * resolution + column];
  const topRight = heights[(row + 1) * resolution + column + 1];

  const bottom = bottomLeft + (bottomRight - bottomLeft) * columnFraction;
  const top = topLeft + (topRight - topLeft) * columnFraction;

  return bottom + (top - bottom) * rowFraction;
}
