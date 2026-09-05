import { mat4 } from 'wgpu-matrix';

import { FAR_PLANE, FIELD_OF_VIEW_RADIANS, NEAR_PLANE, ORTHO_SCALE } from './constants';
import type { CameraProjection } from './types';

const MIN_ASPECT_DIMENSION = 1;

export function viewportAspect(width: number, height: number): number {
  return width / Math.max(MIN_ASPECT_DIMENSION, height);
}

/** The projection the renderer and the hit tester share, so picking never drifts from pixels. */
export function computeProjectionMatrix(
  projection: CameraProjection,
  aspect: number,
  cameraDistance: number,
  out: Float32Array = mat4.create() as Float32Array
): Float32Array {
  if (projection === 'orthographic') {
    const halfHeight = cameraDistance * ORTHO_SCALE;
    const halfWidth = halfHeight * aspect;
    mat4.ortho(-halfWidth, halfWidth, -halfHeight, halfHeight, NEAR_PLANE, FAR_PLANE, out);
    return out;
  }

  mat4.perspective(FIELD_OF_VIEW_RADIANS, aspect, NEAR_PLANE, FAR_PLANE, out);
  return out;
}

export function computeMvpMatrix(
  projectionMatrix: Float32Array,
  viewMatrix: Float32Array,
  out: Float32Array = mat4.create() as Float32Array
): Float32Array {
  mat4.multiply(projectionMatrix, viewMatrix, out);
  return out;
}
