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

  // ── Inertia ──────────────────────────────────────────────────────────

  let velocityX = 0;
  let velocityY = 0;

  // ── Mouse ───────────────────────────────────────────────────────────

  let isDragging = false;
  let lastMouseX = 0;
  let lastMouseY = 0;

  function onMouseDown(e: MouseEvent) {
    isDragging = true;
    lastMouseX = e.clientX;
    lastMouseY = e.clientY;
  }

  function onMouseMove(e: MouseEvent) {
    if (!isDragging) {
      return;
    }

    const dx = e.clientX - lastMouseX;
    const dy = e.clientY - lastMouseY;
    lastMouseX = e.clientX;
    lastMouseY = e.clientY;

    velocityX = dx;
    velocityY = dy;

    applyRotation(dx, dy);
  }

  function onMouseUp() {
    isDragging = false;
  }

  function onWheel(e: WheelEvent) {
    e.preventDefault();
    distance = Math.max(
      MIN_CAMERA_DISTANCE,
      Math.min(MAX_CAMERA_DISTANCE, distance * (1 + e.deltaY * WHEEL_ZOOM_SENSITIVITY))
    );
  }

  canvas.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mouseup', onMouseUp);
  canvas.addEventListener('wheel', onWheel, { passive: false });

  // ── Touch — single finger rotation, two-finger pinch-to-zoom ──────

  let lastTouchX = 0;
  let lastTouchY = 0;
  let isTouching = false;
  let lastPinchDistance = 0;

  function getTouchDistance(e: TouchEvent): number {
    const dx = e.touches[0].clientX - e.touches[1].clientX;
    const dy = e.touches[0].clientY - e.touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  function onTouchStart(e: TouchEvent) {
    if (e.touches.length === 1) {
      isTouching = true;
      lastTouchX = e.touches[0].clientX;
      lastTouchY = e.touches[0].clientY;
    } else if (e.touches.length === 2) {
      isTouching = false;
      lastPinchDistance = getTouchDistance(e);
    }
  }

  function onTouchMove(e: TouchEvent) {
    e.preventDefault();

    // Pinch-to-zoom with two fingers
    if (e.touches.length === 2) {
      const currentDistance = getTouchDistance(e);
      const scale = lastPinchDistance / currentDistance;
      distance = Math.max(MIN_CAMERA_DISTANCE, Math.min(MAX_CAMERA_DISTANCE, distance * scale));
      lastPinchDistance = currentDistance;
      return;
    }

    // Single finger rotation
    if (!isTouching || e.touches.length !== 1) {
      return;
    }

    const dx = e.touches[0].clientX - lastTouchX;
    const dy = e.touches[0].clientY - lastTouchY;
    lastTouchX = e.touches[0].clientX;
    lastTouchY = e.touches[0].clientY;

    velocityX = dx;
    velocityY = dy;

    applyRotation(dx, dy);
  }

  function onTouchEnd(e: TouchEvent) {
    if (e.touches.length === 0) {
      isTouching = false;
    } else if (e.touches.length === 1) {
      isTouching = true;
      lastTouchX = e.touches[0].clientX;
      lastTouchY = e.touches[0].clientY;
    }
  }

  canvas.addEventListener('touchstart', onTouchStart, { passive: true });
  canvas.addEventListener('touchmove', onTouchMove, { passive: false });
  canvas.addEventListener('touchend', onTouchEnd);

  return {
    tick(): void {
      if (isDragging || isTouching) {
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
      const target = vec3.fromValues(0, 0, 0);

      return mat4.lookAt(eye, target, camUp) as Float32Array;
    },

    destroy(): void {
      canvas.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      canvas.removeEventListener('wheel', onWheel);
      canvas.removeEventListener('touchstart', onTouchStart);
      canvas.removeEventListener('touchmove', onTouchMove);
      canvas.removeEventListener('touchend', onTouchEnd);
    },
  };
}
