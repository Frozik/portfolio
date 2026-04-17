import { vec3 } from 'wgpu-matrix';
import type { Vec3Array } from './topology-types';

/**
 * Perpendicular distance tolerance for collinearity check.
 * Must accommodate wgpu-matrix's Float32 cross-product error on non-axis-aligned
 * directions — tighter values (e.g. 1e-8) give false negatives even for a point
 * that exactly coincides with a line endpoint.
 */
const COLLINEAR_THRESHOLD = 1e-5;

// Epsilon hierarchy:
// - VERTEX_MATCH_EPSILON_SQ (1e-10): vertex coincidence (point == point)
// - POINT_ON_LINE_EPSILON_SQ (1e-8): point-on-line test (looser due to projection error)
export const VERTEX_MATCH_EPSILON_SQ = 1e-10;
export const POINT_ON_LINE_EPSILON_SQ = 1e-8;

/** Endpoint tolerance for isPointOnSegment — looser than parametric epsilon to catch boundary points */
export const SEGMENT_ENDPOINT_TOLERANCE = 0.001;

export function positionsMatch(
  positionA: Vec3Array,
  positionB: Vec3Array,
  epsilonSquared = VERTEX_MATCH_EPSILON_SQ
): boolean {
  return vec3.distSq(positionA, positionB) < epsilonSquared;
}

/**
 * Projects a point onto the line (start → end) and returns the squared distance
 * from the point to its projection, plus the parametric t value.
 * Returns undefined for degenerate (zero-length) lines.
 */
export function projectPointOntoLine(
  point: Vec3Array,
  lineStart: Vec3Array,
  lineEnd: Vec3Array
): { parameter: number; distanceSquared: number } | undefined {
  const direction = vec3.sub(lineEnd, lineStart);
  const lengthSquared = vec3.dot(direction, direction);

  if (lengthSquared < VERTEX_MATCH_EPSILON_SQ) {
    return undefined;
  }

  const toPoint = vec3.sub(point, lineStart);
  const parameter = vec3.dot(toPoint, direction) / lengthSquared;
  const projection = vec3.addScaled(lineStart, direction, parameter);

  return { parameter, distanceSquared: vec3.distSq(point, projection) as number };
}

/** Checks if a point lies on an infinite line defined by two points. */
export function isPointOnInfiniteLine(
  point: Vec3Array,
  lineStart: Vec3Array,
  lineEnd: Vec3Array
): boolean {
  const result = projectPointOntoLine(point, lineStart, lineEnd);
  if (result === undefined) {
    return positionsMatch(point, lineStart);
  }
  return result.distanceSquared < POINT_ON_LINE_EPSILON_SQ;
}

/** Checks if a point lies on a finite segment defined by two endpoints. */
export function isPointOnSegment(
  point: Vec3Array,
  segmentStart: Vec3Array,
  segmentEnd: Vec3Array
): boolean {
  const result = projectPointOntoLine(point, segmentStart, segmentEnd);
  if (result === undefined) {
    return positionsMatch(point, segmentStart);
  }
  if (
    result.parameter < -SEGMENT_ENDPOINT_TOLERANCE ||
    result.parameter > 1 + SEGMENT_ENDPOINT_TOLERANCE
  ) {
    return false;
  }
  return result.distanceSquared < POINT_ON_LINE_EPSILON_SQ;
}

/**
 * Checks if two points (a line segment) are collinear with the infinite line through lineStart→lineEnd.
 */
export function isCollinearWithLine(
  pointA: Vec3Array,
  pointB: Vec3Array,
  lineStart: Vec3Array,
  lineEnd: Vec3Array
): boolean {
  const lineDir = vec3.sub(lineEnd, lineStart);
  const lineLength = vec3.len(lineDir);

  if (lineLength === 0) {
    return false;
  }

  const normalizedLineDir = vec3.normalize(lineDir);

  const toA = vec3.sub(pointA, lineStart);
  if (vec3.len(vec3.cross(normalizedLineDir, toA)) > COLLINEAR_THRESHOLD) {
    return false;
  }

  const toB = vec3.sub(pointB, lineStart);
  return vec3.len(vec3.cross(normalizedLineDir, toB)) <= COLLINEAR_THRESHOLD;
}
