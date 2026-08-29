import { createPointerGestureTracker } from '@frozik/utils/webgpu/pointerGestureTracker';
import { mat4, vec3 } from 'wgpu-matrix';
import {
  INERTIA_DAMPING,
  INERTIA_MIN_VELOCITY,
  INERTIA_RELEASE_TIMEOUT_MS,
  INITIAL_AZIMUTH,
  INITIAL_CAMERA_DISTANCE,
  INITIAL_ELEVATION,
  MAX_CAMERA_DISTANCE,
  MIN_CAMERA_DISTANCE,
  MOUSE_PAN_SENSITIVITY,
  MOUSE_ROTATE_SENSITIVITY,
  WHEEL_ZOOM_SENSITIVITY,
  ZOOM_SMOOTHING_FACTOR,
  ZOOM_SNAP_THRESHOLD,
} from '../domain/constants';
import type { Vec3Array } from '../domain/topology-types';
import type { CameraInteractionMode, PuzzleCamera } from '../domain/types';

export interface OrbitalCameraController {
  /** Advances camera animation by one frame. Returns true if animation is still active. */
  tick(): boolean;
  getViewMatrix(): Float32Array;
  getEyePosition(): Vec3Array;
  getDistance(): number;
  setInteractionMode(mode: CameraInteractionMode): void;
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
  puzzleCamera?: PuzzleCamera
): OrbitalCameraController {
  const minDistance = puzzleCamera?.distance?.min ?? MIN_CAMERA_DISTANCE;
  const maxDistance = puzzleCamera?.distance?.max ?? MAX_CAMERA_DISTANCE;
  const initialDistance = puzzleCamera?.distance?.initial ?? INITIAL_CAMERA_DISTANCE;
  const rotationCenter = puzzleCamera?.center ?? [0, 0, 0];

  let azimuth = puzzleCamera?.angle?.azimuth ?? INITIAL_AZIMUTH;
  const elevation = puzzleCamera?.angle?.elevation ?? INITIAL_ELEVATION;

  let distance = initialDistance;
  let targetDistance = initialDistance;

  const target: [number, number, number] = [
    rotationCenter[0],
    rotationCenter[1],
    rotationCenter[2],
  ];

  let interactionMode: CameraInteractionMode = 'rotate';

  let azimuthVelocity = 0;
  let panVelocityX = 0;
  let panVelocityY = 0;

  function computeEyePosition(): Vec3Array {
    return [
      target[0] + Math.sin(elevation) * Math.sin(azimuth) * distance,
      target[1] + Math.cos(elevation) * distance,
      target[2] + Math.sin(elevation) * Math.cos(azimuth) * distance,
    ];
  }

  /** Screen-plane up vector derived from azimuth and elevation */
  function computeUpVector(): Vec3Array {
    return [
      -Math.cos(elevation) * Math.sin(azimuth),
      Math.sin(elevation),
      -Math.cos(elevation) * Math.cos(azimuth),
    ];
  }

  /** Screen-plane right vector (always horizontal) */
  function computeRightVector(): Vec3Array {
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
      const eye = computeEyePosition();
      const up = computeUpVector();

      return mat4.lookAt(
        vec3.fromValues(eye[0], eye[1], eye[2]),
        vec3.fromValues(target[0], target[1], target[2]),
        vec3.fromValues(up[0], up[1], up[2])
      ) as Float32Array;
    },

    getEyePosition(): Vec3Array {
      return computeEyePosition();
    },

    getDistance(): number {
      return distance;
    },

    setInteractionMode(mode: CameraInteractionMode): void {
      interactionMode = mode;
      resetVelocity();
    },

    registerExternalPointer(pointerId: number, clientX: number, clientY: number): void {
      gestureTracker.registerExternalPointer(pointerId, clientX, clientY);
    },

    destroy(): void {
      gestureTracker.destroy();
    },
  };
}
