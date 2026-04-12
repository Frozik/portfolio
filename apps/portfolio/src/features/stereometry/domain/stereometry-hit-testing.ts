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
 * A line segment defined by two 3D endpoints, for hit testing.
 */
export interface HitTestLineSegment {
  readonly startPosition: readonly [number, number, number];
  readonly endPosition: readonly [number, number, number];
}

/**
 * Performs CPU hit testing against edges, extended lines, and user segments.
 * Priority: edges first, then extended lines, then user segments.
 *
 * @param screenX Click position in CSS pixels relative to canvas left edge
 * @param screenY Click position in CSS pixels relative to canvas top edge
 * @param canvasWidth Canvas CSS width in pixels
 * @param canvasHeight Canvas CSS height in pixels
 * @param devicePixelRatio Device pixel ratio for proper coordinate mapping
 * @param mvpMatrix The model-view-projection matrix used for rendering
 * @param topology Pyramid topology for geometry data
 * @param extendedEdgeIndices Edge indices that have been extended into lines
 * @param userSegments User-created line segments
 */
export function hitTest(
  screenX: number,
  screenY: number,
  canvasWidth: number,
  canvasHeight: number,
  devicePixelRatio: number,
  mvpMatrix: Float32Array,
  topology: FigureTopology,
  extendedEdgeIndices: readonly number[],
  userSegments: readonly HitTestLineSegment[]
): SelectionState {
  const gpuCanvasWidth = canvasWidth * devicePixelRatio;
  const gpuCanvasHeight = canvasHeight * devicePixelRatio;
  const pixelX = screenX * devicePixelRatio;
  const pixelY = screenY * devicePixelRatio;
  const thresholdSquared = (EDGE_HIT_RADIUS_PIXELS * devicePixelRatio) ** 2;

  const projectedVertices = projectVerticesToScreen(
    mvpMatrix,
    topology.vertices,
    gpuCanvasWidth,
    gpuCanvasHeight
  );

  // 1. Check topology edge segments
  const edgeHit = findNearestLineHit(
    pixelX,
    pixelY,
    thresholdSquared,
    projectedVertices,
    topology.edges
  );

  if (!isNil(edgeHit)) {
    return { type: 'edge', edgeIndex: edgeHit };
  }

  // 2. Check extended lines (projected as very long segments)
  if (extendedEdgeIndices.length > 0) {
    const extendedEndpoints = computeExtendedEndpoints(topology, extendedEdgeIndices);
    const projectedExtended = projectVerticesToScreen(
      mvpMatrix,
      extendedEndpoints,
      gpuCanvasWidth,
      gpuCanvasHeight
    );

    const lineHit = findNearestProjectedPairHit(
      pixelX,
      pixelY,
      thresholdSquared,
      projectedExtended
    );

    if (!isNil(lineHit)) {
      return { type: 'line', edgeIndex: extendedEdgeIndices[lineHit] };
    }
  }

  // 3. Check user segments (also rendered as extended lines)
  if (userSegments.length > 0) {
    const userEndpoints = computeUserSegmentEndpoints(userSegments);
    const projectedUser = projectVerticesToScreen(
      mvpMatrix,
      userEndpoints,
      gpuCanvasWidth,
      gpuCanvasHeight
    );

    const userHit = findNearestProjectedPairHit(pixelX, pixelY, thresholdSquared, projectedUser);

    if (!isNil(userHit)) {
      return { type: 'userSegment', userSegmentIndex: userHit };
    }
  }

  return SELECTION_NONE;
}

/**
 * Performs CPU hit testing against topology vertices only.
 * Returns the index of the nearest vertex within VERTEX_HIT_RADIUS_PIXELS,
 * or undefined if no vertex is close enough.
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
 * Finds the nearest edge within threshold of the click point.
 * Uses topology vertex indices to look up projected positions.
 * Returns the edge index or undefined.
 */
function findNearestLineHit(
  pixelX: number,
  pixelY: number,
  thresholdSquared: number,
  projectedVertices: ProjectedVertex[],
  edges: readonly [number, number][]
): number | undefined {
  let nearestDistanceSquared = thresholdSquared;
  let nearestIndex: number | undefined;

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
      nearestIndex = edgeIndex;
    }
  }

  return nearestIndex;
}

/**
 * Finds the nearest line among projected endpoint pairs.
 * Each pair of consecutive projected vertices (0-1, 2-3, 4-5, ...) forms one line.
 * Returns the pair index (0, 1, 2, ...) or undefined.
 */
function findNearestProjectedPairHit(
  pixelX: number,
  pixelY: number,
  thresholdSquared: number,
  projectedEndpoints: ProjectedVertex[]
): number | undefined {
  let nearestDistanceSquared = thresholdSquared;
  let nearestIndex: number | undefined;
  const pairCount = projectedEndpoints.length / 2;

  for (let pairIndex = 0; pairIndex < pairCount; pairIndex++) {
    const projectedA = projectedEndpoints[pairIndex * 2];
    const projectedB = projectedEndpoints[pairIndex * 2 + 1];

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
      nearestIndex = pairIndex;
    }
  }

  return nearestIndex;
}

/**
 * Computes extended line endpoints for hit testing.
 * Each edge produces one pair of endpoints [farStart, farEnd].
 */
function computeExtendedEndpoints(
  topology: FigureTopology,
  edgeIndices: readonly number[]
): [number, number, number][] {
  const endpoints: [number, number, number][] = [];

  for (const edgeIndex of edgeIndices) {
    const [vertexIndexA, vertexIndexB] = topology.edges[edgeIndex];
    const positionA = topology.vertices[vertexIndexA];
    const positionB = topology.vertices[vertexIndexB];
    const [farStart, farEnd] = extendLineEndpoints(positionA, positionB);
    endpoints.push(farStart, farEnd);
  }

  return endpoints;
}

/**
 * Computes extended endpoints for user segments.
 * Each segment produces one pair of endpoints [farStart, farEnd].
 */
function computeUserSegmentEndpoints(
  segments: readonly HitTestLineSegment[]
): [number, number, number][] {
  const endpoints: [number, number, number][] = [];

  for (const segment of segments) {
    const [farStart, farEnd] = extendLineEndpoints(segment.startPosition, segment.endPosition);
    endpoints.push(farStart, farEnd);
  }

  return endpoints;
}

function extendLineEndpoints(
  positionA: readonly [number, number, number],
  positionB: readonly [number, number, number]
): [[number, number, number], [number, number, number]] {
  const directionX = positionB[0] - positionA[0];
  const directionY = positionB[1] - positionA[1];
  const directionZ = positionB[2] - positionA[2];
  const length = Math.sqrt(
    directionX * directionX + directionY * directionY + directionZ * directionZ
  );

  if (length === 0) {
    return [
      [positionA[0], positionA[1], positionA[2]],
      [positionB[0], positionB[1], positionB[2]],
    ];
  }

  const normalizedX = directionX / length;
  const normalizedY = directionY / length;
  const normalizedZ = directionZ / length;

  return [
    [
      positionA[0] - normalizedX * LINE_EXTENSION_LENGTH,
      positionA[1] - normalizedY * LINE_EXTENSION_LENGTH,
      positionA[2] - normalizedZ * LINE_EXTENSION_LENGTH,
    ],
    [
      positionB[0] + normalizedX * LINE_EXTENSION_LENGTH,
      positionB[1] + normalizedY * LINE_EXTENSION_LENGTH,
      positionB[2] + normalizedZ * LINE_EXTENSION_LENGTH,
    ],
  ];
}

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

  if (segmentLengthSquared === 0) {
    const deltaX = pointX - segmentStartX;
    const deltaY = pointY - segmentStartY;
    return deltaX * deltaX + deltaY * deltaY;
  }

  const projectionParameter = Math.max(
    0,
    Math.min(
      1,
      ((pointX - segmentStartX) * segmentDeltaX + (pointY - segmentStartY) * segmentDeltaY) /
        segmentLengthSquared
    )
  );

  const nearestX = segmentStartX + projectionParameter * segmentDeltaX;
  const nearestY = segmentStartY + projectionParameter * segmentDeltaY;

  const deltaX = pointX - nearestX;
  const deltaY = pointY - nearestY;
  return deltaX * deltaX + deltaY * deltaY;
}
