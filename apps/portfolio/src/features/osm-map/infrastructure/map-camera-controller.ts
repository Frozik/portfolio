import type { PointerPosition } from '@frozik/utils/webgpu/pointerGestureTracker';
import { createPointerGestureTracker } from '@frozik/utils/webgpu/pointerGestureTracker';

import { ROTATE_SENSITIVITY, TILT_SENSITIVITY, WHEEL_ZOOM_SENSITIVITY } from '../domain/constants';
import type { MapCameraState, PixelPoint, Viewport } from '../domain/map-camera';
import {
  coastCamera,
  createMapCamera,
  dragCamera,
  moveCameraTo,
  rotateBy,
  setCameraView,
  stopInertia,
  tiltBy,
  zoomAround,
} from '../domain/map-camera';
import type { MapView } from '../domain/map-view';
import type { LonLat } from '../domain/mercator';

export interface MapCameraController {
  /** Advances inertia and returns the camera; the same object comes back while nothing moved. */
  tick(): MapCameraState;
  setView(view: MapView): void;
  resetNorth(): void;
  moveTo(position: LonLat): void;
  destroy(): void;
}

type DragMode = 'pan' | 'rotate';

interface CanvasBounds {
  readonly left: number;
  readonly top: number;
  /** Device pixels per CSS pixel, from the canvas itself so DPR changes never desync. */
  readonly devicePixelRatio: number;
}

const SECONDARY_BUTTON = 2;

/**
 * Google-Maps gestures over the pure camera: drag pans by grabbing the ground,
 * the right button or Ctrl turns and tilts, the wheel and a pinch zoom around
 * the cursor, two fingers tilt by dragging and turn by twisting. Dragging
 * right and twisting clockwise both turn the map clockwise.
 */
export function createMapCameraController(
  canvas: HTMLCanvasElement,
  initialView: MapView,
  onInteraction: VoidFunction
): MapCameraController {
  let state = createMapCamera(initialView);
  let dragMode: DragMode = 'pan';
  let cursor: PixelPoint = { x: 0, y: 0 };
  let lastMoveTimestamp = 0;
  let bounds: CanvasBounds = measureBounds();

  function viewport(): Viewport {
    return { widthPx: canvas.width, heightPx: canvas.height };
  }

  /** Reading the rect forces layout, so it happens once per gesture, not per pointer move. */
  function measureBounds(): CanvasBounds {
    const rect = canvas.getBoundingClientRect();
    return {
      left: rect.left,
      top: rect.top,
      devicePixelRatio: rect.width > 0 ? canvas.width / rect.width : 1,
    };
  }

  function toCanvasPixel(position: PointerPosition): PixelPoint {
    return {
      x: (position.clientX - bounds.left) * bounds.devicePixelRatio,
      y: (position.clientY - bounds.top) * bounds.devicePixelRatio,
    };
  }

  function apply(next: MapCameraState): void {
    if (next !== state) {
      state = next;
      onInteraction();
    }
  }

  function preventContextMenu(event: Event): void {
    event.preventDefault();
  }

  const gestureTracker = createPointerGestureTracker(canvas, {
    onGestureStart(event: PointerEvent): void {
      dragMode = event.button === SECONDARY_BUTTON || event.ctrlKey ? 'rotate' : 'pan';
      bounds = measureBounds();
      cursor = toCanvasPixel(event);
      lastMoveTimestamp = event.timeStamp;
      apply(stopInertia(state));
    },
    onDrag(deltaX: number, deltaY: number, timeStamp: number): void {
      if (dragMode === 'rotate') {
        apply(tiltBy(rotateBy(state, -deltaX * ROTATE_SENSITIVITY), -deltaY * TILT_SENSITIVITY));
        return;
      }
      const scale = bounds.devicePixelRatio;
      const next = { x: cursor.x + deltaX * scale, y: cursor.y + deltaY * scale };
      apply(dragCamera(state, viewport(), cursor, next, timeStamp - lastMoveTimestamp));
      cursor = next;
      lastMoveTimestamp = timeStamp;
    },
    onPinch(scale: number, center: PointerPosition): void {
      apply(zoomAround(state, viewport(), -Math.log2(scale), toCanvasPixel(center)));
    },
    onTwoPointerDrag(_deltaX: number, deltaY: number): void {
      apply(tiltBy(state, -deltaY * TILT_SENSITIVITY));
    },
    onTwoPointerRotate(deltaRadians: number): void {
      apply(rotateBy(state, -deltaRadians));
    },
    onWheel(deltaY: number, position: PointerPosition): void {
      bounds = measureBounds();
      apply(
        zoomAround(state, viewport(), -deltaY * WHEEL_ZOOM_SENSITIVITY, toCanvasPixel(position))
      );
    },
    onReset(): void {
      apply(stopInertia(state));
    },
  });
  canvas.addEventListener('contextmenu', preventContextMenu);

  return {
    tick(): MapCameraState {
      if (!gestureTracker.hasActivePointers()) {
        apply(coastCamera(state));
      }
      return state;
    },
    setView(view: MapView): void {
      apply(stopInertia(setCameraView(state, view)));
    },
    resetNorth(): void {
      apply(rotateBy(state, -state.bearing));
    },
    moveTo(position: LonLat): void {
      apply(moveCameraTo(state, position));
    },
    destroy(): void {
      gestureTracker.destroy();
      canvas.removeEventListener('contextmenu', preventContextMenu);
    },
  };
}
