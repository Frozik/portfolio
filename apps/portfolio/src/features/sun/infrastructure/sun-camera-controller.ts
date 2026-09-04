import { createPointerGestureTracker } from '@frozik/utils/webgpu/pointerGestureTracker';
import type { Mat4 } from 'wgpu-matrix';

import type { OrbitCameraState } from '../domain/orbit-camera';
import {
  cameraViewMatrix,
  coastCamera,
  createOrbitCamera,
  dragCamera,
  stopCameraInertia,
  zoomCamera,
} from '../domain/orbit-camera';
import { WHEEL_ZOOM_SENSITIVITY } from '../domain/sun-constants';

export interface SunCameraController {
  tick(): void;
  getViewMatrix(): Mat4;
  destroy(): void;
}

/** Maps canvas gestures onto the pure orbit camera and coasts it between frames. */
export function createSunCameraController(canvas: HTMLCanvasElement): SunCameraController {
  let state: OrbitCameraState = createOrbitCamera();
  let lastMoveTimestamp = 0;

  const gestureTracker = createPointerGestureTracker(canvas, {
    onDrag(dx: number, dy: number, timeStamp: number): void {
      state = dragCamera(state, dx, dy, timeStamp - lastMoveTimestamp);
      lastMoveTimestamp = timeStamp;
    },
    onPinch(scale: number): void {
      state = zoomCamera(state, scale);
    },
    onWheel(deltaY: number): void {
      state = zoomCamera(state, 1 + deltaY * WHEEL_ZOOM_SENSITIVITY);
    },
    onReset(): void {
      state = stopCameraInertia(state);
    },
  });

  return {
    tick(): void {
      if (!gestureTracker.hasActivePointers()) {
        state = coastCamera(state);
      }
    },
    getViewMatrix(): Mat4 {
      return cameraViewMatrix(state);
    },
    destroy(): void {
      gestureTracker.destroy();
    },
  };
}
