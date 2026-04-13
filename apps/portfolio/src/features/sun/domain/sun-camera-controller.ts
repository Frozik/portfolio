import { mat4, vec3 } from 'wgpu-matrix';

import {
  INERTIA_DAMPING,
  INERTIA_MIN_VELOCITY,
  INITIAL_CAMERA_DISTANCE,
  INITIAL_ELEVATION,
  MAX_CAMERA_DISTANCE,
  MIN_CAMERA_DISTANCE,
  MOUSE_ROTATE_SENSITIVITY,
  WHEEL_ZOOM_SENSITIVITY,
} from './sun-constants';

export interface OrbitalCameraController {
  tick(): void;
  getViewMatrix(): Float32Array;
  destroy(): void;
}

/**
 * Trackball-style orbital camera controller.
 * Rotations are applied in screen space so dragging always moves the object
 * in the direction of the cursor, regardless of current orientation.
 *
 * Uses Pointer Events for unified mouse/touch/pen handling.
 */
export function createOrbitalCameraController(canvas: HTMLCanvasElement): OrbitalCameraController {
  let distance = INITIAL_CAMERA_DISTANCE;

  // Camera position on the unit sphere, scaled by distance at render time.
  // Initialize from spherical coordinates matching the old defaults.
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

  // --- Inertia ---

  let velocityX = 0;
  let velocityY = 0;

  // --- Pointer tracking ---
  const activePointers = new Map<number, { clientX: number; clientY: number }>();
  let lastPinchDistance = 0;

  function getPointerDistance(): number {
    const pointers = [...activePointers.values()];
    const dx = pointers[0].clientX - pointers[1].clientX;
    const dy = pointers[0].clientY - pointers[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  function onPointerDown(event: PointerEvent): void {
    activePointers.set(event.pointerId, {
      clientX: event.clientX,
      clientY: event.clientY,
    });

    if (activePointers.size === 2) {
      lastPinchDistance = getPointerDistance();
    }
  }

  function onPointerMove(event: PointerEvent): void {
    const previous = activePointers.get(event.pointerId);
    if (previous === undefined) {
      return;
    }

    activePointers.set(event.pointerId, {
      clientX: event.clientX,
      clientY: event.clientY,
    });

    // Pinch-to-zoom with two fingers
    if (activePointers.size === 2) {
      const currentDistance = getPointerDistance();
      const scale = lastPinchDistance / currentDistance;
      distance = clampDistance(distance * scale);
      lastPinchDistance = currentDistance;
      return;
    }

    // Single pointer rotation
    if (activePointers.size !== 1) {
      return;
    }

    const dx = event.clientX - previous.clientX;
    const dy = event.clientY - previous.clientY;

    velocityX = dx;
    velocityY = dy;

    applyRotation(dx, dy);
  }

  function onPointerUp(event: PointerEvent): void {
    activePointers.delete(event.pointerId);
  }

  function onPointerCancel(event: PointerEvent): void {
    activePointers.delete(event.pointerId);
  }

  function onWheel(event: WheelEvent): void {
    event.preventDefault();
    distance = clampDistance(distance * (1 + event.deltaY * WHEEL_ZOOM_SENSITIVITY));
  }

  canvas.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);
  window.addEventListener('pointercancel', onPointerCancel);
  canvas.addEventListener('wheel', onWheel, { passive: false });

  return {
    tick(): void {
      if (activePointers.size > 0) {
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
      canvas.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerCancel);
      canvas.removeEventListener('wheel', onWheel);
    },
  };
}
