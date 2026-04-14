import { LINE_EXTENSION_LENGTH } from './constants';

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
 * Tests if a point is inside or on the surface of a convex polyhedron
 * defined by its triangulated faces. Uses ray casting — counts intersections
 * with face triangles along an arbitrary direction.
 */
export function isPointInsideOrOnSurface(
  point: Vec3,
  faceTriangles: readonly [number, number, number][],
  vertices: readonly Vec3[]
): boolean {
  // Cast ray in +X direction
  const rayDirection: Vec3 = [1, 0, 0];
  let intersectionCount = 0;

  for (const triangleIndices of faceTriangles) {
    const vertexA = vertices[triangleIndices[0]];
    const vertexB = vertices[triangleIndices[1]];
    const vertexC = vertices[triangleIndices[2]];

    const parameterT = rayTriangleIntersect(point, rayDirection, vertexA, vertexB, vertexC);

    if (parameterT !== undefined && parameterT > -RAY_EPSILON) {
      intersectionCount++;
    }
  }

  // Odd count = inside, even count = outside
  // parameterT >= ~0 also catches points ON the surface
  return intersectionCount % 2 === 1;
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

export function cross3(vectorA: Vec3, vectorB: Vec3): [number, number, number] {
  return [
    vectorA[1] * vectorB[2] - vectorA[2] * vectorB[1],
    vectorA[2] * vectorB[0] - vectorA[0] * vectorB[2],
    vectorA[0] * vectorB[1] - vectorA[1] * vectorB[0],
  ];
}

const RAY_EPSILON = 1e-6;

/**
 * Möller–Trumbore ray-triangle intersection.
 * Returns parametric t along the ray, or undefined if no intersection.
 */
export function rayTriangleIntersect(
  rayOrigin: Vec3,
  rayDirection: Vec3,
  vertexA: Vec3,
  vertexB: Vec3,
  vertexC: Vec3
): number | undefined {
  const edgeAB = [vertexB[0] - vertexA[0], vertexB[1] - vertexA[1], vertexB[2] - vertexA[2]];
  const edgeAC = [vertexC[0] - vertexA[0], vertexC[1] - vertexA[1], vertexC[2] - vertexA[2]];

  const pVecX = rayDirection[1] * edgeAC[2] - rayDirection[2] * edgeAC[1];
  const pVecY = rayDirection[2] * edgeAC[0] - rayDirection[0] * edgeAC[2];
  const pVecZ = rayDirection[0] * edgeAC[1] - rayDirection[1] * edgeAC[0];

  const determinant = edgeAB[0] * pVecX + edgeAB[1] * pVecY + edgeAB[2] * pVecZ;

  if (Math.abs(determinant) < RAY_EPSILON) {
    return undefined;
  }

  const inverseDeterminant = 1.0 / determinant;

  const tVecX = rayOrigin[0] - vertexA[0];
  const tVecY = rayOrigin[1] - vertexA[1];
  const tVecZ = rayOrigin[2] - vertexA[2];

  const barycentricU = (tVecX * pVecX + tVecY * pVecY + tVecZ * pVecZ) * inverseDeterminant;
  if (barycentricU < 0 || barycentricU > 1) {
    return undefined;
  }

  const qVecX = tVecY * edgeAB[2] - tVecZ * edgeAB[1];
  const qVecY = tVecZ * edgeAB[0] - tVecX * edgeAB[2];
  const qVecZ = tVecX * edgeAB[1] - tVecY * edgeAB[0];

  const barycentricV =
    (rayDirection[0] * qVecX + rayDirection[1] * qVecY + rayDirection[2] * qVecZ) *
    inverseDeterminant;
  if (barycentricV < 0 || barycentricU + barycentricV > 1) {
    return undefined;
  }

  return (edgeAC[0] * qVecX + edgeAC[1] * qVecY + edgeAC[2] * qVecZ) * inverseDeterminant;
}
