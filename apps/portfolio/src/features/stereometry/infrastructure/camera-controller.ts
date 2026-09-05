import { createPointerGestureTracker } from '@frozik/utils/webgpu/pointerGestureTracker';
import {
  INERTIA_DAMPING,
  INERTIA_MIN_VELOCITY,
  INERTIA_RELEASE_TIMEOUT_MS,
  MOUSE_PAN_SENSITIVITY,
  MOUSE_ROTATE_SENSITIVITY,
  WHEEL_ZOOM_SENSITIVITY,
  ZOOM_SMOOTHING_FACTOR,
  ZOOM_SNAP_THRESHOLD,
} from '../domain/constants';
import {
  computeEyePosition,
  computeRightVector,
  computeUpVector,
  computeViewMatrix,
  resolveCameraSettings,
} from '../domain/orbit-camera';
import type { Vec3Array } from '../domain/topology-types';
import type { CameraInteractionMode, PuzzleCamera } from '../domain/types';

export interface OrbitalCameraController {
  /** Advances camera animation by one frame. Returns true if animation is still active. */
  tick(): boolean;
  getViewMatrix(): Float32Array;
  getEyePosition(): Vec3Array;
  getDistance(): number;
  /** Adds a pointer the controller didn't receive via its own pointerdown listener
   *  (e.g. a capture-phase handler stopped propagation). Used by the drag-connector
   *  to hand off the first finger when a second arrives so pinch-zoom still works. */
  registerExternalPointer(pointerId: number, clientX: number, clientY: number): void;
  destroy(): void;
}

/**
 * Turntable orbital camera controller for stereometry.
 * Drag rotates azimuth only (horizontal), elevation is fixed.
 * Pan mode translates the lookAt target along the camera's screen-plane axes.
 * Shift+drag always pans regardless of current mode.
 * Scroll/pinch always zooms.
 *
 * Uses Pointer Events for unified mouse/touch/pen handling.
 */
export function createOrbitalCameraController(
  canvas: HTMLCanvasElement,
  puzzleCamera: PuzzleCamera | undefined,
  getInteractionMode: () => CameraInteractionMode
): OrbitalCameraController {
  const settings = resolveCameraSettings(puzzleCamera);
  const { minDistance, maxDistance, elevation } = settings;
  const rotationCenter = settings.center;

  let azimuth = settings.azimuth;
  let distance = settings.initialDistance;
  let targetDistance = settings.initialDistance;

  const target: [number, number, number] = [
    rotationCenter[0],
    rotationCenter[1],
    rotationCenter[2],
  ];

  let azimuthVelocity = 0;
  let panVelocityX = 0;
  let panVelocityY = 0;

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
    const right = computeRightVector(azimuth);

    target[0] -= right[0] * deltaX * panScale;
    target[1] += deltaY * panScale;
    target[2] -= right[2] * deltaX * panScale;
  }

  function clampDistance(value: number): number {
    return Math.max(minDistance, Math.min(maxDistance, value));
  }

  function resetVelocity(): void {
    azimuthVelocity = 0;
    panVelocityX = 0;
    panVelocityY = 0;
  }

  let isShiftHeld = false;
  let lastDragMoveTime = 0;

  function handleGestureStart(event: PointerEvent): void {
    isShiftHeld = event.shiftKey;
  }

  function handleDrag(deltaX: number, deltaY: number): void {
    lastDragMoveTime = performance.now();

    const shouldPan = isShiftHeld || getInteractionMode() === 'pan';

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

  function handlePinch(scale: number): void {
    targetDistance = clampDistance(targetDistance * scale);
  }

  function handleWheel(deltaY: number): void {
    targetDistance = clampDistance(targetDistance * (1 + deltaY * WHEEL_ZOOM_SENSITIVITY));
  }

  function handleGestureEnd(): void {
    isShiftHeld = false;

    // "Drag, hold still, release" must not fling the camera with the
    // stale velocity of the last movement before the pause
    if (performance.now() - lastDragMoveTime > INERTIA_RELEASE_TIMEOUT_MS) {
      resetVelocity();
    }
  }

  function handleReset(): void {
    isShiftHeld = false;
    resetVelocity();
  }

  const gestureTracker = createPointerGestureTracker(canvas, {
    onDrag: handleDrag,
    onPinch: handlePinch,
    onWheel: handleWheel,
    onReset: handleReset,
    onGestureStart: handleGestureStart,
    onGestureEnd: handleGestureEnd,
  });

  return {
    tick(): boolean {
      const isZooming = Math.abs(targetDistance - distance) > ZOOM_SNAP_THRESHOLD;
      if (isZooming) {
        distance += (targetDistance - distance) * ZOOM_SMOOTHING_FACTOR;
      } else {
        distance = targetDistance;
      }

      if (gestureTracker.hasActivePointers()) {
        return true;
      }

      const hasAzimuthVelocity = Math.abs(azimuthVelocity) >= INERTIA_MIN_VELOCITY;
      const hasPanVelocity =
        Math.abs(panVelocityX) >= INERTIA_MIN_VELOCITY ||
        Math.abs(panVelocityY) >= INERTIA_MIN_VELOCITY;

      if (!hasAzimuthVelocity && !hasPanVelocity) {
        resetVelocity();
        return isZooming;
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

      return true;
    },

    getViewMatrix(): Float32Array {
      return computeViewMatrix(
        computeEyePosition(target, azimuth, elevation, distance),
        target,
        computeUpVector(azimuth, elevation)
      );
    },

    getEyePosition(): Vec3Array {
      return computeEyePosition(target, azimuth, elevation, distance);
    },

    getDistance(): number {
      return distance;
    },

    registerExternalPointer(pointerId: number, clientX: number, clientY: number): void {
      gestureTracker.registerExternalPointer(pointerId, clientX, clientY);
    },

    destroy(): void {
      gestureTracker.destroy();
    },
  };
}
