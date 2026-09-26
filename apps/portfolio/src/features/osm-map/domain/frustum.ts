import type { Mat4 } from 'wgpu-matrix';

import type { WorldVector } from './map-camera';
import type { GroundPoint } from './mercator';
import type { GroundRect } from './tile-key';

/** Half-space `a·x + b·y + c·z + d ≥ 0` is inside. */
export interface Plane {
  readonly a: number;
  readonly b: number;
  readonly c: number;
  readonly d: number;
}

const ROW_COUNT = 4;
const X_ROW = 0;
const Y_ROW = 1;
const Z_ROW = 2;
const W_ROW = 3;

function row(matrix: Mat4, index: number): Plane {
  return {
    a: matrix[index],
    b: matrix[ROW_COUNT + index],
    c: matrix[2 * ROW_COUNT + index],
    d: matrix[3 * ROW_COUNT + index],
  };
}

function combine(base: Plane, other: Plane, sign: 1 | -1): Plane {
  return {
    a: base.a + sign * other.a,
    b: base.b + sign * other.b,
    c: base.c + sign * other.c,
    d: base.d + sign * other.d,
  };
}

/** Shifts a plane expressed around `origin` into absolute ground coordinates, in float64. */
function translate(plane: Plane, origin: GroundPoint): Plane {
  return { ...plane, d: plane.d - plane.a * origin.x - plane.c * origin.y };
}

/**
 * Gribb–Hartmann extraction for WebGPU clip space (`0 ≤ z ≤ w`) from a
 * view-projection built around `origin`; the planes come back in absolute
 * world coordinates.
 */
export function frustumPlanes(viewProjection: Mat4, origin: GroundPoint): readonly Plane[] {
  const w = row(viewProjection, W_ROW);
  const x = row(viewProjection, X_ROW);
  const y = row(viewProjection, Y_ROW);
  const z = row(viewProjection, Z_ROW);
  return [
    combine(w, x, 1),
    combine(w, x, -1),
    combine(w, y, 1),
    combine(w, y, -1),
    z,
    combine(w, z, -1),
  ].map(plane => translate(plane, origin));
}

/** Whether a rectangle on the ground plane (`Y = 0`) touches the frustum. */
export function intersectsGroundRect(planes: readonly Plane[], rect: GroundRect): boolean {
  return planes.every(plane => {
    const farthestX = plane.a >= 0 ? rect.maxX : rect.minX;
    const farthestZ = plane.c >= 0 ? rect.maxY : rect.minY;
    return plane.a * farthestX + plane.c * farthestZ + plane.d >= 0;
  });
}

/** Distance from a point to the nearest point of a ground rectangle. */
export function distanceToGroundRect(position: WorldVector, rect: GroundRect): number {
  const deltaX = Math.min(Math.max(position.x, rect.minX), rect.maxX) - position.x;
  const deltaZ = Math.min(Math.max(position.z, rect.minY), rect.maxY) - position.z;
  return Math.hypot(deltaX, position.y, deltaZ);
}
