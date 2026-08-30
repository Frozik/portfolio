import { isNil } from 'lodash-es';

import { computePinchScale, pointerDistance } from './pinchScale';

const DRAG_POINTER_COUNT = 1;
const PINCH_POINTER_COUNT = 2;

interface PointerPosition {
  readonly clientX: number;
  readonly clientY: number;
}

export interface PointerGestureHandlers {
  /** Single-pointer drag delta in client pixels. */
  readonly onDrag: (deltaX: number, deltaY: number, timeStamp: number) => void;
  /** Two-pointer pinch: multiply the tracked zoom distance by `scale`. */
  readonly onPinch: (scale: number) => void;
  /**
   * How far the midpoint between two pointers moved, in client pixels. Reported
   * alongside {@link onPinch} — the two are the same gesture, and a camera that
   * offers panning on touch reads both from it. Optional: consumers that only
   * zoom on two fingers leave it out.
   */
  readonly onTwoPointerDrag?: (deltaX: number, deltaY: number) => void;
  readonly onWheel: (deltaY: number) => void;
  /** Focus loss dropped every tracked pointer — consumers should reset momentum. */
  readonly onReset: VoidFunction;
  /** First pointer of a gesture went down; carries the modifier keys of that press. */
  readonly onGestureStart?: (event: PointerEvent) => void;
  /** Last pointer of a gesture was released (not fired for cancelled pointers). */
  readonly onGestureEnd?: VoidFunction;
}

export interface PointerGestureTracker {
  hasActivePointers(): boolean;
  /** Adds a pointer the tracker didn't receive via its own pointerdown listener
   *  (e.g. a capture-phase handler stopped propagation), so pinch still works. */
  registerExternalPointer(pointerId: number, clientX: number, clientY: number): void;
  destroy(): void;
}

/**
 * Pointer/wheel gesture tracking shared by the WebGPU camera controllers:
 * tracks up to two pointers for single-pointer drag and two-pointer pinch zoom,
 * and forwards raw gestures to the consumer, which owns all camera behaviour.
 *
 * Uses Pointer Events for unified mouse/touch/pen handling.
 */
export function createPointerGestureTracker(
  element: HTMLElement,
  handlers: PointerGestureHandlers
): PointerGestureTracker {
  const activePointers = new Map<number, PointerPosition>();
  let lastPinchDistance = 0;

  function measurePinchDistance(): number {
    const [first, second] = [...activePointers.values()];
    return pointerDistance(first.clientX, first.clientY, second.clientX, second.clientY);
  }

  function measurePinchCenter(): PointerPosition {
    const [first, second] = [...activePointers.values()];
    return {
      clientX: (first.clientX + second.clientX) / PINCH_POINTER_COUNT,
      clientY: (first.clientY + second.clientY) / PINCH_POINTER_COUNT,
    };
  }

  /**
   * A two-finger gesture carries a zoom and a translation at once, so a
   * degenerate separation (skipped zoom) must still report the translation.
   */
  function reportPinch(previousCenter: PointerPosition): void {
    const currentDistance = measurePinchDistance();
    const scale = computePinchScale(lastPinchDistance, currentDistance);

    if (!isNil(scale)) {
      lastPinchDistance = currentDistance;
      handlers.onPinch(scale);
    }

    const center = measurePinchCenter();

    handlers.onTwoPointerDrag?.(
      center.clientX - previousCenter.clientX,
      center.clientY - previousCenter.clientY
    );
  }

  function trackPointer(pointerId: number, clientX: number, clientY: number): void {
    activePointers.set(pointerId, { clientX, clientY });

    if (activePointers.size === PINCH_POINTER_COUNT) {
      lastPinchDistance = measurePinchDistance();
    }
  }

  function onPointerDown(event: PointerEvent): void {
    trackPointer(event.pointerId, event.clientX, event.clientY);

    // Without capture, releasing the pointer outside the browser window can
    // lose the pointerup — activePointers would stay non-empty and the consumer
    // would treat the gesture as still in progress forever
    try {
      element.setPointerCapture(event.pointerId);
    } catch {
      // Synthetic events (tests) have no active pointer to capture
    }

    if (activePointers.size === DRAG_POINTER_COUNT) {
      handlers.onGestureStart?.(event);
    }
  }

  function onPointerMove(event: PointerEvent): void {
    const previous = activePointers.get(event.pointerId);
    if (isNil(previous)) {
      return;
    }

    if (activePointers.size === PINCH_POINTER_COUNT) {
      const previousCenter = measurePinchCenter();

      activePointers.set(event.pointerId, { clientX: event.clientX, clientY: event.clientY });
      reportPinch(previousCenter);
      return;
    }

    activePointers.set(event.pointerId, { clientX: event.clientX, clientY: event.clientY });

    if (activePointers.size !== DRAG_POINTER_COUNT) {
      return;
    }

    handlers.onDrag(
      event.clientX - previous.clientX,
      event.clientY - previous.clientY,
      event.timeStamp
    );
  }

  function onPointerUp(event: PointerEvent): void {
    activePointers.delete(event.pointerId);

    if (activePointers.size === 0) {
      handlers.onGestureEnd?.();
    }
  }

  function onPointerCancel(event: PointerEvent): void {
    activePointers.delete(event.pointerId);
  }

  /** Last line of defence against stuck pointers: drop all tracking on focus loss */
  function onWindowBlur(): void {
    activePointers.clear();
    handlers.onReset();
  }

  function onWheel(event: WheelEvent): void {
    event.preventDefault();
    handlers.onWheel(event.deltaY);
  }

  element.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);
  window.addEventListener('pointercancel', onPointerCancel);
  window.addEventListener('blur', onWindowBlur);
  element.addEventListener('wheel', onWheel, { passive: false });

  return {
    hasActivePointers(): boolean {
      return activePointers.size > 0;
    },

    registerExternalPointer(pointerId: number, clientX: number, clientY: number): void {
      if (activePointers.has(pointerId)) {
        return;
      }
      trackPointer(pointerId, clientX, clientY);
    },

    destroy(): void {
      element.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerCancel);
      window.removeEventListener('blur', onWindowBlur);
      element.removeEventListener('wheel', onWheel);
      activePointers.clear();
    },
  };
}
