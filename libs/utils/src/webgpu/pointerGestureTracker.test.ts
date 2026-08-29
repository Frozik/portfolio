import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PINCH_MIN_DISTANCE_PX } from './pinchScale';
import type { PointerGestureHandlers, PointerGestureTracker } from './pointerGestureTracker';
import { createPointerGestureTracker } from './pointerGestureTracker';

const FIRST_POINTER_ID = 1;
const SECOND_POINTER_ID = 2;

function createPointerEvent(
  type: string,
  init: { pointerId: number; clientX?: number; clientY?: number; shiftKey?: boolean }
): PointerEvent {
  return new PointerEvent(type, { bubbles: true, ...init });
}

function pressPointer(
  element: HTMLElement,
  init: { pointerId: number; clientX?: number; clientY?: number; shiftKey?: boolean }
): void {
  element.dispatchEvent(createPointerEvent('pointerdown', init));
}

function movePointer(init: { pointerId: number; clientX: number; clientY: number }): PointerEvent {
  const event = createPointerEvent('pointermove', init);
  window.dispatchEvent(event);
  return event;
}

function releasePointer(pointerId: number): void {
  window.dispatchEvent(createPointerEvent('pointerup', { pointerId }));
}

function cancelPointer(pointerId: number): void {
  window.dispatchEvent(createPointerEvent('pointercancel', { pointerId }));
}

function scrollWheel(element: HTMLElement, deltaY: number): WheelEvent {
  const event = new WheelEvent('wheel', { deltaY, cancelable: true });
  element.dispatchEvent(event);
  return event;
}

function createHandlerMocks() {
  return {
    onDrag: vi.fn<PointerGestureHandlers['onDrag']>(),
    onPinch: vi.fn<PointerGestureHandlers['onPinch']>(),
    onWheel: vi.fn<PointerGestureHandlers['onWheel']>(),
    onReset: vi.fn<VoidFunction>(),
    onGestureStart: vi.fn<NonNullable<PointerGestureHandlers['onGestureStart']>>(),
    onGestureEnd: vi.fn<VoidFunction>(),
  };
}

describe('createPointerGestureTracker', () => {
  let element: HTMLCanvasElement;
  let handlers: ReturnType<typeof createHandlerMocks>;
  let tracker: PointerGestureTracker;

  beforeEach(() => {
    element = document.createElement('canvas');
    element.setPointerCapture = vi.fn();

    handlers = createHandlerMocks();

    tracker = createPointerGestureTracker(element, handlers);

    return () => tracker.destroy();
  });

  it('captures the pointer so a release outside the window is not lost', () => {
    pressPointer(element, { pointerId: FIRST_POINTER_ID, clientX: 10, clientY: 10 });

    expect(element.setPointerCapture).toHaveBeenCalledWith(FIRST_POINTER_ID);
  });

  it('keeps tracking when pointer capture is unavailable', () => {
    element.setPointerCapture = vi.fn(() => {
      throw new Error('no active pointer');
    });

    pressPointer(element, { pointerId: FIRST_POINTER_ID, clientX: 10, clientY: 10 });
    movePointer({ pointerId: FIRST_POINTER_ID, clientX: 15, clientY: 12 });

    expect(tracker.hasActivePointers()).toBe(true);
    expect(handlers.onDrag).toHaveBeenCalledWith(5, 2, expect.any(Number));
  });

  it('reports the gesture start with its modifier keys', () => {
    pressPointer(element, {
      pointerId: FIRST_POINTER_ID,
      clientX: 10,
      clientY: 10,
      shiftKey: true,
    });

    expect(handlers.onGestureStart).toHaveBeenCalledTimes(1);
    expect(handlers.onGestureStart.mock.calls[0][0].shiftKey).toBe(true);
  });

  it('reports the gesture start only for the first pointer of a gesture', () => {
    pressPointer(element, { pointerId: FIRST_POINTER_ID, clientX: 10, clientY: 10 });
    pressPointer(element, { pointerId: SECOND_POINTER_ID, clientX: 50, clientY: 10 });

    expect(handlers.onGestureStart).toHaveBeenCalledTimes(1);
  });

  it('reports single-pointer drag deltas with the event timestamp', () => {
    pressPointer(element, { pointerId: FIRST_POINTER_ID, clientX: 10, clientY: 10 });
    const moveEvent = movePointer({ pointerId: FIRST_POINTER_ID, clientX: 30, clientY: 4 });

    expect(handlers.onDrag).toHaveBeenCalledWith(20, -6, moveEvent.timeStamp);
  });

  it('ignores moves of pointers it never saw go down', () => {
    movePointer({ pointerId: FIRST_POINTER_ID, clientX: 30, clientY: 4 });

    expect(handlers.onDrag).not.toHaveBeenCalled();
    expect(tracker.hasActivePointers()).toBe(false);
  });

  it('reports the pinch scale relative to the previous finger separation', () => {
    pressPointer(element, { pointerId: FIRST_POINTER_ID, clientX: 0, clientY: 0 });
    pressPointer(element, { pointerId: SECOND_POINTER_ID, clientX: 200, clientY: 0 });

    movePointer({ pointerId: SECOND_POINTER_ID, clientX: 100, clientY: 0 });

    expect(handlers.onPinch).toHaveBeenCalledWith(2);
    expect(handlers.onDrag).not.toHaveBeenCalled();
  });

  it('rebases the pinch on every reported frame', () => {
    pressPointer(element, { pointerId: FIRST_POINTER_ID, clientX: 0, clientY: 0 });
    pressPointer(element, { pointerId: SECOND_POINTER_ID, clientX: 200, clientY: 0 });

    movePointer({ pointerId: SECOND_POINTER_ID, clientX: 100, clientY: 0 });
    movePointer({ pointerId: SECOND_POINTER_ID, clientX: 50, clientY: 0 });

    expect(handlers.onPinch).toHaveBeenNthCalledWith(1, 2);
    expect(handlers.onPinch).toHaveBeenNthCalledWith(2, 2);
  });

  it('skips degenerate pinches where both fingers collapse onto one point', () => {
    pressPointer(element, { pointerId: FIRST_POINTER_ID, clientX: 0, clientY: 0 });
    pressPointer(element, { pointerId: SECOND_POINTER_ID, clientX: 200, clientY: 0 });

    movePointer({ pointerId: SECOND_POINTER_ID, clientX: 0, clientY: 0 });

    expect(handlers.onPinch).not.toHaveBeenCalled();
  });

  it('resumes pinching from the last valid separation after a degenerate frame', () => {
    pressPointer(element, { pointerId: FIRST_POINTER_ID, clientX: 0, clientY: 0 });
    pressPointer(element, { pointerId: SECOND_POINTER_ID, clientX: 200, clientY: 0 });

    movePointer({ pointerId: SECOND_POINTER_ID, clientX: 0, clientY: 0 });
    movePointer({ pointerId: SECOND_POINTER_ID, clientX: 100, clientY: 0 });

    expect(handlers.onPinch).toHaveBeenCalledTimes(1);
    expect(handlers.onPinch).toHaveBeenCalledWith(2);
  });

  it('treats the minimum separation as a valid pinch', () => {
    pressPointer(element, { pointerId: FIRST_POINTER_ID, clientX: 0, clientY: 0 });
    pressPointer(element, { pointerId: SECOND_POINTER_ID, clientX: 200, clientY: 0 });

    movePointer({ pointerId: SECOND_POINTER_ID, clientX: PINCH_MIN_DISTANCE_PX, clientY: 0 });

    expect(handlers.onPinch).toHaveBeenCalledWith(200 / PINCH_MIN_DISTANCE_PX);
  });

  it('reports the gesture end once the last pointer is released', () => {
    pressPointer(element, { pointerId: FIRST_POINTER_ID, clientX: 0, clientY: 0 });
    pressPointer(element, { pointerId: SECOND_POINTER_ID, clientX: 200, clientY: 0 });

    releasePointer(FIRST_POINTER_ID);
    expect(handlers.onGestureEnd).not.toHaveBeenCalled();
    expect(tracker.hasActivePointers()).toBe(true);

    releasePointer(SECOND_POINTER_ID);
    expect(handlers.onGestureEnd).toHaveBeenCalledTimes(1);
    expect(tracker.hasActivePointers()).toBe(false);
  });

  it('drops cancelled pointers without ending the gesture', () => {
    pressPointer(element, { pointerId: FIRST_POINTER_ID, clientX: 0, clientY: 0 });
    cancelPointer(FIRST_POINTER_ID);

    expect(tracker.hasActivePointers()).toBe(false);
    expect(handlers.onGestureEnd).not.toHaveBeenCalled();
  });

  it('drops every pointer and asks for a reset when the window loses focus', () => {
    pressPointer(element, { pointerId: FIRST_POINTER_ID, clientX: 0, clientY: 0 });
    pressPointer(element, { pointerId: SECOND_POINTER_ID, clientX: 200, clientY: 0 });

    window.dispatchEvent(new Event('blur'));

    expect(handlers.onReset).toHaveBeenCalledTimes(1);
    expect(tracker.hasActivePointers()).toBe(false);

    movePointer({ pointerId: FIRST_POINTER_ID, clientX: 40, clientY: 40 });
    expect(handlers.onDrag).not.toHaveBeenCalled();
  });

  it('reports wheel deltas and prevents the page from scrolling', () => {
    const wheelDelta = 120;
    const event = scrollWheel(element, wheelDelta);

    expect(handlers.onWheel).toHaveBeenCalledWith(wheelDelta);
    expect(event.defaultPrevented).toBe(true);
  });

  it('adopts an externally captured pointer as the pinch baseline', () => {
    tracker.registerExternalPointer(FIRST_POINTER_ID, 0, 0);
    pressPointer(element, { pointerId: SECOND_POINTER_ID, clientX: 200, clientY: 0 });

    movePointer({ pointerId: SECOND_POINTER_ID, clientX: 100, clientY: 0 });

    expect(handlers.onPinch).toHaveBeenCalledWith(2);
  });

  it('ignores an external pointer that is already tracked', () => {
    pressPointer(element, { pointerId: FIRST_POINTER_ID, clientX: 10, clientY: 10 });
    tracker.registerExternalPointer(FIRST_POINTER_ID, 999, 999);

    movePointer({ pointerId: FIRST_POINTER_ID, clientX: 15, clientY: 10 });

    expect(handlers.onDrag).toHaveBeenCalledWith(5, 0, expect.any(Number));
  });

  it('detaches every listener and forgets pointers on destroy', () => {
    pressPointer(element, { pointerId: FIRST_POINTER_ID, clientX: 10, clientY: 10 });

    tracker.destroy();

    expect(tracker.hasActivePointers()).toBe(false);

    pressPointer(element, { pointerId: SECOND_POINTER_ID, clientX: 10, clientY: 10 });
    movePointer({ pointerId: FIRST_POINTER_ID, clientX: 40, clientY: 40 });
    releasePointer(FIRST_POINTER_ID);
    window.dispatchEvent(new Event('blur'));
    const wheelEvent = scrollWheel(element, 120);

    expect(handlers.onGestureStart).toHaveBeenCalledTimes(1);
    expect(handlers.onDrag).not.toHaveBeenCalled();
    expect(handlers.onGestureEnd).not.toHaveBeenCalled();
    expect(handlers.onReset).not.toHaveBeenCalled();
    expect(handlers.onWheel).not.toHaveBeenCalled();
    expect(wheelEvent.defaultPrevented).toBe(false);
  });
});
