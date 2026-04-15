import type { Vec3Arg } from 'wgpu-matrix';
import { vec3 } from 'wgpu-matrix';
import { LINE_EXTENSION_LENGTH } from './constants';

export type Vec3 = readonly [number, number, number];

/**
 * Extends a line segment in both directions by LINE_EXTENSION_LENGTH.
 * Returns [farStart, farEnd]. For degenerate segments, returns the original positions.
 */
export function extendLine(
  positionA: Vec3,
  positionB: Vec3
): [[number, number, number], [number, number, number]] {
  const direction = vec3.sub(positionB, positionA);
  const length = vec3.len(direction);

  if (length === 0) {
    return [
      [positionA[0], positionA[1], positionA[2]],
      [positionB[0], positionB[1], positionB[2]],
    ];
  }

  const normalized = vec3.scale(direction, 1 / length);

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
 * Tests if a point lies on the surface of a triangle using
 * distance-to-plane + barycentric coordinate checks with epsilon tolerance.
 * More robust than ray casting for points exactly on face boundaries.
 */
function isPointOnTriangle(point: Vec3, vertexA: Vec3, vertexB: Vec3, vertexC: Vec3): boolean {
  const edgeAB = vec3.sub(vertexB, vertexA);
  const edgeAC = vec3.sub(vertexC, vertexA);
  const normal = vec3.cross(edgeAB, edgeAC);
  const normalLength = vec3.len(normal);

  if (normalLength < SURFACE_EPSILON) {
    return false;
  }

  const distanceToPlane = Math.abs(vec3.dot(vec3.sub(point, vertexA), normal)) / normalLength;
  if (distanceToPlane > SURFACE_EPSILON) {
    return false;
  }

  // Barycentric coordinates via dot product method
  const dotABAB = vec3.dot(edgeAB, edgeAB);
  const dotABAC = vec3.dot(edgeAB, edgeAC);
  const dotACAC = vec3.dot(edgeAC, edgeAC);
  const ap = vec3.sub(point, vertexA);
  const dotAPAB = vec3.dot(ap, edgeAB);
  const dotAPAC = vec3.dot(ap, edgeAC);
  const denominator = dotABAB * dotACAC - dotABAC * dotABAC;

  if (Math.abs(denominator) < SURFACE_EPSILON * SURFACE_EPSILON) {
    return false;
  }

  const baryV = (dotACAC * dotAPAB - dotABAC * dotAPAC) / denominator;
  const baryW = (dotABAB * dotAPAC - dotABAC * dotAPAB) / denominator;
  const baryU = 1 - baryV - baryW;

  return baryU >= -SURFACE_EPSILON && baryV >= -SURFACE_EPSILON && baryW >= -SURFACE_EPSILON;
}

const SURFACE_EPSILON = 1e-4;

/**
 * Tests if a point is inside or on the surface of a convex polyhedron
 * defined by its triangulated faces. Two-step approach:
 * 1. Surface test — checks if the point lies on any face triangle (robust for coplanar points)
 * 2. Ray casting — counts intersections for inside/outside classification
 */
export function isPointInsideOrOnSurface(
  point: Vec3,
  faceTriangles: readonly [number, number, number][],
  vertices: readonly Vec3[]
): boolean {
  // Step 1: check if the point lies on any face triangle (handles coplanar/edge cases)
  for (const triangleIndices of faceTriangles) {
    if (
      isPointOnTriangle(
        point,
        vertices[triangleIndices[0]],
        vertices[triangleIndices[1]],
        vertices[triangleIndices[2]]
      )
    ) {
      return true;
    }
  }

  // Step 2: ray casting for points strictly inside the polyhedron
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
  return intersectionCount % 2 === 1;
}

/**
 * Checks if a point is within the given distance threshold of any point in the list.
 */
export function isNearAnyPoint(
  point: Vec3Arg,
  points: readonly Vec3[],
  thresholdSquared: number
): boolean {
  for (const other of points) {
    if (vec3.distSq(point, other) < thresholdSquared) {
      return true;
    }
  }
  return false;
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
