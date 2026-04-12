import { mat4, vec3 } from 'wgpu-matrix';

import {
  INERTIA_DAMPING,
  INERTIA_MIN_VELOCITY,
  INITIAL_CAMERA_DISTANCE,
  INITIAL_ELEVATION,
  MAX_CAMERA_DISTANCE,
  MIN_CAMERA_DISTANCE,
  MOUSE_PAN_SENSITIVITY,
  MOUSE_ROTATE_SENSITIVITY,
  WHEEL_ZOOM_SENSITIVITY,
  ZOOM_SMOOTHING_FACTOR,
  ZOOM_SNAP_THRESHOLD,
} from './stereometry-constants';
import type { CameraInteractionMode } from './stereometry-types';

export interface OrbitalCameraController {
  tick(): void;
  getViewMatrix(): Float32Array;
  getEyePosition(): [number, number, number];
  getDistance(): number;
  setInteractionMode(mode: CameraInteractionMode): void;
  destroy(): void;
}

/**
 * Turntable orbital camera controller for stereometry.
 * Drag rotates azimuth only (horizontal), elevation is fixed.
 * Pan mode translates the lookAt target along the camera's screen-plane axes.
 * Shift+drag always pans regardless of current mode.
 * Scroll/pinch always zooms.
 */
export function createOrbitalCameraController(
  canvas: HTMLCanvasElement,
  rotationCenter: readonly [number, number, number] = [0, 0, 0]
): OrbitalCameraController {
  let azimuth = 0;
  const elevation = INITIAL_ELEVATION;

  let distance = INITIAL_CAMERA_DISTANCE;
  let targetDistance = INITIAL_CAMERA_DISTANCE;

  const target: [number, number, number] = [
    rotationCenter[0],
    rotationCenter[1],
    rotationCenter[2],
  ];

  let interactionMode: CameraInteractionMode = 'rotate';

  let azimuthVelocity = 0;
  let panVelocityX = 0;
  let panVelocityY = 0;

  function computeEyePosition(): [number, number, number] {
    return [
      target[0] + Math.sin(elevation) * Math.sin(azimuth) * distance,
      target[1] + Math.cos(elevation) * distance,
      target[2] + Math.sin(elevation) * Math.cos(azimuth) * distance,
    ];
  }

  /** Screen-plane up vector derived from azimuth and elevation */
  function computeUpVector(): [number, number, number] {
    return [
      -Math.cos(elevation) * Math.sin(azimuth),
      Math.sin(elevation),
      -Math.cos(elevation) * Math.cos(azimuth),
    ];
  }

  /** Screen-plane right vector (always horizontal) */
  function computeRightVector(): [number, number, number] {
    return [Math.cos(azimuth), 0, -Math.sin(azimuth)];
  }

  function applyRotation(deltaX: number): void {
    const deltaAzimuth = -deltaX * MOUSE_ROTATE_SENSITIVITY;
    azimuth += deltaAzimuth;

    // Rotate the pan offset around rotationCenter so the figure stays
    // at the same screen position during rotation
    const offsetX = target[0] - rotationCenter[0];
    const offsetZ = target[2] - rotationCenter[2];
    const cosAngle = Math.cos(deltaAzimuth);
    const sinAngle = Math.sin(deltaAzimuth);

    target[0] = rotationCenter[0] + offsetX * cosAngle + offsetZ * sinAngle;
    target[2] = rotationCenter[2] - offsetX * sinAngle + offsetZ * cosAngle;
  }

  function applyPan(deltaX: number, deltaY: number): void {
    const panScale = MOUSE_PAN_SENSITIVITY * distance;
    const right = computeRightVector();

    // Horizontal drag moves in the XZ plane, vertical drag moves along world Y axis
    target[0] -= right[0] * deltaX * panScale;
    target[1] += deltaY * panScale;
    target[2] -= right[2] * deltaX * panScale;
  }

  function clampDistance(value: number): number {
    return Math.max(MIN_CAMERA_DISTANCE, Math.min(MAX_CAMERA_DISTANCE, value));
  }

  function resetVelocity(): void {
    azimuthVelocity = 0;
    panVelocityX = 0;
    panVelocityY = 0;
  }

  let isDragging = false;
  let lastMouseX = 0;
  let lastMouseY = 0;
  let isShiftHeld = false;

  function onMouseDown(event: MouseEvent): void {
    isDragging = true;
    lastMouseX = event.clientX;
    lastMouseY = event.clientY;
    isShiftHeld = event.shiftKey;
  }

  function onMouseMove(event: MouseEvent): void {
    if (!isDragging) {
      return;
    }

    const deltaX = event.clientX - lastMouseX;
    const deltaY = event.clientY - lastMouseY;
    lastMouseX = event.clientX;
    lastMouseY = event.clientY;

    const shouldPan = isShiftHeld || interactionMode === 'pan';

    if (shouldPan) {
      panVelocityX = deltaX;
      panVelocityY = deltaY;
      azimuthVelocity = 0;
      applyPan(deltaX, deltaY);
    } else {
      azimuthVelocity = deltaX;
      panVelocityX = 0;
      panVelocityY = 0;
      applyRotation(deltaX);
    }
  }

  function onMouseUp(): void {
    isDragging = false;
    isShiftHeld = false;
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

    if (interactionMode === 'pan') {
      panVelocityX = deltaX;
      panVelocityY = deltaY;
      azimuthVelocity = 0;
      applyPan(deltaX, deltaY);
    } else {
      azimuthVelocity = deltaX;
      panVelocityX = 0;
      panVelocityY = 0;
      applyRotation(deltaX);
    }
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
      const zoomDelta = targetDistance - distance;
      if (Math.abs(zoomDelta) > ZOOM_SNAP_THRESHOLD) {
        distance += zoomDelta * ZOOM_SMOOTHING_FACTOR;
      } else {
        distance = targetDistance;
      }

      if (isDragging || isTouching) {
        return;
      }

      const hasAzimuthVelocity = Math.abs(azimuthVelocity) >= INERTIA_MIN_VELOCITY;
      const hasPanVelocity =
        Math.abs(panVelocityX) >= INERTIA_MIN_VELOCITY ||
        Math.abs(panVelocityY) >= INERTIA_MIN_VELOCITY;

      if (!hasAzimuthVelocity && !hasPanVelocity) {
        resetVelocity();
        return;
      }

      if (hasAzimuthVelocity) {
        applyRotation(azimuthVelocity);
        azimuthVelocity *= INERTIA_DAMPING;
      }

      if (hasPanVelocity) {
        applyPan(panVelocityX, panVelocityY);
        panVelocityX *= INERTIA_DAMPING;
        panVelocityY *= INERTIA_DAMPING;
      }
    },

    getViewMatrix(): Float32Array {
      const eye = computeEyePosition();
      const up = computeUpVector();

      return mat4.lookAt(
        vec3.fromValues(eye[0], eye[1], eye[2]),
        vec3.fromValues(target[0], target[1], target[2]),
        vec3.fromValues(up[0], up[1], up[2])
      ) as Float32Array;
    },

    getEyePosition(): [number, number, number] {
      return computeEyePosition();
    },

    getDistance(): number {
      return distance;
    },

    setInteractionMode(mode: CameraInteractionMode): void {
      interactionMode = mode;
      resetVelocity();
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
