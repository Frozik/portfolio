import { LINE_EXTENSION_LENGTH } from './stereometry-constants';

export type Vec3 = readonly [number, number, number];

export function subtractVec3(vectorA: Vec3, vectorB: Vec3): [number, number, number] {
  return [vectorA[0] - vectorB[0], vectorA[1] - vectorB[1], vectorA[2] - vectorB[2]];
}

export function dot3(vectorA: Vec3, vectorB: Vec3): number {
  return vectorA[0] * vectorB[0] + vectorA[1] * vectorB[1] + vectorA[2] * vectorB[2];
}

export function distanceSquared3(pointA: Vec3, pointB: Vec3): number {
  return (pointA[0] - pointB[0]) ** 2 + (pointA[1] - pointB[1]) ** 2 + (pointA[2] - pointB[2]) ** 2;
}

export function lengthVec3(vector: Vec3): number {
  return Math.sqrt(vector[0] * vector[0] + vector[1] * vector[1] + vector[2] * vector[2]);
}

/**
 * Computes the normalized direction vector from positionA to positionB.
 * Returns undefined for degenerate zero-length segments.
 */
export function normalizeDirection(
  positionA: Vec3,
  positionB: Vec3
): [number, number, number] | undefined {
  const direction = subtractVec3(positionB, positionA);
  const length = lengthVec3(direction);

  if (length === 0) {
    return undefined;
  }

  return [direction[0] / length, direction[1] / length, direction[2] / length];
}

/**
 * Extends a line segment in both directions by LINE_EXTENSION_LENGTH.
 * Returns [farStart, farEnd]. For degenerate segments, returns the original positions.
 */
export function extendLine(
  positionA: Vec3,
  positionB: Vec3
): [[number, number, number], [number, number, number]] {
  const normalized = normalizeDirection(positionA, positionB);

  if (normalized === undefined) {
    return [
      [positionA[0], positionA[1], positionA[2]],
      [positionB[0], positionB[1], positionB[2]],
    ];
  }

  return [
    [
      positionA[0] - normalized[0] * LINE_EXTENSION_LENGTH,
      positionA[1] - normalized[1] * LINE_EXTENSION_LENGTH,
      positionA[2] - normalized[2] * LINE_EXTENSION_LENGTH,
    ],
    [
      positionB[0] + normalized[0] * LINE_EXTENSION_LENGTH,
      positionB[1] + normalized[1] * LINE_EXTENSION_LENGTH,
      positionB[2] + normalized[2] * LINE_EXTENSION_LENGTH,
    ],
  ];
}

/**
 * Extends a line segment into two halves that don't overlap the original segment.
 * Returns [beforeHalf, afterHalf]:
 *   beforeHalf: farStart → positionA
 *   afterHalf:  positionB → farEnd
 */
export function extendLineHalves(
  positionA: Vec3,
  positionB: Vec3
): [
  [number, number, number],
  [number, number, number],
  [number, number, number],
  [number, number, number],
] {
  const normalized = normalizeDirection(positionA, positionB);

  if (normalized === undefined) {
    return [
      [positionA[0], positionA[1], positionA[2]],
      [positionA[0], positionA[1], positionA[2]],
      [positionB[0], positionB[1], positionB[2]],
      [positionB[0], positionB[1], positionB[2]],
    ];
  }

  return [
    [
      positionA[0] - normalized[0] * LINE_EXTENSION_LENGTH,
      positionA[1] - normalized[1] * LINE_EXTENSION_LENGTH,
      positionA[2] - normalized[2] * LINE_EXTENSION_LENGTH,
    ],
    [positionA[0], positionA[1], positionA[2]],
    [positionB[0], positionB[1], positionB[2]],
    [
      positionB[0] + normalized[0] * LINE_EXTENSION_LENGTH,
      positionB[1] + normalized[1] * LINE_EXTENSION_LENGTH,
      positionB[2] + normalized[2] * LINE_EXTENSION_LENGTH,
    ],
  ];
}

/**
 * Checks if a point is within the given distance threshold of any point in the list.
 */
export function isNearAnyPoint(
  point: Vec3,
  points: readonly Vec3[],
  thresholdSquared: number
): boolean {
  for (const other of points) {
    if (distanceSquared3(point, other) < thresholdSquared) {
      return true;
    }
  }
  return false;
}
