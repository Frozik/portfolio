import { clamp } from 'lodash-es';

import type { Meters } from '../units';
import type { Heightfield } from './heightfield';

/**
 * Steepness is read in per cent of rise over run — the unit every site drawing
 * and every building rule quotes, and the one the legend is captioned in.
 *
 * The two thresholds are the ones landscaping practice settles on: below the
 * first the ground builds and drains as if it were level, above the second it
 * needs terracing or retaining rather than grading.
 */
export const GENTLE_SLOPE_PERCENT = 5;
export const STEEP_SLOPE_PERCENT = 12;

const PERCENT_SCALE = 100;

/** The run of a central difference can never be shorter than one cell. */
const MIN_SLOPE_RUN_METERS: Meters = 0.001;

/** Ground falling less steeply than this is level as far as water is concerned. */
const MIN_FLOW_GRADIENT = 1e-6;

/**
 * Where water leaves a sample: the step towards the neighbour it runs to, in
 * grid indices. `columnStep` runs east and `rowStep` runs north, so the pair is
 * also a plan-space direction.
 */
export interface FlowDirection {
  readonly columnStep: number;
  readonly rowStep: number;
}

/** The eight neighbours D8 chooses between, in no significant order. */
const D8_NEIGHBOURS: readonly FlowDirection[] = [
  { columnStep: 1, rowStep: 0 },
  { columnStep: 1, rowStep: 1 },
  { columnStep: 0, rowStep: 1 },
  { columnStep: -1, rowStep: 1 },
  { columnStep: -1, rowStep: 0 },
  { columnStep: -1, rowStep: -1 },
  { columnStep: 0, rowStep: -1 },
  { columnStep: 1, rowStep: -1 },
];

/**
 * Steepness at one grid sample, in per cent.
 *
 * Central differences over the neighbouring samples, the same estimator the
 * terrain shader shades its normals with — the shaded relief in 3D and the
 * slope colours over it are then two readings of one surface rather than two
 * surfaces. At the border the run shortens to the single cell that exists
 * instead of reaching past the edge.
 */
export function computeSlopePercent(field: Heightfield, column: number, row: number): number {
  const { resolution, cellSizeMeters } = field;
  const lastIndex = resolution - 1;
  const east = clamp(column + 1, 0, lastIndex);
  const west = clamp(column - 1, 0, lastIndex);
  const north = clamp(row + 1, 0, lastIndex);
  const south = clamp(row - 1, 0, lastIndex);
  const eastwardRun = Math.max((east - west) * cellSizeMeters, MIN_SLOPE_RUN_METERS);
  const northwardRun = Math.max((north - south) * cellSizeMeters, MIN_SLOPE_RUN_METERS);
  const eastwardSlope =
    (elevationAt(field, east, row) - elevationAt(field, west, row)) / eastwardRun;
  const northwardSlope =
    (elevationAt(field, column, north) - elevationAt(field, column, south)) / northwardRun;

  return Math.hypot(eastwardSlope, northwardSlope) * PERCENT_SCALE;
}

/**
 * Which way water runs off a sample, by the D8 rule: of the eight neighbours,
 * the one the ground falls towards most steeply — the drop divided by the
 * distance to it, so a diagonal is not favoured for being further away.
 *
 * Nothing at all on level ground or at the bottom of a hollow: water leaves
 * neither, and an arrow drawn there would invent a direction the terrain does
 * not have.
 */
export function computeFlowDirection(
  field: Heightfield,
  column: number,
  row: number
): FlowDirection | undefined {
  const { resolution, cellSizeMeters } = field;
  const lastIndex = resolution - 1;
  const elevation = elevationAt(field, column, row);

  let steepestNeighbour: FlowDirection | undefined;
  let steepestGradient = MIN_FLOW_GRADIENT;

  for (const neighbour of D8_NEIGHBOURS) {
    const neighbourColumn = column + neighbour.columnStep;
    const neighbourRow = row + neighbour.rowStep;

    if (
      neighbourColumn < 0 ||
      neighbourColumn > lastIndex ||
      neighbourRow < 0 ||
      neighbourRow > lastIndex
    ) {
      continue;
    }

    const distance = Math.hypot(neighbour.columnStep, neighbour.rowStep) * cellSizeMeters;
    const gradient =
      (elevation - elevationAt(field, neighbourColumn, neighbourRow)) /
      Math.max(distance, MIN_SLOPE_RUN_METERS);

    if (gradient > steepestGradient) {
      steepestGradient = gradient;
      steepestNeighbour = neighbour;
    }
  }

  return steepestNeighbour;
}

function elevationAt(field: Heightfield, column: number, row: number): Meters {
  return field.heights[row * field.resolution + column];
}
