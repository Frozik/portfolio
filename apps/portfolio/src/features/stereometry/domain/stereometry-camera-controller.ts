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
  ZOOM_SMOOTHING_FACTOR,
  ZOOM_SNAP_THRESHOLD,
} from './stereometry-constants';

export interface OrbitalCameraController {
  tick(): void;
  getViewMatrix(): Float32Array;
  destroy(): void;
}

/**
 * Trackball-style orbital camera controller for stereometry.
 * Rotations are applied in screen space so dragging always moves the object
 * in the direction of the cursor, regardless of current orientation.
 * Zoom is animated with exponential easing for a smooth feel.
 */
export function createOrbitalCameraController(canvas: HTMLCanvasElement): OrbitalCameraController {
  let distance = INITIAL_CAMERA_DISTANCE;
  let targetDistance = INITIAL_CAMERA_DISTANCE;

  const initialAzimuth = 0;
  const initialElevation = INITIAL_ELEVATION;
  let cameraPosition = vec3.fromValues(
    Math.sin(initialElevation) * Math.sin(initialAzimuth),
    Math.cos(initialElevation),
    Math.sin(initialElevation) * Math.cos(initialAzimuth)
  );
  let cameraUp = vec3.fromValues(0, 1, 0);

  function applyRotation(deltaX: number, deltaY: number): void {
    const lookDirection = vec3.negate(cameraPosition);
    const rightAxis = vec3.normalize(vec3.cross(lookDirection, cameraUp));

    if (Math.abs(deltaY) > 0) {
      const verticalAngle = -deltaY * MOUSE_ROTATE_SENSITIVITY;
      const verticalRotation = mat4.rotation(rightAxis, verticalAngle);
      cameraPosition = vec3.transformMat4(cameraPosition, verticalRotation);
      cameraUp = vec3.normalize(vec3.transformMat4(cameraUp, verticalRotation));
    }

    if (Math.abs(deltaX) > 0) {
      const horizontalAngle = -deltaX * MOUSE_ROTATE_SENSITIVITY;
      const horizontalRotation = mat4.rotation(cameraUp, horizontalAngle);
      cameraPosition = vec3.transformMat4(cameraPosition, horizontalRotation);
    }

    cameraPosition = vec3.normalize(cameraPosition);
  }

  function clampDistance(value: number): number {
    return Math.max(MIN_CAMERA_DISTANCE, Math.min(MAX_CAMERA_DISTANCE, value));
  }

  let velocityX = 0;
  let velocityY = 0;

  let isDragging = false;
  let lastMouseX = 0;
  let lastMouseY = 0;

  function onMouseDown(event: MouseEvent): void {
    isDragging = true;
    lastMouseX = event.clientX;
    lastMouseY = event.clientY;
  }

  function onMouseMove(event: MouseEvent): void {
    if (!isDragging) {
      return;
    }

    const deltaX = event.clientX - lastMouseX;
    const deltaY = event.clientY - lastMouseY;
    lastMouseX = event.clientX;
    lastMouseY = event.clientY;

    velocityX = deltaX;
    velocityY = deltaY;

    applyRotation(deltaX, deltaY);
  }

  function onMouseUp(): void {
    isDragging = false;
  }

  function onWheel(event: WheelEvent): void {
    event.preventDefault();
    targetDistance = clampDistance(targetDistance * (1 + event.deltaY * WHEEL_ZOOM_SENSITIVITY));
  }

  canvas.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mouseup', onMouseUp);
  canvas.addEventListener('wheel', onWheel, { passive: false });

  let lastTouchX = 0;
  let lastTouchY = 0;
  let isTouching = false;
  let lastPinchDistance = 0;

  function getTouchDistance(event: TouchEvent): number {
    const deltaX = event.touches[0].clientX - event.touches[1].clientX;
    const deltaY = event.touches[0].clientY - event.touches[1].clientY;
    return Math.sqrt(deltaX * deltaX + deltaY * deltaY);
  }

  function onTouchStart(event: TouchEvent): void {
    if (event.touches.length === 1) {
      isTouching = true;
      lastTouchX = event.touches[0].clientX;
      lastTouchY = event.touches[0].clientY;
    } else if (event.touches.length === 2) {
      isTouching = false;
      lastPinchDistance = getTouchDistance(event);
    }
  }

  function onTouchMove(event: TouchEvent): void {
    event.preventDefault();

    if (event.touches.length === 2) {
      const currentDistance = getTouchDistance(event);
      const scale = lastPinchDistance / currentDistance;
      targetDistance = clampDistance(targetDistance * scale);
      lastPinchDistance = currentDistance;
      return;
    }

    if (!isTouching || event.touches.length !== 1) {
      return;
    }

    const deltaX = event.touches[0].clientX - lastTouchX;
    const deltaY = event.touches[0].clientY - lastTouchY;
    lastTouchX = event.touches[0].clientX;
    lastTouchY = event.touches[0].clientY;

    velocityX = deltaX;
    velocityY = deltaY;

    applyRotation(deltaX, deltaY);
  }

  function onTouchEnd(event: TouchEvent): void {
    if (event.touches.length === 0) {
      isTouching = false;
    } else if (event.touches.length === 1) {
      isTouching = true;
      lastTouchX = event.touches[0].clientX;
      lastTouchY = event.touches[0].clientY;
    }
  }

  canvas.addEventListener('touchstart', onTouchStart, { passive: true });
  canvas.addEventListener('touchmove', onTouchMove, { passive: false });
  canvas.addEventListener('touchend', onTouchEnd);

  return {
    tick(): void {
      // Smooth zoom: exponential interpolation towards target distance
      const zoomDelta = targetDistance - distance;
      if (Math.abs(zoomDelta) > ZOOM_SNAP_THRESHOLD) {
        distance += zoomDelta * ZOOM_SMOOTHING_FACTOR;
      } else {
        distance = targetDistance;
      }

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
      const eye = vec3.scale(cameraPosition, distance);
      const target = vec3.fromValues(0, 0, 0);

      return mat4.lookAt(eye, target, cameraUp) as Float32Array;
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
