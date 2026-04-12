import { isNil } from 'lodash-es';
import { vec4 } from 'wgpu-matrix';

import {
  EDGE_HIT_RADIUS_PIXELS,
  LINE_EXTENSION_LENGTH,
  VERTEX_HIT_RADIUS_PIXELS,
} from './stereometry-constants';
import type { FigureTopology, SelectionState } from './stereometry-types';
import { SELECTION_NONE } from './stereometry-types';

/** Homogeneous w-component for position vectors */
const HOMOGENEOUS_W = 1.0;

/**
 * Performs CPU hit testing against the pyramid geometry.
 *
 * Priority: vertex hits (within VERTEX_HIT_RADIUS_PIXELS) take precedence
 * over edge hits (within EDGE_HIT_RADIUS_PIXELS). Returns SELECTION_NONE
 * if nothing is hit.
 *
 * @param screenX Click position in CSS pixels relative to canvas left edge
 * @param screenY Click position in CSS pixels relative to canvas top edge
 * @param canvasWidth Canvas CSS width in pixels
 * @param canvasHeight Canvas CSS height in pixels
 * @param devicePixelRatio Device pixel ratio for proper coordinate mapping
 * @param mvpMatrix The model-view-projection matrix used for rendering
 * @param topology Pyramid topology for geometry data
 */
export function hitTest(
  screenX: number,
  screenY: number,
  canvasWidth: number,
  canvasHeight: number,
  devicePixelRatio: number,
  mvpMatrix: Float32Array,
  topology: FigureTopology,
  intersectionPositions: readonly (readonly [number, number, number])[] = []
): SelectionState {
  const gpuCanvasWidth = canvasWidth * devicePixelRatio;
  const gpuCanvasHeight = canvasHeight * devicePixelRatio;
  const pixelX = screenX * devicePixelRatio;
  const pixelY = screenY * devicePixelRatio;

  const projectedVertices = projectVerticesToScreen(
    mvpMatrix,
    topology.vertices,
    gpuCanvasWidth,
    gpuCanvasHeight
  );

  const vertexHit = findNearestVertex(pixelX, pixelY, devicePixelRatio, projectedVertices);

  if (!isNil(vertexHit)) {
    return vertexHit;
  }

  if (intersectionPositions.length > 0) {
    const projectedIntersections = projectVerticesToScreen(
      mvpMatrix,
      intersectionPositions,
      gpuCanvasWidth,
      gpuCanvasHeight
    );

    const intersectionHit = findNearestIntersection(
      pixelX,
      pixelY,
      devicePixelRatio,
      projectedIntersections
    );

    if (!isNil(intersectionHit)) {
      return intersectionHit;
    }
  }

  const edgeHit = findNearestEdge(
    pixelX,
    pixelY,
    devicePixelRatio,
    projectedVertices,
    topology.edges
  );

  if (!isNil(edgeHit)) {
    return edgeHit;
  }

  return SELECTION_NONE;
}

interface ProjectedVertex {
  readonly screenX: number;
  readonly screenY: number;
  readonly behindCamera: boolean;
}

function projectVerticesToScreen(
  mvpMatrix: Float32Array,
  vertices: readonly (readonly [number, number, number])[],
  gpuCanvasWidth: number,
  gpuCanvasHeight: number
): ProjectedVertex[] {
  return vertices.map(vertex => {
    const clipSpace = vec4.transformMat4(
      vec4.fromValues(vertex[0], vertex[1], vertex[2], HOMOGENEOUS_W),
      mvpMatrix
    );

    if (clipSpace[3] <= 0) {
      return { screenX: 0, screenY: 0, behindCamera: true };
    }

    const ndcX = clipSpace[0] / clipSpace[3];
    const ndcY = clipSpace[1] / clipSpace[3];

    return {
      screenX: (ndcX + 1) * 0.5 * gpuCanvasWidth,
      screenY: (1 - ndcY) * 0.5 * gpuCanvasHeight,
      behindCamera: false,
    };
  });
}

/**
 * Finds the nearest vertex within VERTEX_HIT_RADIUS_PIXELS of the click point.
 */
function findNearestVertex(
  pixelX: number,
  pixelY: number,
  devicePixelRatio: number,
  projectedVertices: ProjectedVertex[]
): SelectionState | undefined {
  let nearestDistanceSquared = (VERTEX_HIT_RADIUS_PIXELS * devicePixelRatio) ** 2;
  let nearestVertexIndex: number | undefined;

  for (let vertexIndex = 0; vertexIndex < projectedVertices.length; vertexIndex++) {
    const projected = projectedVertices[vertexIndex];
    if (projected.behindCamera) {
      continue;
    }

    const deltaX = projected.screenX - pixelX;
    const deltaY = projected.screenY - pixelY;
    const distanceSquared = deltaX * deltaX + deltaY * deltaY;

    if (distanceSquared < nearestDistanceSquared) {
      nearestDistanceSquared = distanceSquared;
      nearestVertexIndex = vertexIndex;
    }
  }

  if (!isNil(nearestVertexIndex)) {
    return { type: 'vertex', vertexIndex: nearestVertexIndex };
  }

  return undefined;
}

/**
 * Finds the nearest intersection point within VERTEX_HIT_RADIUS_PIXELS of the click.
 * Uses the same proximity logic as vertex hit testing.
 */
function findNearestIntersection(
  pixelX: number,
  pixelY: number,
  devicePixelRatio: number,
  projectedIntersections: ProjectedVertex[]
): SelectionState | undefined {
  let nearestDistanceSquared = (VERTEX_HIT_RADIUS_PIXELS * devicePixelRatio) ** 2;
  let nearestIndex: number | undefined;

  for (
    let intersectionIndex = 0;
    intersectionIndex < projectedIntersections.length;
    intersectionIndex++
  ) {
    const projected = projectedIntersections[intersectionIndex];
    if (projected.behindCamera) {
      continue;
    }

    const deltaX = projected.screenX - pixelX;
    const deltaY = projected.screenY - pixelY;
    const distanceSquared = deltaX * deltaX + deltaY * deltaY;

    if (distanceSquared < nearestDistanceSquared) {
      nearestDistanceSquared = distanceSquared;
      nearestIndex = intersectionIndex;
    }
  }

  if (!isNil(nearestIndex)) {
    return { type: 'intersection', intersectionIndex: nearestIndex };
  }

  return undefined;
}

/**
 * Finds the nearest edge within EDGE_HIT_RADIUS_PIXELS of the click point.
 * Uses screen-space point-to-segment distance.
 */
function findNearestEdge(
  pixelX: number,
  pixelY: number,
  devicePixelRatio: number,
  projectedVertices: ProjectedVertex[],
  edges: readonly [number, number][]
): SelectionState | undefined {
  let nearestDistanceSquared = (EDGE_HIT_RADIUS_PIXELS * devicePixelRatio) ** 2;
  let nearestEdgeIndex: number | undefined;

  for (let edgeIndex = 0; edgeIndex < edges.length; edgeIndex++) {
    const [vertexIndexA, vertexIndexB] = edges[edgeIndex];
    const projectedA = projectedVertices[vertexIndexA];
    const projectedB = projectedVertices[vertexIndexB];

    if (projectedA.behindCamera || projectedB.behindCamera) {
      continue;
    }

    const distanceSquared = pointToSegmentDistanceSquared(
      pixelX,
      pixelY,
      projectedA.screenX,
      projectedA.screenY,
      projectedB.screenX,
      projectedB.screenY
    );

    if (distanceSquared < nearestDistanceSquared) {
      nearestDistanceSquared = distanceSquared;
      nearestEdgeIndex = edgeIndex;
    }
  }

  if (!isNil(nearestEdgeIndex)) {
    return { type: 'edge', edgeIndex: nearestEdgeIndex };
  }

  return undefined;
}

/**
 * Computes the squared distance from a point (px, py) to a line segment
 * defined by endpoints (ax, ay) and (bx, by).
 *
 * Projects the point onto the infinite line, then clamps the projection
 * parameter to [0, 1] to constrain it to the segment.
 */
function pointToSegmentDistanceSquared(
  pointX: number,
  pointY: number,
  segmentStartX: number,
  segmentStartY: number,
  segmentEndX: number,
  segmentEndY: number
): number {
  const segmentDeltaX = segmentEndX - segmentStartX;
  const segmentDeltaY = segmentEndY - segmentStartY;
  const segmentLengthSquared = segmentDeltaX * segmentDeltaX + segmentDeltaY * segmentDeltaY;

  // Degenerate segment (both endpoints at the same position)
  if (segmentLengthSquared === 0) {
    const deltaX = pointX - segmentStartX;
    const deltaY = pointY - segmentStartY;
    return deltaX * deltaX + deltaY * deltaY;
  }

  // Project point onto the segment line, clamped to [0, 1]
  const projectionParameter = Math.max(
    0,
    Math.min(
      1,
      ((pointX - segmentStartX) * segmentDeltaX + (pointY - segmentStartY) * segmentDeltaY) /
        segmentLengthSquared
    )
  );

  // Nearest point on the segment
  const nearestX = segmentStartX + projectionParameter * segmentDeltaX;
  const nearestY = segmentStartY + projectionParameter * segmentDeltaY;

  const deltaX = pointX - nearestX;
  const deltaY = pointY - nearestY;
  return deltaX * deltaX + deltaY * deltaY;
}

/**
 * Finds all extended line edge indices that are within EDGE_HIT_RADIUS_PIXELS
 * of the click point. Used to detect which lines are near a potential intersection.
 *
 * Projects extended line endpoints to screen space and checks distance
 * from the click to each projected line segment.
 */
export function findNearbyExtendedLines(
  screenX: number,
  screenY: number,
  canvasWidth: number,
  canvasHeight: number,
  devicePixelRatio: number,
  mvpMatrix: Float32Array,
  topology: FigureTopology,
  extendedEdgeIndices: readonly number[]
): number[] {
  const gpuCanvasWidth = canvasWidth * devicePixelRatio;
  const gpuCanvasHeight = canvasHeight * devicePixelRatio;
  const pixelX = screenX * devicePixelRatio;
  const pixelY = screenY * devicePixelRatio;
  const thresholdSquared = (EDGE_HIT_RADIUS_PIXELS * devicePixelRatio) ** 2;

  const nearbyIndices: number[] = [];

  for (const edgeIndex of extendedEdgeIndices) {
    const [vertexIndexA, vertexIndexB] = topology.edges[edgeIndex];
    const positionA = topology.vertices[vertexIndexA];
    const positionB = topology.vertices[vertexIndexB];

    // Compute extended line endpoints
    const directionX = positionB[0] - positionA[0];
    const directionY = positionB[1] - positionA[1];
    const directionZ = positionB[2] - positionA[2];
    const edgeLength = Math.sqrt(
      directionX * directionX + directionY * directionY + directionZ * directionZ
    );
    const normalizedX = directionX / edgeLength;
    const normalizedY = directionY / edgeLength;
    const normalizedZ = directionZ / edgeLength;

    const extendedStart: readonly [number, number, number] = [
      positionA[0] - normalizedX * LINE_EXTENSION_LENGTH,
      positionA[1] - normalizedY * LINE_EXTENSION_LENGTH,
      positionA[2] - normalizedZ * LINE_EXTENSION_LENGTH,
    ];
    const extendedEnd: readonly [number, number, number] = [
      positionB[0] + normalizedX * LINE_EXTENSION_LENGTH,
      positionB[1] + normalizedY * LINE_EXTENSION_LENGTH,
      positionB[2] + normalizedZ * LINE_EXTENSION_LENGTH,
    ];

    const projectedEndpoints = projectVerticesToScreen(
      mvpMatrix,
      [extendedStart, extendedEnd],
      gpuCanvasWidth,
      gpuCanvasHeight
    );

    const projectedA = projectedEndpoints[0];
    const projectedB = projectedEndpoints[1];

    if (projectedA.behindCamera && projectedB.behindCamera) {
      continue;
    }

    // Skip if either endpoint is behind camera (line passes through camera)
    if (projectedA.behindCamera || projectedB.behindCamera) {
      continue;
    }

    const distanceSquared = pointToSegmentDistanceSquared(
      pixelX,
      pixelY,
      projectedA.screenX,
      projectedA.screenY,
      projectedB.screenX,
      projectedB.screenY
    );

    if (distanceSquared < thresholdSquared) {
      nearbyIndices.push(edgeIndex);
    }
  }

  return nearbyIndices;
}
