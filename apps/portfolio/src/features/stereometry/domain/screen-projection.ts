import { vec4 } from 'wgpu-matrix';

import { HOMOGENEOUS_W } from './constants';
import type { Vec3Array } from './topology-types';

/** Minimum clip-space w for near-plane clipping (matches `NEAR_CLIP_W` in `common.wgsl`). */
const NEAR_CLIP_W = 0.01;

export interface ProjectedVertex {
  readonly screenX: number;
  readonly screenY: number;
  readonly behindCamera: boolean;
  /** View-space distance from the camera; smaller is closer to the viewer. */
  readonly depth: number;
}

export interface ProjectedSegment {
  readonly start: ProjectedVertex;
  readonly end: ProjectedVertex;
}

const BEHIND_CAMERA: ProjectedVertex = {
  screenX: 0,
  screenY: 0,
  behindCamera: true,
  depth: Number.POSITIVE_INFINITY,
};

function toClipSpace(mvpMatrix: Float32Array, point: Vec3Array): Float32Array {
  return vec4.transformMat4(
    vec4.fromValues(point[0], point[1], point[2], HOMOGENEOUS_W),
    mvpMatrix
  ) as Float32Array;
}

function clipToScreen(clipSpace: Float32Array, width: number, height: number): ProjectedVertex {
  const ndcX = clipSpace[0] / clipSpace[3];
  const ndcY = clipSpace[1] / clipSpace[3];
  return {
    screenX: (ndcX + 1) * 0.5 * width,
    screenY: (1 - ndcY) * 0.5 * height,
    behindCamera: false,
    depth: clipSpace[3],
  };
}

function clampToNearPlane(point: Float32Array, other: Float32Array): Float32Array {
  const parametricT = (NEAR_CLIP_W - point[3]) / (other[3] - point[3]);
  return vec4.lerp(point, other, parametricT) as Float32Array;
}

/** A world point in pixels of a `width` × `height` viewport, or behind the camera. */
export function projectPoint(
  mvpMatrix: Float32Array,
  point: Vec3Array,
  width: number,
  height: number
): ProjectedVertex {
  const clipSpace = toClipSpace(mvpMatrix, point);
  return clipSpace[3] <= 0 ? BEHIND_CAMERA : clipToScreen(clipSpace, width, height);
}

/**
 * Projects a segment with near-plane clipping: an endpoint behind the camera is
 * moved onto the near plane instead of discarding the whole segment.
 */
export function projectSegment(
  mvpMatrix: Float32Array,
  pointA: Vec3Array,
  pointB: Vec3Array,
  width: number,
  height: number
): ProjectedSegment {
  const clipA = toClipSpace(mvpMatrix, pointA);
  const clipB = toClipSpace(mvpMatrix, pointB);

  if (clipA[3] <= 0 && clipB[3] <= 0) {
    return { start: BEHIND_CAMERA, end: BEHIND_CAMERA };
  }

  const clampedA = clipA[3] < NEAR_CLIP_W ? clampToNearPlane(clipA, clipB) : clipA;
  const clampedB = clipB[3] < NEAR_CLIP_W ? clampToNearPlane(clipB, clipA) : clipB;

  return {
    start: clipToScreen(clampedA, width, height),
    end: clipToScreen(clampedB, width, height),
  };
}
