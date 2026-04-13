import { isNil } from 'lodash-es';
import { vec4 } from 'wgpu-matrix';

import {
  EDGE_HIT_RADIUS_PIXELS,
  HOMOGENEOUS_W,
  VERTEX_HIT_RADIUS_PIXELS,
} from './stereometry-constants';
import type { Vec3 } from './stereometry-math';
import { extendLine } from './stereometry-math';
import type { FigureTopology, SelectionState } from './stereometry-types';
import { SELECTION_NONE } from './stereometry-types';

export interface HitTestLineSegment {
  readonly startPosition: Vec3;
  readonly endPosition: Vec3;
}

/**
 * Performs CPU hit testing against edges, extended lines, and user segments.
 * Priority: edges > extended lines > user segments.
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
  const edgeSegments = topology.edges.map(([indexA, indexB]) => ({
    start: projectedVertices[indexA],
    end: projectedVertices[indexB],
  }));

  const edgeHit = findNearestSegmentHit(pixelX, pixelY, thresholdSquared, edgeSegments);

  if (!isNil(edgeHit)) {
    return { type: 'edge', edgeIndex: edgeHit };
  }

  // 2. Check extended lines
  if (extendedEdgeIndices.length > 0) {
    const extendedLineSegments = extendedEdgeIndices.map(edgeIndex => {
      const [vertexIndexA, vertexIndexB] = topology.edges[edgeIndex];
      return {
        startPosition: topology.vertices[vertexIndexA],
        endPosition: topology.vertices[vertexIndexB],
      };
    });

    const extendedProjected = projectExtendedLineSegments(
      mvpMatrix,
      extendedLineSegments,
      gpuCanvasWidth,
      gpuCanvasHeight
    );

    const lineHit = findNearestSegmentHit(pixelX, pixelY, thresholdSquared, extendedProjected);

    if (!isNil(lineHit)) {
      return { type: 'line', edgeIndex: extendedEdgeIndices[lineHit] };
    }
  }

  // 3. Check user segments
  if (userSegments.length > 0) {
    const userProjected = projectExtendedLineSegments(
      mvpMatrix,
      userSegments,
      gpuCanvasWidth,
      gpuCanvasHeight
    );

    const userHit = findNearestSegmentHit(pixelX, pixelY, thresholdSquared, userProjected);

    if (!isNil(userHit)) {
      return { type: 'userSegment', userSegmentIndex: userHit };
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

function projectExtendedLineSegments(
  mvpMatrix: Float32Array,
  segments: readonly HitTestLineSegment[],
  gpuCanvasWidth: number,
  gpuCanvasHeight: number
): ProjectedSegment[] {
  return segments.map(segment => {
    const [farStart, farEnd] = extendLine(segment.startPosition, segment.endPosition);
    const projected = projectVerticesToScreen(
      mvpMatrix,
      [farStart, farEnd],
      gpuCanvasWidth,
      gpuCanvasHeight
    );
    return { start: projected[0], end: projected[1] };
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
