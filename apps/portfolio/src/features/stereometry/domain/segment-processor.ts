import type { Vec3 } from './math';
import {
  cross3,
  dot3,
  extendLine,
  isPointInsideOrOnSurface,
  lengthVec3,
  rayTriangleIntersect,
  subtractVec3,
} from './math';
import type { FigureTopology, ProcessedSegment, SceneLine } from './types';

const COLLINEAR_THRESHOLD = 1e-8;
const POSITION_EPSILON = 1e-6;
const COPLANAR_DISTANCE_THRESHOLD = 1e-4;

export function processSegments(
  topology: FigureTopology,
  lines: readonly SceneLine[]
): readonly ProcessedSegment[] {
  const results: ProcessedSegment[] = [];

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const segments = processLine(lines[lineIndex], lineIndex, topology);
    results.push(...segments);
  }

  return results;
}

function processLine(
  line: SceneLine,
  lineIndex: number,
  topology: FigureTopology
): readonly ProcessedSegment[] {
  const [farStart, farEnd] = extendLine(line.pointA, line.pointB);
  const lineDirection = subtractVec3(farEnd, farStart);
  const lineLength = lengthVec3(lineDirection);

  if (lineLength === 0) {
    return [];
  }

  const normalizedDirection: Vec3 = [
    lineDirection[0] / lineLength,
    lineDirection[1] / lineLength,
    lineDirection[2] / lineLength,
  ];

  // Find collinear topology edges (line lies along an edge)
  const collinearEdges = findCollinearEdges(line, topology, normalizedDirection);

  // Collect face intersection parameters as split points (not paired intervals).
  // Pairing breaks when a ray passes through a shared vertex and only some
  // triangles report the intersection, producing an odd count.
  const faceIntersectionParams = findFaceIntersectionParams(
    farStart,
    normalizedDirection,
    lineLength,
    topology
  );

  // Coplanar face intervals (line lies on a face)
  const coplanarIntervals = findCoplanarFaceIntervals(
    farStart,
    normalizedDirection,
    lineLength,
    topology
  );

  // Collect collinear edge intervals (these become 'segment' modifier)
  const segmentIntervals = collinearEdges.map(edgeIndex => {
    const [vertexIndexA, vertexIndexB] = topology.edges[edgeIndex];
    const paramA = projectOntoLine(
      topology.vertices[vertexIndexA],
      farStart,
      normalizedDirection,
      lineLength
    );
    const paramB = projectOntoLine(
      topology.vertices[vertexIndexB],
      farStart,
      normalizedDirection,
      lineLength
    );
    return { start: Math.min(paramA, paramB), end: Math.max(paramA, paramB) };
  });

  // Build all split points from face intersections, coplanar intervals,
  // segment intervals, original line endpoints, and extended line endpoints
  const pointAParam = projectOntoLine(line.pointA, farStart, normalizedDirection, lineLength);
  const pointBParam = projectOntoLine(line.pointB, farStart, normalizedDirection, lineLength);

  const splitParams = new Set<number>();
  splitParams.add(0);
  splitParams.add(1);
  splitParams.add(pointAParam);
  splitParams.add(pointBParam);

  for (const parameter of faceIntersectionParams) {
    splitParams.add(parameter);
  }
  for (const interval of coplanarIntervals) {
    splitParams.add(interval.start);
    splitParams.add(interval.end);
  }
  for (const interval of segmentIntervals) {
    splitParams.add(interval.start);
    splitParams.add(interval.end);
  }

  const sortedParams = [...splitParams].sort((paramA, paramB) => paramA - paramB);
  const dedupedParams = deduplicateParameters(sortedParams);

  // Merge coplanar intervals for quick lookup
  const mergedCoplanarIntervals = mergeIntervals(coplanarIntervals);

  // Classify each sub-segment
  const results: ProcessedSegment[] = [];

  for (let index = 0; index < dedupedParams.length - 1; index++) {
    const startParam = dedupedParams[index];
    const endParam = dedupedParams[index + 1];

    if (endParam - startParam < POSITION_EPSILON) {
      continue;
    }

    const midParam = (startParam + endParam) / 2;

    const startPosition = paramToPosition(startParam, farStart, normalizedDirection, lineLength);
    const endPosition = paramToPosition(endParam, farStart, normalizedDirection, lineLength);

    // Check if midpoint is on a collinear edge → 'segment'
    if (isInAnyInterval(midParam, segmentIntervals)) {
      results.push({ startPosition, endPosition, modifier: 'segment', sourceLineIndex: lineIndex });
      continue;
    }

    // Check if midpoint is in a coplanar face region → 'inner'
    if (isInAnyInterval(midParam, mergedCoplanarIntervals)) {
      results.push({ startPosition, endPosition, modifier: 'inner', sourceLineIndex: lineIndex });
      continue;
    }

    // Test midpoint against the closed figure to determine inside/outside
    const midpoint = paramToPosition(midParam, farStart, normalizedDirection, lineLength);
    const isInner = isPointInsideOrOnSurface(midpoint, topology.faceTriangles, topology.vertices);
    results.push({
      startPosition,
      endPosition,
      modifier: isInner ? 'inner' : undefined,
      sourceLineIndex: lineIndex,
    });
  }

  return results;
}

function projectOntoLine(
  point: Vec3,
  farStart: Vec3,
  normalizedDirection: Vec3,
  lineLength: number
): number {
  return dot3(subtractVec3(point, farStart), normalizedDirection) / lineLength;
}

function paramToPosition(
  parameter: number,
  farStart: Vec3,
  normalizedDirection: Vec3,
  lineLength: number
): Vec3 {
  const distance = parameter * lineLength;
  return [
    farStart[0] + normalizedDirection[0] * distance,
    farStart[1] + normalizedDirection[1] * distance,
    farStart[2] + normalizedDirection[2] * distance,
  ];
}

function isInAnyInterval(
  parameter: number,
  intervals: readonly { start: number; end: number }[]
): boolean {
  for (const interval of intervals) {
    if (
      parameter > interval.start + POSITION_EPSILON &&
      parameter < interval.end - POSITION_EPSILON
    ) {
      return true;
    }
  }
  return false;
}

// --- Collinear edge detection ---

function findCollinearEdges(
  line: SceneLine,
  topology: FigureTopology,
  normalizedLineDirection: Vec3
): readonly number[] {
  const collinearEdges: number[] = [];

  for (let edgeIndex = 0; edgeIndex < topology.edges.length; edgeIndex++) {
    const [vertexIndexA, vertexIndexB] = topology.edges[edgeIndex];
    const edgeStart = topology.vertices[vertexIndexA];
    const edgeEnd = topology.vertices[vertexIndexB];
    const edgeDirection = subtractVec3(edgeEnd, edgeStart);
    const edgeLength = lengthVec3(edgeDirection);

    if (edgeLength === 0) {
      continue;
    }

    const normalizedEdgeDirection: Vec3 = [
      edgeDirection[0] / edgeLength,
      edgeDirection[1] / edgeLength,
      edgeDirection[2] / edgeLength,
    ];

    const crossProduct = cross3(normalizedLineDirection, normalizedEdgeDirection);
    if (lengthVec3(crossProduct) > COLLINEAR_THRESHOLD) {
      continue;
    }

    const toEdge = subtractVec3(edgeStart, line.pointA);
    const crossToEdge = cross3(normalizedLineDirection, toEdge);
    if (lengthVec3(crossToEdge) < COLLINEAR_THRESHOLD) {
      collinearEdges.push(edgeIndex);
    }
  }

  return collinearEdges;
}

// --- Face intersection split points (line pierces through faces) ---

/**
 * Returns normalized parameters where the line intersects face triangles.
 * These are used as split points; the actual inside/outside classification
 * is done by testing each sub-segment's midpoint with isPointInsideOrOnSurface.
 */
function findFaceIntersectionParams(
  farStart: Vec3,
  normalizedDirection: Vec3,
  lineLength: number,
  topology: FigureTopology
): readonly number[] {
  const parameters: number[] = [];

  for (const triangleIndices of topology.faceTriangles) {
    const vertexA = topology.vertices[triangleIndices[0]];
    const vertexB = topology.vertices[triangleIndices[1]];
    const vertexC = topology.vertices[triangleIndices[2]];

    const parameterT = rayTriangleIntersect(
      farStart,
      normalizedDirection,
      vertexA,
      vertexB,
      vertexC
    );

    if (parameterT !== undefined && parameterT > 0) {
      const normalizedParameter = parameterT / lineLength;
      if (
        normalizedParameter > POSITION_EPSILON &&
        normalizedParameter < 1 - POSITION_EPSILON &&
        !isDuplicateParameter(normalizedParameter, parameters)
      ) {
        parameters.push(normalizedParameter);
      }
    }
  }

  return parameters;
}

// --- Coplanar face intervals (line lies on a face) ---

function findCoplanarFaceIntervals(
  farStart: Vec3,
  normalizedDirection: Vec3,
  lineLength: number,
  topology: FigureTopology
): readonly { start: number; end: number }[] {
  const intervals: { start: number; end: number }[] = [];

  for (let faceIndex = 0; faceIndex < topology.faces.length; faceIndex++) {
    const faceVertexIndices = topology.faces[faceIndex];
    if (faceVertexIndices.length < 3) {
      continue;
    }

    const faceVertices = faceVertexIndices.map(index => topology.vertices[index]);

    // Compute face normal and plane distance
    const edgeAB = subtractVec3(faceVertices[1], faceVertices[0]);
    const edgeAC = subtractVec3(faceVertices[2], faceVertices[0]);
    const faceNormal = cross3(edgeAB, edgeAC);
    const normalLength = lengthVec3(faceNormal);

    if (normalLength < POSITION_EPSILON) {
      continue;
    }

    const unitNormal: Vec3 = [
      faceNormal[0] / normalLength,
      faceNormal[1] / normalLength,
      faceNormal[2] / normalLength,
    ];

    // Check if line direction is perpendicular to face normal (parallel to face)
    if (Math.abs(dot3(normalizedDirection, unitNormal)) > COPLANAR_DISTANCE_THRESHOLD) {
      continue;
    }

    // Check if the line lies on the face plane (distance from farStart to plane ≈ 0)
    const distanceToPlane = dot3(subtractVec3(farStart, faceVertices[0]), unitNormal);
    if (Math.abs(distanceToPlane) > COPLANAR_DISTANCE_THRESHOLD) {
      continue;
    }

    // Line is coplanar with this face — clip against the face polygon
    const interval = clipLineToConvexPolygon(
      farStart,
      normalizedDirection,
      lineLength,
      faceVertices
    );

    if (interval !== undefined) {
      intervals.push(interval);
    }
  }

  return intervals;
}

/**
 * Clips an infinite line to a convex polygon, returning the parametric interval
 * of the line that lies inside the polygon. Returns undefined if no intersection.
 */
function clipLineToConvexPolygon(
  farStart: Vec3,
  normalizedDirection: Vec3,
  lineLength: number,
  polygonVertices: readonly Vec3[]
): { start: number; end: number } | undefined {
  let tMin = 0;
  let tMax = 1;

  // Compute face normal once (CCW winding → outward normal)
  const faceEdgeAB = subtractVec3(polygonVertices[1], polygonVertices[0]);
  const faceEdgeAC = subtractVec3(polygonVertices[2], polygonVertices[0]);
  const faceNormal = cross3(faceEdgeAB, faceEdgeAC);

  for (let index = 0; index < polygonVertices.length; index++) {
    const nextIndex = (index + 1) % polygonVertices.length;
    const edgeStart = polygonVertices[index];
    const edgeEnd = polygonVertices[nextIndex];
    const edgeDir = subtractVec3(edgeEnd, edgeStart);

    // Inward-facing normal: cross(faceNormal, edgeDir) points inward for CCW-wound faces
    const inwardNormal = cross3(faceNormal, edgeDir);
    const inwardLength = lengthVec3(inwardNormal);

    if (inwardLength < POSITION_EPSILON) {
      continue;
    }

    const unitInward: Vec3 = [
      inwardNormal[0] / inwardLength,
      inwardNormal[1] / inwardLength,
      inwardNormal[2] / inwardLength,
    ];

    const startOffset = dot3(subtractVec3(farStart, edgeStart), unitInward);
    const directionDot = dot3(normalizedDirection, unitInward) * lineLength;

    if (Math.abs(directionDot) < POSITION_EPSILON) {
      if (startOffset < -POSITION_EPSILON) {
        return undefined;
      }
      continue;
    }

    const tEdge = -startOffset / directionDot;

    if (directionDot < 0) {
      tMax = Math.min(tMax, tEdge);
    } else {
      tMin = Math.max(tMin, tEdge);
    }

    if (tMin > tMax) {
      return undefined;
    }
  }

  if (tMax - tMin < POSITION_EPSILON) {
    return undefined;
  }

  return { start: tMin, end: tMax };
}

// --- Utilities ---

function isDuplicateParameter(parameter: number, existing: readonly number[]): boolean {
  for (const existingParam of existing) {
    if (Math.abs(parameter - existingParam) < POSITION_EPSILON) {
      return true;
    }
  }
  return false;
}

function deduplicateParameters(sortedParams: readonly number[]): readonly number[] {
  const result: number[] = [];

  for (const parameter of sortedParams) {
    if (result.length === 0 || Math.abs(parameter - result[result.length - 1]) > POSITION_EPSILON) {
      result.push(parameter);
    }
  }

  return result;
}

function mergeIntervals(
  intervals: readonly { start: number; end: number }[]
): readonly { start: number; end: number }[] {
  if (intervals.length === 0) {
    return [];
  }

  const sorted = [...intervals].sort((intervalA, intervalB) => intervalA.start - intervalB.start);
  const merged: { start: number; end: number }[] = [sorted[0]];

  for (let index = 1; index < sorted.length; index++) {
    const current = sorted[index];
    const previous = merged[merged.length - 1];

    if (current.start <= previous.end + POSITION_EPSILON) {
      merged[merged.length - 1] = {
        start: previous.start,
        end: Math.max(previous.end, current.end),
      };
    } else {
      merged.push(current);
    }
  }

  return merged;
}
