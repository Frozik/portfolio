import {
  CLICK_MOVEMENT_THRESHOLD,
  CLICK_TIME_THRESHOLD_MS,
  DOUBLE_CLICK_DISTANCE_THRESHOLD,
  DOUBLE_CLICK_TIME_THRESHOLD_MS,
} from './stereometry-constants';

/**
 * Distinguishes click and double-click from drag on a canvas element.
 * A click is registered when the pointer moves less than CLICK_MOVEMENT_THRESHOLD
 * pixels and the interaction lasts less than CLICK_TIME_THRESHOLD_MS milliseconds.
 * A double-click is two clicks within DOUBLE_CLICK_TIME_THRESHOLD_MS near the same position.
 *
 * Supports both mouse and single-finger touch. Multi-touch gestures are ignored.
 *
 * @returns Cleanup function that removes all event listeners.
 */
export function createClickDetector(
  canvas: HTMLCanvasElement,
  onClick: (screenX: number, screenY: number) => void,
  onDoubleClick: (screenX: number, screenY: number) => void
): VoidFunction {
  let pointerDownX = 0;
  let pointerDownY = 0;
  let pointerDownTime = 0;
  let isPointerDown = false;

  let lastClickX = 0;
  let lastClickY = 0;
  let lastClickTime = 0;

  function isWithinClickThreshold(clientX: number, clientY: number): boolean {
    const deltaX = Math.abs(clientX - pointerDownX);
    const deltaY = Math.abs(clientY - pointerDownY);
    const elapsed = performance.now() - pointerDownTime;

    return (
      deltaX < CLICK_MOVEMENT_THRESHOLD &&
      deltaY < CLICK_MOVEMENT_THRESHOLD &&
      elapsed < CLICK_TIME_THRESHOLD_MS
    );
  }

  function handleClick(canvasX: number, canvasY: number): void {
    const now = performance.now();
    const timeSinceLastClick = now - lastClickTime;
    const distanceFromLastClick = Math.sqrt(
      (canvasX - lastClickX) ** 2 + (canvasY - lastClickY) ** 2
    );

    if (
      timeSinceLastClick < DOUBLE_CLICK_TIME_THRESHOLD_MS &&
      distanceFromLastClick < DOUBLE_CLICK_DISTANCE_THRESHOLD
    ) {
      onDoubleClick(canvasX, canvasY);
      lastClickTime = 0;
    } else {
      onClick(canvasX, canvasY);
      lastClickX = canvasX;
      lastClickY = canvasY;
      lastClickTime = now;
    }
  }

  function onMouseDown(event: MouseEvent): void {
    pointerDownX = event.clientX;
    pointerDownY = event.clientY;
    pointerDownTime = performance.now();
    isPointerDown = true;
  }

  function onMouseUp(event: MouseEvent): void {
    if (!isPointerDown) {
      return;
    }
    isPointerDown = false;

    if (isWithinClickThreshold(event.clientX, event.clientY)) {
      const rect = canvas.getBoundingClientRect();
      handleClick(event.clientX - rect.left, event.clientY - rect.top);
    }
  }

  function onTouchStart(event: TouchEvent): void {
    if (event.touches.length !== 1) {
      isPointerDown = false;
      return;
    }
    pointerDownX = event.touches[0].clientX;
    pointerDownY = event.touches[0].clientY;
    pointerDownTime = performance.now();
    isPointerDown = true;
  }

  function onTouchEnd(event: TouchEvent): void {
    if (!isPointerDown) {
      return;
    }
    isPointerDown = false;

    if (event.changedTouches.length !== 1) {
      return;
    }

    const touch = event.changedTouches[0];
    if (isWithinClickThreshold(touch.clientX, touch.clientY)) {
      const rect = canvas.getBoundingClientRect();
      handleClick(touch.clientX - rect.left, touch.clientY - rect.top);
    }
  }

  canvas.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mouseup', onMouseUp);
  canvas.addEventListener('touchstart', onTouchStart, { passive: true });
  canvas.addEventListener('touchend', onTouchEnd);

  return () => {
    canvas.removeEventListener('mousedown', onMouseDown);
    window.removeEventListener('mouseup', onMouseUp);
    canvas.removeEventListener('touchstart', onTouchStart);
    canvas.removeEventListener('touchend', onTouchEnd);
  };
}
