import { isNil } from 'lodash-es';
import { vec4 } from 'wgpu-matrix';

import { EDGE_HIT_RADIUS_PIXELS, VERTEX_HIT_RADIUS_PIXELS } from './stereometry-constants';
import type { FigureTopology, SelectionState } from './stereometry-types';
import { SELECTION_NONE } from './stereometry-types';

/** Homogeneous w-component for position vectors */
const HOMOGENEOUS_W = 1.0;

/**
 * Performs CPU hit testing against the pyramid geometry for edge selection.
 * Returns an edge selection or SELECTION_NONE.
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
  topology: FigureTopology
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

/**
 * Performs CPU hit testing against topology vertices only.
 * Returns the index of the nearest vertex within VERTEX_HIT_RADIUS_PIXELS,
 * or undefined if no vertex is close enough.
 *
 * @param screenX Position in CSS pixels relative to canvas left edge
 * @param screenY Position in CSS pixels relative to canvas top edge
 * @param canvasWidth Canvas CSS width in pixels
 * @param canvasHeight Canvas CSS height in pixels
 * @param devicePixelRatio Device pixel ratio for proper coordinate mapping
 * @param mvpMatrix The model-view-projection matrix used for rendering
 * @param vertices Array of 3D vertex positions to test against
 */
export function hitTestVertex(
  screenX: number,
  screenY: number,
  canvasWidth: number,
  canvasHeight: number,
  devicePixelRatio: number,
  mvpMatrix: Float32Array,
  vertices: readonly (readonly [number, number, number])[]
): number | undefined {
  const gpuCanvasWidth = canvasWidth * devicePixelRatio;
  const gpuCanvasHeight = canvasHeight * devicePixelRatio;
  const pixelX = screenX * devicePixelRatio;
  const pixelY = screenY * devicePixelRatio;

  const projectedVertices = projectVerticesToScreen(
    mvpMatrix,
    vertices,
    gpuCanvasWidth,
    gpuCanvasHeight
  );

  return findNearestVertexIndex(pixelX, pixelY, devicePixelRatio, projectedVertices);
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
 * Finds the index of the nearest vertex within VERTEX_HIT_RADIUS_PIXELS
 * of the given pixel position, or undefined if none is close enough.
 */
function findNearestVertexIndex(
  pixelX: number,
  pixelY: number,
  devicePixelRatio: number,
  projectedVertices: ProjectedVertex[]
): number | undefined {
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

  return nearestVertexIndex;
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
