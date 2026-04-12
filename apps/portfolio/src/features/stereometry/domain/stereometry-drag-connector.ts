export interface DragPreviewState {
  readonly startPosition: readonly [number, number, number];
  readonly cursorScreenX: number;
  readonly cursorScreenY: number;
  readonly snapTargetPosition: readonly [number, number, number] | undefined;
}

export interface DragToConnectCallbacks {
  readonly performPointHitTest: (
    screenX: number,
    screenY: number
  ) => readonly [number, number, number] | undefined;
  readonly onDragStart: () => void;
  readonly onDragUpdate: (preview: DragPreviewState | undefined) => void;
  readonly onDragComplete: (
    startPosition: readonly [number, number, number],
    endPosition: readonly [number, number, number]
  ) => void;
}

/**
 * Creates a drag-to-connect controller that intercepts pointer events
 * in the capture phase. When a vertex is hit on pointer-down,
 * stopPropagation() prevents the camera and click detector from seeing
 * the event. Dragging to another vertex creates a user segment.
 *
 * @returns Cleanup function that removes all event listeners.
 */
export function createDragToConnectController(
  canvas: HTMLCanvasElement,
  callbacks: DragToConnectCallbacks
): VoidFunction {
  let isDragging = false;
  let startPosition: readonly [number, number, number] = [0, 0, 0];

  function getCanvasRelativeCoords(
    clientX: number,
    clientY: number
  ): { screenX: number; screenY: number } {
    const rect = canvas.getBoundingClientRect();
    return {
      screenX: clientX - rect.left,
      screenY: clientY - rect.top,
    };
  }

  function isSamePosition(
    positionA: readonly [number, number, number],
    positionB: readonly [number, number, number]
  ): boolean {
    return (
      positionA[0] === positionB[0] &&
      positionA[1] === positionB[1] &&
      positionA[2] === positionB[2]
    );
  }

  function beginDrag(clientX: number, clientY: number): boolean {
    const { screenX, screenY } = getCanvasRelativeCoords(clientX, clientY);
    const hitPosition = callbacks.performPointHitTest(screenX, screenY);

    if (hitPosition === undefined) {
      return false;
    }

    isDragging = true;
    startPosition = hitPosition;

    callbacks.onDragStart();
    callbacks.onDragUpdate({
      startPosition,
      cursorScreenX: screenX,
      cursorScreenY: screenY,
      snapTargetPosition: undefined,
    });

    return true;
  }

  function updateDrag(clientX: number, clientY: number): void {
    const { screenX, screenY } = getCanvasRelativeCoords(clientX, clientY);
    const snapPosition = callbacks.performPointHitTest(screenX, screenY);

    callbacks.onDragUpdate({
      startPosition,
      cursorScreenX: screenX,
      cursorScreenY: screenY,
      snapTargetPosition:
        snapPosition !== undefined && !isSamePosition(snapPosition, startPosition)
          ? snapPosition
          : undefined,
    });
  }

  function endDrag(clientX: number, clientY: number): void {
    const { screenX, screenY } = getCanvasRelativeCoords(clientX, clientY);
    const snapPosition = callbacks.performPointHitTest(screenX, screenY);

    if (snapPosition !== undefined && !isSamePosition(snapPosition, startPosition)) {
      callbacks.onDragComplete(startPosition, snapPosition);
    }

    isDragging = false;
    callbacks.onDragUpdate(undefined);
  }

  function onMouseDown(event: MouseEvent): void {
    if (beginDrag(event.clientX, event.clientY)) {
      event.stopPropagation();
    }
  }

  function onMouseMove(event: MouseEvent): void {
    if (!isDragging) {
      return;
    }
    updateDrag(event.clientX, event.clientY);
  }

  function onMouseUp(event: MouseEvent): void {
    if (!isDragging) {
      return;
    }
    endDrag(event.clientX, event.clientY);
  }

  function cancelDrag(): void {
    isDragging = false;
    callbacks.onDragUpdate(undefined);
  }

  function onTouchStart(event: TouchEvent): void {
    // If a second finger touches during an active drag, cancel the drag
    // and stop propagation so the camera doesn't enter pinch mode mid-drag
    if (isDragging) {
      cancelDrag();
      event.stopPropagation();
      return;
    }

    if (event.touches.length !== 1) {
      return;
    }
    const touch = event.touches[0];
    if (beginDrag(touch.clientX, touch.clientY)) {
      event.stopPropagation();
    }
  }

  function onTouchMove(event: TouchEvent): void {
    if (!isDragging || event.touches.length !== 1) {
      return;
    }
    event.preventDefault();
    const touch = event.touches[0];
    updateDrag(touch.clientX, touch.clientY);
  }

  function onTouchEnd(event: TouchEvent): void {
    if (!isDragging) {
      return;
    }
    if (event.changedTouches.length !== 1) {
      cancelDrag();
      return;
    }
    const touch = event.changedTouches[0];
    endDrag(touch.clientX, touch.clientY);
  }

  // Capture phase gives priority over camera and click detector (bubble phase)
  canvas.addEventListener('mousedown', onMouseDown, { capture: true });
  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mouseup', onMouseUp);
  canvas.addEventListener('touchstart', onTouchStart, { capture: true });
  canvas.addEventListener('touchmove', onTouchMove, { passive: false });
  canvas.addEventListener('touchend', onTouchEnd);

  return () => {
    canvas.removeEventListener('mousedown', onMouseDown, { capture: true });
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseup', onMouseUp);
    canvas.removeEventListener('touchstart', onTouchStart, {
      capture: true,
    });
    canvas.removeEventListener('touchmove', onTouchMove);
    canvas.removeEventListener('touchend', onTouchEnd);
  };
}
