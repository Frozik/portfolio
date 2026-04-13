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
 * Uses Pointer Events for unified mouse/touch/pen handling, avoiding the
 * duplicate-event problem where mobile browsers synthesize mouse events after touch.
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
  let activePointerId: number | undefined;

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

  function onPointerDown(event: PointerEvent): void {
    if (!event.isPrimary) {
      return;
    }
    activePointerId = event.pointerId;
    pointerDownX = event.clientX;
    pointerDownY = event.clientY;
    pointerDownTime = performance.now();
  }

  function onPointerUp(event: PointerEvent): void {
    if (event.pointerId !== activePointerId) {
      return;
    }
    activePointerId = undefined;

    if (isWithinClickThreshold(event.clientX, event.clientY)) {
      const rect = canvas.getBoundingClientRect();
      handleClick(event.clientX - rect.left, event.clientY - rect.top);
    }
  }

  canvas.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('pointerup', onPointerUp);

  return () => {
    canvas.removeEventListener('pointerdown', onPointerDown);
    window.removeEventListener('pointerup', onPointerUp);
  };
}
