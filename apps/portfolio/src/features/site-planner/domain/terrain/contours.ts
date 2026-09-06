import type { Vector2 } from '@frozik/utils/math/vector2';

import type { Meters } from '../units';
import { JOIN_TOLERANCE_FACTOR, chainSegments } from './contour-chaining';
import type { ContourPolyline, ContourSegment } from './contour-types';
import type { Heightfield } from './heightfield';

/**
 * Ceiling on how many lines one plan may carry. A finer interval over a steeper
 * plot stops being a readable drawing long before this, and the cap is what
 * keeps a mistyped interval from freezing the editor.
 */
const MAX_CONTOUR_LEVELS = 200;

const NO_CONTOURS: readonly ContourPolyline[] = [];

const EDGE_BOTTOM = 0;

const EDGE_RIGHT = 1;

const EDGE_TOP = 2;

const EDGE_LEFT = 3;

/**
 * Marching-squares cases, indexed by which corners stand above the level:
 * bit 0 south-west, bit 1 south-east, bit 2 north-east, bit 3 north-west. Each
 * entry lists the cell edges a segment runs between; the two saddle cases (5 and
 * 10) are resolved from the cell's mean and are not in the table.
 */
const CASE_EDGES: readonly (readonly number[])[] = [
  [],
  [EDGE_LEFT, EDGE_BOTTOM],
  [EDGE_BOTTOM, EDGE_RIGHT],
  [EDGE_LEFT, EDGE_RIGHT],
  [EDGE_RIGHT, EDGE_TOP],
  [],
  [EDGE_BOTTOM, EDGE_TOP],
  [EDGE_LEFT, EDGE_TOP],
  [EDGE_TOP, EDGE_LEFT],
  [EDGE_TOP, EDGE_BOTTOM],
  [],
  [EDGE_TOP, EDGE_RIGHT],
  [EDGE_LEFT, EDGE_RIGHT],
  [EDGE_BOTTOM, EDGE_RIGHT],
  [EDGE_LEFT, EDGE_BOTTOM],
  [],
];

const SADDLE_CASE_LOW = 5;

const SADDLE_CASE_HIGH = 10;

/** The two ways a saddle can be cut, as the pair of segments each produces. */
const SADDLE_LOW_JOINED: readonly number[] = [EDGE_LEFT, EDGE_TOP, EDGE_BOTTOM, EDGE_RIGHT];

const SADDLE_LOW_SPLIT: readonly number[] = [EDGE_LEFT, EDGE_BOTTOM, EDGE_RIGHT, EDGE_TOP];

const SADDLE_HIGH_JOINED: readonly number[] = [EDGE_LEFT, EDGE_BOTTOM, EDGE_RIGHT, EDGE_TOP];

const SADDLE_HIGH_SPLIT: readonly number[] = [EDGE_BOTTOM, EDGE_RIGHT, EDGE_TOP, EDGE_LEFT];

const CELL_CORNER_COUNT = 4;

const SEGMENT_EDGE_COUNT = 2;

/** The four samples of one cell, named by compass corner. */
interface CellCorners {
  readonly southWest: Meters;
  readonly southEast: Meters;
  readonly northEast: Meters;
  readonly northWest: Meters;
}

/**
 * Traces the terrain into contour lines, one set per level of the interval.
 * Marching squares over the grid gives loose segments; joining them into chains
 * is what lets the plan stroke a continuous line and caption it once.
 */
export function buildContours(
  field: Heightfield,
  intervalMeters: Meters
): readonly ContourPolyline[] {
  if (!(intervalMeters > 0) || !Number.isFinite(intervalMeters)) {
    return NO_CONTOURS;
  }

  const { heights } = field;
  let minHeight = Number.POSITIVE_INFINITY;
  let maxHeight = Number.NEGATIVE_INFINITY;

  for (const height of heights) {
    minHeight = Math.min(minHeight, height);
    maxHeight = Math.max(maxHeight, height);
  }

  if (!Number.isFinite(minHeight) || !Number.isFinite(maxHeight)) {
    return NO_CONTOURS;
  }

  // Only levels strictly inside the range are traced: one that coincides with
  // the lowest or the highest sample would draw the plot's own outline.
  const firstIndex = Math.floor(minHeight / intervalMeters) + 1;
  const lastIndex = Math.ceil(maxHeight / intervalMeters) - 1;

  if (lastIndex < firstIndex || lastIndex - firstIndex + 1 > MAX_CONTOUR_LEVELS) {
    return NO_CONTOURS;
  }

  const contours: ContourPolyline[] = [];
  const joinTolerance = field.cellSizeMeters * JOIN_TOLERANCE_FACTOR;

  for (let index = firstIndex; index <= lastIndex; index += 1) {
    const level = index * intervalMeters;

    for (const points of chainSegments(traceLevel(field, level), joinTolerance)) {
      contours.push({ level, points });
    }
  }

  return contours;
}

function traceLevel(field: Heightfield, level: Meters): readonly ContourSegment[] {
  const { resolution, originMeters, cellSizeMeters, heights } = field;
  const segments: ContourSegment[] = [];

  for (let row = 0; row + 1 < resolution; row += 1) {
    for (let column = 0; column + 1 < resolution; column += 1) {
      const corners: CellCorners = {
        southWest: heights[row * resolution + column],
        southEast: heights[row * resolution + column + 1],
        northEast: heights[(row + 1) * resolution + column + 1],
        northWest: heights[(row + 1) * resolution + column],
      };
      const caseIndex =
        (corners.southWest > level ? 1 : 0) +
        (corners.southEast > level ? 2 : 0) +
        (corners.northEast > level ? 4 : 0) +
        (corners.northWest > level ? 8 : 0);
      const edges = resolveCaseEdges(caseIndex, corners, level);

      if (edges.length === 0) {
        continue;
      }

      const cellOrigin: Vector2 = {
        x: originMeters.x + column * cellSizeMeters,
        y: originMeters.y + row * cellSizeMeters,
      };

      for (let pair = 0; pair + SEGMENT_EDGE_COUNT <= edges.length; pair += SEGMENT_EDGE_COUNT) {
        segments.push({
          start: edgePoint(edges[pair], corners, level, cellOrigin, cellSizeMeters),
          end: edgePoint(edges[pair + 1], corners, level, cellOrigin, cellSizeMeters),
        });
      }
    }
  }

  return segments;
}

/**
 * A saddle cell can be cut two ways; the cell's mean decides which, the standard
 * disambiguation. Without it two contours of the same level would cross.
 */
function resolveCaseEdges(
  caseIndex: number,
  corners: CellCorners,
  level: Meters
): readonly number[] {
  if (caseIndex !== SADDLE_CASE_LOW && caseIndex !== SADDLE_CASE_HIGH) {
    return CASE_EDGES[caseIndex];
  }

  const isCenterAbove =
    (corners.southWest + corners.southEast + corners.northEast + corners.northWest) /
      CELL_CORNER_COUNT >
    level;

  if (caseIndex === SADDLE_CASE_LOW) {
    return isCenterAbove ? SADDLE_LOW_JOINED : SADDLE_LOW_SPLIT;
  }

  return isCenterAbove ? SADDLE_HIGH_JOINED : SADDLE_HIGH_SPLIT;
}

/**
 * Where the level crosses one edge of the cell. The two corners of that edge
 * always straddle the level — the case table only names edges that do — so the
 * division below can never be by zero.
 */
function edgePoint(
  edge: number,
  corners: CellCorners,
  level: Meters,
  cellOrigin: Vector2,
  cellSizeMeters: Meters
): Vector2 {
  switch (edge) {
    case EDGE_BOTTOM:
      return {
        x:
          cellOrigin.x +
          crossingFraction(corners.southWest, corners.southEast, level) * cellSizeMeters,
        y: cellOrigin.y,
      };
    case EDGE_TOP:
      return {
        x:
          cellOrigin.x +
          crossingFraction(corners.northWest, corners.northEast, level) * cellSizeMeters,
        y: cellOrigin.y + cellSizeMeters,
      };
    case EDGE_LEFT:
      return {
        x: cellOrigin.x,
        y:
          cellOrigin.y +
          crossingFraction(corners.southWest, corners.northWest, level) * cellSizeMeters,
      };
    default:
      return {
        x: cellOrigin.x + cellSizeMeters,
        y:
          cellOrigin.y +
          crossingFraction(corners.southEast, corners.northEast, level) * cellSizeMeters,
      };
  }
}

function crossingFraction(from: Meters, to: Meters, level: Meters): number {
  return (level - from) / (to - from);
}
