import { LINE_INTERSECTION_MAX_DISTANCE } from './stereometry-constants';
import type { FigureTopology, IntersectionEntity, SceneState } from './stereometry-types';

/** Minimum denominator to consider lines non-parallel */
const PARALLEL_EPSILON = 1e-10;

/** Distance squared threshold to consider a point coincident with an existing vertex */
const VERTEX_COINCIDENCE_THRESHOLD_SQUARED = 0.001;

/** Distance squared threshold to consider two intersection points as duplicates */
const DUPLICATE_THRESHOLD_SQUARED = 0.0001;

/**
 * Computes all intersection points between lines and all edges/lines.
 *
 * Checks:
 * - Line ↔ line (infinite-infinite)
 * - Line ↔ segment (infinite-segment, intersection must lie on segment)
 *
 * Filters out intersections at existing topology vertices and duplicates.
 */
export function computeAllIntersections(
  scene: SceneState,
  topology: FigureTopology
): readonly IntersectionEntity[] {
  const lineEdgeIndices = scene.lines.map(line => line.edgeIndex);
  const lineSet = new Set(lineEdgeIndices);
  const results: IntersectionEntity[] = [];

  for (const lineIndex of lineEdgeIndices) {
    // Check against ALL edges
    for (let edgeIndex = 0; edgeIndex < topology.edges.length; edgeIndex++) {
      if (edgeIndex === lineIndex) {
        continue;
      }

      // Skip if both are extended and we'd compute the pair twice
      if (lineSet.has(edgeIndex) && edgeIndex < lineIndex) {
        continue;
      }

      const isOtherLine = lineSet.has(edgeIndex);
      const position = isOtherLine
        ? computeLineLineIntersection(lineIndex, edgeIndex, topology)
        : computeLineSegmentIntersection(lineIndex, edgeIndex, topology);

      if (position === undefined) {
        continue;
      }

      if (isNearExistingVertex(position, topology.vertices)) {
        continue;
      }

      if (
        isDuplicatePoint(
          position,
          results.map(result => result.position)
        )
      ) {
        continue;
      }

      results.push({
        position,
        sourceEdgeA: lineIndex,
        sourceEdgeB: edgeIndex,
      });
    }
  }

  return results;
}

/**
 * Intersection of two infinite lines (both extended).
 * Returns midpoint of closest approach if distance < threshold.
 */
function computeLineLineIntersection(
  edgeIndexA: number,
  edgeIndexB: number,
  topology: FigureTopology
): [number, number, number] | undefined {
  const lineA = getEdgeLine(edgeIndexA, topology);
  const lineB = getEdgeLine(edgeIndexB, topology);

  const closest = closestPointBetweenLines(
    lineA.point,
    lineA.direction,
    lineB.point,
    lineB.direction
  );

  if (closest === undefined) {
    return undefined;
  }

  return closest.midpoint;
}

/**
 * Intersection of an infinite line with a finite segment.
 * Returns midpoint only if the intersection lies within the segment's [0, 1] range.
 */
function computeLineSegmentIntersection(
  lineEdgeIndex: number,
  segmentEdgeIndex: number,
  topology: FigureTopology
): [number, number, number] | undefined {
  const line = getEdgeLine(lineEdgeIndex, topology);
  const segment = getEdgeLine(segmentEdgeIndex, topology);

  const closest = closestPointBetweenLines(
    line.point,
    line.direction,
    segment.point,
    segment.direction
  );

  if (closest === undefined) {
    return undefined;
  }

  // The segment parameter must be in [0, 1] for the intersection to lie on the segment
  if (closest.parameterB < 0 || closest.parameterB > 1) {
    return undefined;
  }

  return closest.midpoint;
}

interface EdgeLine {
  readonly point: readonly [number, number, number];
  readonly direction: readonly [number, number, number];
}

function getEdgeLine(edgeIndex: number, topology: FigureTopology): EdgeLine {
  const [vertexIndexA, vertexIndexB] = topology.edges[edgeIndex];
  const point = topology.vertices[vertexIndexA];
  const endPoint = topology.vertices[vertexIndexB];
  return {
    point,
    direction: [endPoint[0] - point[0], endPoint[1] - point[1], endPoint[2] - point[2]],
  };
}

interface ClosestPointResult {
  readonly midpoint: [number, number, number];
  readonly parameterA: number;
  readonly parameterB: number;
}

/**
 * Closest point between two lines: P + s*D and Q + t*E.
 * Returns midpoint of closest approach, plus parameters s and t.
 */
function closestPointBetweenLines(
  pointP: readonly [number, number, number],
  directionD: readonly [number, number, number],
  pointQ: readonly [number, number, number],
  directionE: readonly [number, number, number]
): ClosestPointResult | undefined {
  const dotDD = dot3(directionD, directionD);
  const dotDE = dot3(directionD, directionE);
  const dotEE = dot3(directionE, directionE);

  const denominator = dotDD * dotEE - dotDE * dotDE;

  if (Math.abs(denominator) < PARALLEL_EPSILON) {
    return undefined;
  }

  const w: readonly [number, number, number] = [
    pointP[0] - pointQ[0],
    pointP[1] - pointQ[1],
    pointP[2] - pointQ[2],
  ];
  const dotDW = dot3(directionD, w);
  const dotEW = dot3(directionE, w);

  const parameterA = (dotDE * dotEW - dotEE * dotDW) / denominator;
  const parameterB = (dotDD * dotEW - dotDE * dotDW) / denominator;

  const closestOnA: [number, number, number] = [
    pointP[0] + parameterA * directionD[0],
    pointP[1] + parameterA * directionD[1],
    pointP[2] + parameterA * directionD[2],
  ];

  const closestOnB: [number, number, number] = [
    pointQ[0] + parameterB * directionE[0],
    pointQ[1] + parameterB * directionE[1],
    pointQ[2] + parameterB * directionE[2],
  ];

  const distanceSquared =
    (closestOnA[0] - closestOnB[0]) ** 2 +
    (closestOnA[1] - closestOnB[1]) ** 2 +
    (closestOnA[2] - closestOnB[2]) ** 2;

  if (distanceSquared > LINE_INTERSECTION_MAX_DISTANCE ** 2) {
    return undefined;
  }

  return {
    midpoint: [
      (closestOnA[0] + closestOnB[0]) * 0.5,
      (closestOnA[1] + closestOnB[1]) * 0.5,
      (closestOnA[2] + closestOnB[2]) * 0.5,
    ],
    parameterA,
    parameterB,
  };
}

function isNearExistingVertex(
  point: readonly [number, number, number],
  vertices: readonly (readonly [number, number, number])[]
): boolean {
  for (const vertex of vertices) {
    const distanceSquared =
      (point[0] - vertex[0]) ** 2 + (point[1] - vertex[1]) ** 2 + (point[2] - vertex[2]) ** 2;

    if (distanceSquared < VERTEX_COINCIDENCE_THRESHOLD_SQUARED) {
      return true;
    }
  }
  return false;
}

function isDuplicatePoint(
  point: readonly [number, number, number],
  existing: readonly (readonly [number, number, number])[]
): boolean {
  for (const other of existing) {
    const distanceSquared =
      (point[0] - other[0]) ** 2 + (point[1] - other[1]) ** 2 + (point[2] - other[2]) ** 2;

    if (distanceSquared < DUPLICATE_THRESHOLD_SQUARED) {
      return true;
    }
  }
  return false;
}

function dot3(
  vectorA: readonly [number, number, number],
  vectorB: readonly [number, number, number]
): number {
  return vectorA[0] * vectorB[0] + vectorA[1] * vectorB[1] + vectorA[2] * vectorB[2];
}
