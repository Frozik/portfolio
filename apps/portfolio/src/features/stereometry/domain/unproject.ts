import { mat4, vec4 } from 'wgpu-matrix';

import { HOMOGENEOUS_W } from './constants';
import type { Vec3Array } from './topology-types';

export interface ScreenViewport {
  readonly canvasWidth: number;
  readonly canvasHeight: number;
  readonly devicePixelRatio: number;
}

/**
 * Maps a CSS-pixel screen position back into the world, onto the plane through
 * `referencePosition` that faces the camera: the reference's clip-space depth
 * is reused so the result sits exactly as deep as the reference.
 */
export function unprojectToReferencePlane(
  mvpMatrix: Float32Array,
  viewport: ScreenViewport,
  screenX: number,
  screenY: number,
  referencePosition: Vec3Array
): Vec3Array {
  const pixelX = screenX * viewport.devicePixelRatio;
  const pixelY = screenY * viewport.devicePixelRatio;
  const ndcX = (pixelX / viewport.canvasWidth) * 2 - 1;
  const ndcY = 1 - (pixelY / viewport.canvasHeight) * 2;

  const referenceClip = vec4.transformMat4(
    vec4.fromValues(
      referencePosition[0],
      referencePosition[1],
      referencePosition[2],
      HOMOGENEOUS_W
    ),
    mvpMatrix
  );
  const referenceNdcZ = referenceClip[2] / referenceClip[3];

  const worldPoint = vec4.transformMat4(
    vec4.fromValues(ndcX, ndcY, referenceNdcZ, HOMOGENEOUS_W),
    mat4.inverse(mvpMatrix)
  );

  return [
    worldPoint[0] / worldPoint[3],
    worldPoint[1] / worldPoint[3],
    worldPoint[2] / worldPoint[3],
  ];
}
