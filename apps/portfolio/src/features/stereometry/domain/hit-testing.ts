import { isNil } from 'lodash-es';
import { vec4 } from 'wgpu-matrix';

import { EDGE_HIT_RADIUS_PIXELS, HOMOGENEOUS_W, VERTEX_HIT_RADIUS_PIXELS } from './constants';
import type { Vec3 } from './math';
import { extendLine } from './math';
import type { SceneLine, SelectionState } from './types';
import { SELECTION_NONE } from './types';

/**
 * Performs CPU hit testing against edges and lines.
 * Priority: edges > lines.
 */
export function hitTest(
  screenX: number,
  screenY: number,
  canvasWidth: number,
  canvasHeight: number,
  devicePixelRatio: number,
  mvpMatrix: Float32Array,
  topologyEdges: readonly [number, number][],
  topologyVertices: readonly Vec3[],
  lines: readonly SceneLine[]
): SelectionState {
  const gpuCanvasWidth = canvasWidth * devicePixelRatio;
  const gpuCanvasHeight = canvasHeight * devicePixelRatio;
  const pixelX = screenX * devicePixelRatio;
  const pixelY = screenY * devicePixelRatio;
  const thresholdSquared = (EDGE_HIT_RADIUS_PIXELS * devicePixelRatio) ** 2;

  const projectedVertices = projectVerticesToScreen(
    mvpMatrix,
    topologyVertices,
    gpuCanvasWidth,
    gpuCanvasHeight
  );

  // 1. Check topology edge segments
  const edgeSegments = topologyEdges.map(([indexA, indexB]) => ({
    start: projectedVertices[indexA],
    end: projectedVertices[indexB],
  }));

  const edgeHit = findNearestSegmentHit(pixelX, pixelY, thresholdSquared, edgeSegments);

  if (!isNil(edgeHit)) {
    return { type: 'edge', edgeIndex: edgeHit };
  }

  // 2. Check lines (extended)
  if (lines.length > 0) {
    const lineSegments = lines.map(line => ({
      startPosition: line.pointA,
      endPosition: line.pointB,
    }));

    const extendedProjected = projectExtendedLineSegments(
      mvpMatrix,
      lineSegments,
      gpuCanvasWidth,
      gpuCanvasHeight
    );

    const lineHit = findNearestSegmentHit(pixelX, pixelY, thresholdSquared, extendedProjected);

    if (!isNil(lineHit)) {
      return { type: 'line', lineIndex: lineHit };
    }
  }

  return SELECTION_NONE;
}

/**
 * Performs CPU hit testing against vertices only.
 * Returns the nearest vertex index or undefined.
 */
export function hitTestVertex(
  screenX: number,
  screenY: number,
  canvasWidth: number,
  canvasHeight: number,
  devicePixelRatio: number,
  mvpMatrix: Float32Array,
  vertices: readonly Vec3[]
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

interface ProjectedSegment {
  readonly start: ProjectedVertex;
  readonly end: ProjectedVertex;
}

interface ExtendableLineSegment {
  readonly startPosition: Vec3;
  readonly endPosition: Vec3;
}

/** Minimum w for near-plane clipping (matches NEAR_CLIP_W in common.wgsl) */
const NEAR_CLIP_W = 0.01;

function projectVerticesToScreen(
  mvpMatrix: Float32Array,
  vertices: readonly Vec3[],
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
 * Projects two endpoints with near-plane clipping.
 * If one endpoint is behind the camera, interpolates it to the near plane
 * instead of discarding the entire segment.
 */
function projectSegmentToScreen(
  mvpMatrix: Float32Array,
  pointA: Vec3,
  pointB: Vec3,
  gpuCanvasWidth: number,
  gpuCanvasHeight: number
): ProjectedSegment {
  const clipA = vec4.transformMat4(
    vec4.fromValues(pointA[0], pointA[1], pointA[2], HOMOGENEOUS_W),
    mvpMatrix
  );
  const clipB = vec4.transformMat4(
    vec4.fromValues(pointB[0], pointB[1], pointB[2], HOMOGENEOUS_W),
    mvpMatrix
  );

  // Both behind camera — no visible segment
  if (clipA[3] <= 0 && clipB[3] <= 0) {
    return {
      start: { screenX: 0, screenY: 0, behindCamera: true },
      end: { screenX: 0, screenY: 0, behindCamera: true },
    };
  }

  // Clamp endpoints to near plane if behind camera
  const clampedA = clipA[3] < NEAR_CLIP_W ? clampToNearPlane(clipA, clipB) : clipA;
  const clampedB = clipB[3] < NEAR_CLIP_W ? clampToNearPlane(clipB, clipA) : clipB;

  return {
    start: clipToScreen(clampedA, gpuCanvasWidth, gpuCanvasHeight),
    end: clipToScreen(clampedB, gpuCanvasWidth, gpuCanvasHeight),
  };
}

function clampToNearPlane(point: Float32Array, other: Float32Array): Float32Array {
  const parametricT = (NEAR_CLIP_W - point[3]) / (other[3] - point[3]);
  return vec4.lerp(point, other, parametricT) as Float32Array;
}

function clipToScreen(
  clipSpace: Float32Array,
  gpuCanvasWidth: number,
  gpuCanvasHeight: number
): ProjectedVertex {
  const ndcX = clipSpace[0] / clipSpace[3];
  const ndcY = clipSpace[1] / clipSpace[3];
  return {
    screenX: (ndcX + 1) * 0.5 * gpuCanvasWidth,
    screenY: (1 - ndcY) * 0.5 * gpuCanvasHeight,
    behindCamera: false,
  };
}

function projectExtendedLineSegments(
  mvpMatrix: Float32Array,
  segments: readonly ExtendableLineSegment[],
  gpuCanvasWidth: number,
  gpuCanvasHeight: number
): ProjectedSegment[] {
  return segments.map(segment => {
    const [farStart, farEnd] = extendLine(segment.startPosition, segment.endPosition);
    return projectSegmentToScreen(mvpMatrix, farStart, farEnd, gpuCanvasWidth, gpuCanvasHeight);
  });
}

function findNearestVertexIndex(
  pixelX: number,
  pixelY: number,
  devicePixelRatio: number,
  projectedVertices: ProjectedVertex[]
): number | undefined {
  let nearestDistanceSquared = (VERTEX_HIT_RADIUS_PIXELS * devicePixelRatio) ** 2;
  let nearestIndex: number | undefined;

  for (let index = 0; index < projectedVertices.length; index++) {
    const projected = projectedVertices[index];
    if (projected.behindCamera) {
      continue;
    }

    const deltaX = projected.screenX - pixelX;
    const deltaY = projected.screenY - pixelY;
    const distanceSquared = deltaX * deltaX + deltaY * deltaY;

    if (distanceSquared < nearestDistanceSquared) {
      nearestDistanceSquared = distanceSquared;
      nearestIndex = index;
    }
  }

  return nearestIndex;
}

/**
 * Unified segment hit test — finds the nearest screen-space segment within threshold.
 * Returns the index of the nearest segment, or undefined if none is close enough.
 */
function findNearestSegmentHit(
  pixelX: number,
  pixelY: number,
  thresholdSquared: number,
  segments: readonly ProjectedSegment[]
): number | undefined {
  let nearestDistanceSquared = thresholdSquared;
  let nearestIndex: number | undefined;

  for (let index = 0; index < segments.length; index++) {
    const { start, end } = segments[index];

    if (start.behindCamera || end.behindCamera) {
      continue;
    }

    const distanceSquared = pointToSegmentDistanceSquared(
      pixelX,
      pixelY,
      start.screenX,
      start.screenY,
      end.screenX,
      end.screenY
    );

    if (distanceSquared < nearestDistanceSquared) {
      nearestDistanceSquared = distanceSquared;
      nearestIndex = index;
    }
  }

  return nearestIndex;
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
