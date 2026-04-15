import { vec3 } from 'wgpu-matrix';
import { LINE_INTERSECTION_MAX_DISTANCE } from './constants';
import type { Vec3 } from './math';
import { isNearAnyPoint } from './math';
import type { FigureTopology, IntersectionEntity, SceneState } from './types';

/** Minimum denominator to consider lines non-parallel */
const PARALLEL_EPSILON = 1e-10;

/** Distance squared threshold to consider a point coincident with an existing vertex */
const VERTEX_COINCIDENCE_THRESHOLD_SQUARED = 0.001;

/** Distance squared threshold to consider two intersection points as duplicates */
const DUPLICATE_THRESHOLD_SQUARED = 0.0001;

interface LineDefinition {
  readonly point: Vec3;
  readonly direction: Vec3;
}

/**
 * Computes all intersection points between all infinite lines in the scene
 * and between those lines and topology edge segments.
 *
 * Each SceneLine defines an infinite line through its pointA and pointB.
 *
 * Filters out intersections at existing topology vertices and duplicates.
 */
export function computeAllIntersections(
  scene: SceneState,
  topology: FigureTopology
): readonly IntersectionEntity[] {
  const allLines: LineDefinition[] = scene.lines.map(line => ({
    point: line.pointA,
    direction: vec3.sub(line.pointB, line.pointA),
  }));

  const results: IntersectionEntity[] = [];
  const resultPositions: Vec3[] = [];

  function tryAddIntersection(position: [number, number, number] | undefined): void {
    if (position === undefined) {
      return;
    }

    if (isNearAnyPoint(position, topology.vertices, VERTEX_COINCIDENCE_THRESHOLD_SQUARED)) {
      return;
    }

    if (isNearAnyPoint(position, resultPositions, DUPLICATE_THRESHOLD_SQUARED)) {
      return;
    }

    results.push({ position });
    resultPositions.push(position);
  }

  for (let indexA = 0; indexA < allLines.length; indexA++) {
    for (let indexB = indexA + 1; indexB < allLines.length; indexB++) {
      tryAddIntersection(computeLinePairIntersection(allLines[indexA], allLines[indexB]));
    }

    for (let edgeIndex = 0; edgeIndex < topology.edges.length; edgeIndex++) {
      tryAddIntersection(
        computeLineSegmentIntersection(allLines[indexA], getEdgeLine(edgeIndex, topology))
      );
    }
  }

  return results;
}

function computeLinePairIntersection(
  lineA: LineDefinition,
  lineB: LineDefinition
): [number, number, number] | undefined {
  return closestPointBetweenLines(lineA.point, lineA.direction, lineB.point, lineB.direction)
    ?.midpoint;
}

function computeLineSegmentIntersection(
  line: LineDefinition,
  segment: LineDefinition
): [number, number, number] | undefined {
  const closest = closestPointBetweenLines(
    line.point,
    line.direction,
    segment.point,
    segment.direction
  );

  if (closest === undefined || closest.parameterB < 0 || closest.parameterB > 1) {
    return undefined;
  }

  return closest.midpoint;
}

function getEdgeLine(edgeIndex: number, topology: FigureTopology): LineDefinition {
  const [vertexIndexA, vertexIndexB] = topology.edges[edgeIndex];
  const point = topology.vertices[vertexIndexA];
  const endPoint = topology.vertices[vertexIndexB];
  return { point, direction: vec3.sub(endPoint, point) };
}

interface ClosestPointResult {
  readonly midpoint: [number, number, number];
  readonly parameterB: number;
}

/**
 * Closest point between two lines: P + s*D and Q + t*E.
 * Returns midpoint of closest approach plus parameter t for the second line.
 */
function closestPointBetweenLines(
  pointP: Vec3,
  directionD: Vec3,
  pointQ: Vec3,
  directionE: Vec3
): ClosestPointResult | undefined {
  const dotDD = vec3.dot(directionD, directionD);
  const dotDE = vec3.dot(directionD, directionE);
  const dotEE = vec3.dot(directionE, directionE);
  const denominator = dotDD * dotEE - dotDE * dotDE;

  if (Math.abs(denominator) < PARALLEL_EPSILON) {
    return undefined;
  }

  const w = vec3.sub(pointP, pointQ);
  const dotDW = vec3.dot(directionD, w);
  const dotEW = vec3.dot(directionE, w);

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

  if (vec3.distSq(closestOnA, closestOnB) > LINE_INTERSECTION_MAX_DISTANCE ** 2) {
    return undefined;
  }

  return {
    midpoint: [
      (closestOnA[0] + closestOnB[0]) * 0.5,
      (closestOnA[1] + closestOnB[1]) * 0.5,
      (closestOnA[2] + closestOnB[2]) * 0.5,
    ],
    parameterB,
  };
}
