import type { Vector2 } from '@frozik/utils/math/vector2';
import { isNil } from 'lodash-es';

import type { Meters } from '../units';
import type { Heightfield } from './heightfield';

/** One traced contour: a chain of plan points, all at the same elevation. */
export interface ContourPolyline {
  readonly level: Meters;
  readonly points: readonly Vector2[];
}

/** Where a level's caption goes on the plan. */
export interface ContourLabel {
  readonly level: Meters;
  readonly position: Vector2;
}

/**
 * Ceiling on how many lines one plan may carry. A finer interval over a steeper
 * plot stops being a readable drawing long before this, and the cap is what
 * keeps a mistyped interval from freezing the editor.
 */
const MAX_CONTOUR_LEVELS = 200;

/** Below three points a chain is a stub not worth captioning. */
const MIN_LABELLED_POINT_COUNT = 3;

/**
 * Tolerance for recognising the shared end of two segments, as a fraction of the
 * cell size. Neighbouring cells compute the point on their shared edge from the
 * same two samples, so the values agree to the last bit — the tolerance only
 * guards the arithmetic, and stays far below anything the drawing can resolve.
 */
const JOIN_TOLERANCE_FACTOR = 1e-4;

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

interface ContourSegment {
  readonly start: Vector2;
  readonly end: Vector2;
}

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

/**
 * One caption per level, at the middle of that level's longest chain — enough to
 * read the plan without stamping a number on every ridge.
 *
 * `isPositionLabellable` is what a caller drawing only part of the terrain hands
 * in: the chains are traced over the whole sampled grid, and a caption sitting on
 * the stretch of a line that is not drawn would name nothing.
 */
export function chooseContourLabels(
  contours: readonly ContourPolyline[],
  isPositionLabellable: (position: Vector2) => boolean = acceptAnyPosition
): readonly ContourLabel[] {
  const longestByLevel = new Map<Meters, ContourPolyline>();

  for (const contour of contours) {
    const current = longestByLevel.get(contour.level);

    if (isNil(current) || contour.points.length > current.points.length) {
      longestByLevel.set(contour.level, contour);
    }
  }

  const labels: ContourLabel[] = [];

  for (const contour of longestByLevel.values()) {
    if (contour.points.length < MIN_LABELLED_POINT_COUNT) {
      continue;
    }

    const position = chooseLabelPosition(contour.points, isPositionLabellable);

    if (!isNil(position)) {
      labels.push({ level: contour.level, position });
    }
  }

  return labels;
}

function acceptAnyPosition(): boolean {
  return true;
}

/**
 * The middle of the chain, or the accepted point nearest to it — walking out
 * from the middle in both directions keeps the caption as far from the ends of
 * the line as the chain allows. Nothing at all when the whole chain is refused.
 */
function chooseLabelPosition(
  points: readonly Vector2[],
  isPositionLabellable: (position: Vector2) => boolean
): Vector2 | undefined {
  const middle = Math.floor(points.length / 2);

  for (let offset = 0; offset < points.length; offset += 1) {
    const before = middle - offset;
    const after = middle + offset;

    if (before >= 0 && isPositionLabellable(points[before])) {
      return points[before];
    }

    if (after < points.length && isPositionLabellable(points[after])) {
      return points[after];
    }
  }

  return undefined;
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

/**
 * Joins loose segments into the longest chains they form. Every segment is used
 * exactly once, so a level made of several separate lines yields one chain each,
 * and a closed loop ends where it started.
 */
function chainSegments(
  segments: readonly ContourSegment[],
  joinTolerance: number
): readonly (readonly Vector2[])[] {
  const segmentsByEndpoint = new Map<string, number[]>();

  segments.forEach((segment, index) => {
    registerEndpoint(segmentsByEndpoint, pointKey(segment.start, joinTolerance), index);
    registerEndpoint(segmentsByEndpoint, pointKey(segment.end, joinTolerance), index);
  });

  const isUsed = new Uint8Array(segments.length);
  const chains: (readonly Vector2[])[] = [];

  segments.forEach((segment, index) => {
    if (isUsed[index] === 1) {
      return;
    }

    isUsed[index] = 1;

    const forward = extendChain(segments, segmentsByEndpoint, isUsed, segment.end, joinTolerance);
    const backward = extendChain(
      segments,
      segmentsByEndpoint,
      isUsed,
      segment.start,
      joinTolerance
    );

    chains.push([...backward.reverse(), segment.start, segment.end, ...forward]);
  });

  return chains;
}

/** Walks unused segments away from `from`, returning the points it passes. */
function extendChain(
  segments: readonly ContourSegment[],
  segmentsByEndpoint: ReadonlyMap<string, readonly number[]>,
  isUsed: Uint8Array,
  from: Vector2,
  joinTolerance: number
): Vector2[] {
  const points: Vector2[] = [];
  let currentKey = pointKey(from, joinTolerance);

  // Every step consumes one segment, so the walk cannot outlive the supply.
  for (let step = 0; step < segments.length; step += 1) {
    const candidates = segmentsByEndpoint.get(currentKey);
    const nextIndex = candidates?.find(candidate => isUsed[candidate] === 0);

    if (isNil(nextIndex)) {
      return points;
    }

    isUsed[nextIndex] = 1;

    const segment = segments[nextIndex];
    const next =
      pointKey(segment.start, joinTolerance) === currentKey ? segment.end : segment.start;

    points.push(next);
    currentKey = pointKey(next, joinTolerance);
  }

  return points;
}

function registerEndpoint(
  segmentsByEndpoint: Map<string, number[]>,
  key: string,
  index: number
): void {
  const existing = segmentsByEndpoint.get(key);

  if (isNil(existing)) {
    segmentsByEndpoint.set(key, [index]);

    return;
  }

  existing.push(index);
}

function pointKey(point: Vector2, joinTolerance: number): string {
  return `${Math.round(point.x / joinTolerance)}:${Math.round(point.y / joinTolerance)}`;
}
