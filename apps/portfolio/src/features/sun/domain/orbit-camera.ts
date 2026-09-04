import { clamp } from 'lodash-es';
import type { Mat4, Vec3 } from 'wgpu-matrix';
import { mat4, vec3 } from 'wgpu-matrix';

import {
  INERTIA_DAMPING,
  INERTIA_MIN_VELOCITY,
  INERTIA_STALE_MOVE_MS,
  INITIAL_CAMERA_DISTANCE,
  INITIAL_ELEVATION,
  MAX_CAMERA_DISTANCE,
  MIN_CAMERA_DISTANCE,
  MOUSE_ROTATE_SENSITIVITY,
} from './sun-constants';

/**
 * Trackball orbit around the origin. `position` and `up` stay unit vectors;
 * rotations are applied in screen space so a drag always moves the scene in
 * the cursor's direction whatever the current orientation.
 */
export interface OrbitCameraState {
  readonly position: Vec3;
  readonly up: Vec3;
  readonly distance: number;
  /** Last drag delta, replayed with damping once the pointer is released. */
  readonly velocity: { readonly x: number; readonly y: number };
}

const ORIGIN = vec3.fromValues(0, 0, 0);
const WORLD_UP = vec3.fromValues(0, 1, 0);
const NO_VELOCITY = { x: 0, y: 0 } as const;

export function createOrbitCamera(): OrbitCameraState {
  return {
    position: vec3.fromValues(0, Math.cos(INITIAL_ELEVATION), Math.sin(INITIAL_ELEVATION)),
    up: WORLD_UP,
    distance: INITIAL_CAMERA_DISTANCE,
    velocity: NO_VELOCITY,
  };
}

/** Horizontal drag orbits around the camera's up axis, vertical drag around its right axis. */
export function rotateCamera(state: OrbitCameraState, dx: number, dy: number): OrbitCameraState {
  const lookDirection = vec3.negate(state.position);
  const right = vec3.normalize(vec3.cross(lookDirection, state.up));

  const rotationAroundRight = mat4.rotation(right, -dy * MOUSE_ROTATE_SENSITIVITY);
  const tiltedPosition = vec3.transformMat4(state.position, rotationAroundRight);
  const tiltedUp = vec3.normalize(vec3.transformMat4(state.up, rotationAroundRight));

  const rotationAroundUp = mat4.rotation(tiltedUp, -dx * MOUSE_ROTATE_SENSITIVITY);
  const position = vec3.normalize(vec3.transformMat4(tiltedPosition, rotationAroundUp));

  return { ...state, position, up: tiltedUp };
}

/** A drag step: rotates and remembers the delta as inertia unless the previous step went stale. */
export function dragCamera(
  state: OrbitCameraState,
  dx: number,
  dy: number,
  elapsedSinceLastMoveMs: number
): OrbitCameraState {
  const velocity = elapsedSinceLastMoveMs > INERTIA_STALE_MOVE_MS ? NO_VELOCITY : { x: dx, y: dy };
  return { ...rotateCamera(state, dx, dy), velocity };
}

export function stopCameraInertia(state: OrbitCameraState): OrbitCameraState {
  return { ...state, velocity: NO_VELOCITY };
}

/** One frame of coasting after a release; settles to rest below the velocity floor. */
export function coastCamera(state: OrbitCameraState): OrbitCameraState {
  const { x, y } = state.velocity;
  if (Math.abs(x) < INERTIA_MIN_VELOCITY && Math.abs(y) < INERTIA_MIN_VELOCITY) {
    return stopCameraInertia(state);
  }
  return {
    ...rotateCamera(state, x, y),
    velocity: { x: x * INERTIA_DAMPING, y: y * INERTIA_DAMPING },
  };
}

export function zoomCamera(state: OrbitCameraState, factor: number): OrbitCameraState {
  return {
    ...state,
    distance: clamp(state.distance * factor, MIN_CAMERA_DISTANCE, MAX_CAMERA_DISTANCE),
  };
}

export function cameraViewMatrix(state: OrbitCameraState): Mat4 {
  return mat4.lookAt(vec3.scale(state.position, state.distance), ORIGIN, state.up);
}
