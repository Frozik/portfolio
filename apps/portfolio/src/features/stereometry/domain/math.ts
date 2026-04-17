import type { Vec3Arg } from 'wgpu-matrix';
import { vec3 } from 'wgpu-matrix';
import { LINE_EXTENSION_LENGTH } from './constants';
import type { Vec3Array } from './topology-types';

/**
 * Extends a line segment in both directions by LINE_EXTENSION_LENGTH.
 * Returns [farStart, farEnd]. For degenerate segments, returns the original positions.
 */
export function extendLine(positionA: Vec3Array, positionB: Vec3Array): [Vec3Array, Vec3Array] {
  const direction = vec3.sub(positionB, positionA);
  const length = vec3.len(direction);

  if (length === 0) {
    return [
      [positionA[0], positionA[1], positionA[2]],
      [positionB[0], positionB[1], positionB[2]],
    ];
  }

  const normalized = vec3.normalize(direction);

  return [
    vec3.addScaled(positionA, normalized, -LINE_EXTENSION_LENGTH) as Vec3Array,
    vec3.addScaled(positionB, normalized, LINE_EXTENSION_LENGTH) as Vec3Array,
  ];
}

const SURFACE_EPSILON = 1e-4;

/**
 * Tests if a point lies on the surface of a triangle using
 * distance-to-plane + barycentric coordinate checks with epsilon tolerance.
 * More robust than ray casting for points exactly on face boundaries.
 */
function isPointOnTriangle(
  point: Vec3Array,
  vertexA: Vec3Array,
  vertexB: Vec3Array,
  vertexC: Vec3Array
): boolean {
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

/**
 * Tests if a point is inside or on the surface of a convex polyhedron
 * defined by its triangulated faces. Two-step approach:
 * 1. Surface test — checks if the point lies on any face triangle (robust for coplanar points)
 * 2. Ray casting — counts intersections for inside/outside classification
 */
export function isPointInsideOrOnSurface(
  point: Vec3Array,
  faceTriangles: readonly [number, number, number][],
  vertices: readonly Vec3Array[]
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

  // Step 2: generalized winding number for points strictly inside the polyhedron.
  // Sum signed solid angles of all triangles as seen from the point
  // (Van Oosterom & Strackee formula). Inside ≈ 4π, outside ≈ 0.
  // Unlike ray casting, this has no edge cases with coplanar faces or edge hits.
  //
  // Face winding may be inconsistent across the mesh, so we orient each triangle
  // so its normal points away from the mesh centroid before summing.
  const centroid = computeCentroid(vertices);
  let windingAngle = 0;

  for (const triangleIndices of faceTriangles) {
    const vertexA = vertices[triangleIndices[0]];
    const vertexB = vertices[triangleIndices[1]];
    const vertexC = vertices[triangleIndices[2]];

    const rawAngle = triangleSolidAngle(point, vertexA, vertexB, vertexC);

    // Ensure consistent outward orientation: if the triangle normal
    // points toward the centroid, flip the sign of its contribution
    const triangleCentroid: Vec3Array = [
      (vertexA[0] + vertexB[0] + vertexC[0]) / 3,
      (vertexA[1] + vertexB[1] + vertexC[1]) / 3,
      (vertexA[2] + vertexB[2] + vertexC[2]) / 3,
    ];
    const edgeAB = vec3.sub(vertexB, vertexA);
    const edgeAC = vec3.sub(vertexC, vertexA);
    const faceNormal = vec3.cross(edgeAB, edgeAC);
    const toCentroid = vec3.sub(centroid, triangleCentroid);

    // If normal points toward centroid → face is inward-wound → negate
    const shouldFlip = vec3.dot(faceNormal, toCentroid) > 0;
    windingAngle += shouldFlip ? -rawAngle : rawAngle;
  }

  return Math.abs(windingAngle) > 2 * Math.PI;
}

function computeCentroid(vertices: readonly Vec3Array[]): Vec3Array {
  let sumX = 0;
  let sumY = 0;
  let sumZ = 0;

  for (const vertex of vertices) {
    sumX += vertex[0];
    sumY += vertex[1];
    sumZ += vertex[2];
  }

  const count = vertices.length;
  return [sumX / count, sumY / count, sumZ / count];
}

/**
 * Computes the signed solid angle subtended by a triangle as seen from a point.
 * Uses the Van Oosterom & Strackee (1983) formula:
 *   tan(ω/2) = (a · (b × c)) / (|a||b||c| + (a·b)|c| + (b·c)|a| + (a·c)|b|)
 * where a, b, c are vectors from the point to the triangle vertices.
 */
function triangleSolidAngle(
  point: Vec3Array,
  vertexA: Vec3Array,
  vertexB: Vec3Array,
  vertexC: Vec3Array
): number {
  const toA = vec3.sub(vertexA, point);
  const toB = vec3.sub(vertexB, point);
  const toC = vec3.sub(vertexC, point);

  const lenA = vec3.len(toA);
  const lenB = vec3.len(toB);
  const lenC = vec3.len(toC);

  const numerator = vec3.dot(toA, vec3.cross(toB, toC));
  const denominator =
    lenA * lenB * lenC +
    vec3.dot(toA, toB) * lenC +
    vec3.dot(toB, toC) * lenA +
    vec3.dot(toA, toC) * lenB;

  return 2 * Math.atan2(numerator, denominator);
}

/**
 * Checks if a point is within the given distance threshold of any point in the list.
 */
export function isNearAnyPoint(
  point: Vec3Arg,
  points: readonly Vec3Array[],
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
  rayOrigin: Vec3Array,
  rayDirection: Vec3Array,
  vertexA: Vec3Array,
  vertexB: Vec3Array,
  vertexC: Vec3Array
): number | undefined {
  const edgeAB = vec3.sub(vertexB, vertexA);
  const edgeAC = vec3.sub(vertexC, vertexA);

  const pVec = vec3.cross(rayDirection, edgeAC);
  const determinant = vec3.dot(edgeAB, pVec);

  if (Math.abs(determinant) < RAY_EPSILON) {
    return undefined;
  }

  const inverseDeterminant = 1.0 / determinant;

  const tVec = vec3.sub(rayOrigin, vertexA);
  const barycentricU = vec3.dot(tVec, pVec) * inverseDeterminant;

  if (barycentricU < 0 || barycentricU > 1) {
    return undefined;
  }

  const qVec = vec3.cross(tVec, edgeAB);
  const barycentricV = vec3.dot(rayDirection, qVec) * inverseDeterminant;

  if (barycentricV < 0 || barycentricU + barycentricV > 1) {
    return undefined;
  }

  return vec3.dot(edgeAC, qVec) * inverseDeterminant;
}
