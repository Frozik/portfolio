import { createPointerGestureTracker } from '@frozik/utils/webgpu/pointerGestureTracker';
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
  WHEEL_ZOOM_SENSITIVITY,
} from '../domain/sun-constants';

export interface SunCameraController {
  tick(): void;
  getViewMatrix(): Float32Array;
  destroy(): void;
}

/**
 * Trackball-style orbital camera controller.
 * Rotations are applied in screen space so dragging always moves the object
 * in the direction of the cursor, regardless of current orientation.
 */
export function createSunCameraController(canvas: HTMLCanvasElement): SunCameraController {
  let distance = INITIAL_CAMERA_DISTANCE;

  // Camera position on the unit sphere, scaled by distance at render time.
  const initialAzimuth = 0;
  const initialElevation = INITIAL_ELEVATION;
  let camPos = vec3.fromValues(
    Math.sin(initialElevation) * Math.sin(initialAzimuth),
    Math.cos(initialElevation),
    Math.sin(initialElevation) * Math.cos(initialAzimuth)
  );
  // Camera "up" direction — starts as world Y, updated with rotations
  let camUp = vec3.fromValues(0, 1, 0);

  /**
   * Apply a screen-space rotation: dx rotates around the camera's local up,
   * dy rotates around the camera's local right axis.
   */
  function applyRotation(dx: number, dy: number): void {
    // Camera's right axis = normalize(cross(lookDir, up))
    // lookDir = -camPos (camera looks at origin)
    const lookDir = vec3.negate(camPos);
    const right = vec3.normalize(vec3.cross(lookDir, camUp));

    // Rotation around the right axis (vertical drag)
    if (Math.abs(dy) > 0) {
      const angleY = -dy * MOUSE_ROTATE_SENSITIVITY;
      const rotY = mat4.rotation(right, angleY);
      camPos = vec3.transformMat4(camPos, rotY);
      camUp = vec3.normalize(vec3.transformMat4(camUp, rotY));
    }

    // Rotation around the up axis (horizontal drag)
    if (Math.abs(dx) > 0) {
      const angleX = -dx * MOUSE_ROTATE_SENSITIVITY;
      const rotX = mat4.rotation(camUp, angleX);
      camPos = vec3.transformMat4(camPos, rotX);
    }

    // Re-normalize to prevent drift
    camPos = vec3.normalize(camPos);
  }

  function clampDistance(value: number): number {
    return Math.max(MIN_CAMERA_DISTANCE, Math.min(MAX_CAMERA_DISTANCE, value));
  }

  let velocityX = 0;
  let velocityY = 0;
  let lastMoveTimestamp = 0;

  function handleDrag(dx: number, dy: number, timeStamp: number): void {
    const elapsedSinceLastMove = timeStamp - lastMoveTimestamp;
    lastMoveTimestamp = timeStamp;

    if (elapsedSinceLastMove > INERTIA_STALE_MOVE_MS) {
      velocityX = 0;
      velocityY = 0;
    } else {
      velocityX = dx;
      velocityY = dy;
    }

    applyRotation(dx, dy);
  }

  function handlePinch(scale: number): void {
    distance = clampDistance(distance * scale);
  }

  function handleWheel(deltaY: number): void {
    distance = clampDistance(distance * (1 + deltaY * WHEEL_ZOOM_SENSITIVITY));
  }

  function handleReset(): void {
    velocityX = 0;
    velocityY = 0;
  }

  const gestureTracker = createPointerGestureTracker(canvas, {
    onDrag: handleDrag,
    onPinch: handlePinch,
    onWheel: handleWheel,
    onReset: handleReset,
  });

  return {
    tick(): void {
      if (gestureTracker.hasActivePointers()) {
        return;
      }

      if (
        Math.abs(velocityX) < INERTIA_MIN_VELOCITY &&
        Math.abs(velocityY) < INERTIA_MIN_VELOCITY
      ) {
        velocityX = 0;
        velocityY = 0;
        return;
      }

      applyRotation(velocityX, velocityY);

      velocityX *= INERTIA_DAMPING;
      velocityY *= INERTIA_DAMPING;
    },

    getViewMatrix(): Float32Array {
      const eye = vec3.scale(camPos, distance);
      const lookAtTarget = vec3.fromValues(0, 0, 0);

      return mat4.lookAt(eye, lookAtTarget, camUp) as Float32Array;
    },

    destroy(): void {
      gestureTracker.destroy();
    },
  };
}
