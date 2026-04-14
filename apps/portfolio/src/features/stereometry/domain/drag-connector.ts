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
  readonly onVertexTap: (position: readonly [number, number, number]) => void;
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
 * Uses Pointer Events for unified mouse/touch/pen handling.
 *
 * @returns Cleanup function that removes all event listeners.
 */
export function createDragToConnectController(
  canvas: HTMLCanvasElement,
  callbacks: DragToConnectCallbacks
): VoidFunction {
  let isDragging = false;
  let activePointerId: number | undefined;
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

  function beginDrag(event: PointerEvent): boolean {
    const { screenX, screenY } = getCanvasRelativeCoords(event.clientX, event.clientY);
    const hitPosition = callbacks.performPointHitTest(screenX, screenY);

    if (hitPosition === undefined) {
      return false;
    }

    isDragging = true;
    activePointerId = event.pointerId;
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
    } else {
      callbacks.onVertexTap(startPosition);
    }

    isDragging = false;
    activePointerId = undefined;
    callbacks.onDragUpdate(undefined);
  }

  function cancelDrag(): void {
    isDragging = false;
    activePointerId = undefined;
    callbacks.onDragUpdate(undefined);
  }

  function onPointerDown(event: PointerEvent): void {
    // If a second pointer arrives during an active drag, cancel the drag
    // and stop propagation so the camera doesn't enter pinch mode mid-drag
    if (isDragging) {
      cancelDrag();
      event.stopPropagation();
      return;
    }

    if (!event.isPrimary) {
      return;
    }

    if (beginDrag(event)) {
      event.stopPropagation();
    }
  }

  function onPointerMove(event: PointerEvent): void {
    if (!isDragging || event.pointerId !== activePointerId) {
      return;
    }
    updateDrag(event.clientX, event.clientY);
  }

  function onPointerUp(event: PointerEvent): void {
    if (!isDragging || event.pointerId !== activePointerId) {
      return;
    }
    endDrag(event.clientX, event.clientY);
  }

  // Capture phase gives priority over camera and click detector (bubble phase)
  canvas.addEventListener('pointerdown', onPointerDown, { capture: true });
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);

  return () => {
    canvas.removeEventListener('pointerdown', onPointerDown, { capture: true });
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
  };
}
