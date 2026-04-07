import { mat4, vec3 } from 'wgpu-matrix';

import {
  ELEVATION_MAX,
  ELEVATION_MIN,
  INITIAL_CAMERA_DISTANCE,
  INITIAL_ELEVATION,
  MAX_CAMERA_DISTANCE,
  MIN_CAMERA_DISTANCE,
  MOUSE_ROTATE_SENSITIVITY,
  WHEEL_ZOOM_SENSITIVITY,
} from './sun-constants';

export interface OrbitalCameraController {
  getViewMatrix(): Float32Array;
  destroy(): void;
}

export function createOrbitalCameraController(canvas: HTMLCanvasElement): OrbitalCameraController {
  let azimuth = 0;
  let elevation = INITIAL_ELEVATION;
  let distance = INITIAL_CAMERA_DISTANCE;

  // Mouse tracking
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

    azimuth -= dx * MOUSE_ROTATE_SENSITIVITY;
    elevation = Math.max(
      ELEVATION_MIN,
      Math.min(ELEVATION_MAX, elevation + dy * MOUSE_ROTATE_SENSITIVITY)
    );
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

  // Touch support
  let lastTouchX = 0;
  let lastTouchY = 0;
  let isTouching = false;

  function onTouchStart(e: TouchEvent) {
    if (e.touches.length === 1) {
      isTouching = true;
      lastTouchX = e.touches[0].clientX;
      lastTouchY = e.touches[0].clientY;
    }
  }

  function onTouchMove(e: TouchEvent) {
    if (!isTouching || e.touches.length !== 1) {
      return;
    }

    e.preventDefault();

    const dx = e.touches[0].clientX - lastTouchX;
    const dy = e.touches[0].clientY - lastTouchY;
    lastTouchX = e.touches[0].clientX;
    lastTouchY = e.touches[0].clientY;

    azimuth -= dx * MOUSE_ROTATE_SENSITIVITY;
    elevation = Math.max(
      ELEVATION_MIN,
      Math.min(ELEVATION_MAX, elevation + dy * MOUSE_ROTATE_SENSITIVITY)
    );
  }

  function onTouchEnd() {
    isTouching = false;
  }

  canvas.addEventListener('touchstart', onTouchStart, { passive: true });
  canvas.addEventListener('touchmove', onTouchMove, { passive: false });
  canvas.addEventListener('touchend', onTouchEnd);

  return {
    getViewMatrix(): Float32Array {
      const camX = distance * Math.sin(elevation) * Math.sin(azimuth);
      const camY = distance * Math.cos(elevation);
      const camZ = distance * Math.sin(elevation) * Math.cos(azimuth);

      const eye = vec3.fromValues(camX, camY, camZ);
      const target = vec3.fromValues(0, 0, 0);
      const up = vec3.fromValues(0, 1, 0);

      return mat4.lookAt(eye, target, up) as Float32Array;
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
