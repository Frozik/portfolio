import type { Vec3Array } from './topology-types';

export interface DragPreviewState {
  readonly startPosition: Vec3Array;
  readonly cursorScreenX: number;
  readonly cursorScreenY: number;
  readonly snapTargetPosition: Vec3Array | undefined;
}

export interface DragToConnectCallbacks {
  readonly performPointHitTest: (screenX: number, screenY: number) => Vec3Array | undefined;
  readonly hasActiveSelection: () => boolean;
  readonly onDragStart: () => void;
  readonly onDragUpdate: (preview: DragPreviewState | undefined) => void;
  readonly onVertexTap: (position: Vec3Array) => void;
  readonly onDragComplete: (startPosition: Vec3Array, endPosition: Vec3Array) => void;
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
  let startPosition: Vec3Array = [0, 0, 0];

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

  function isSamePosition(positionA: Vec3Array, positionB: Vec3Array): boolean {
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

    // When a line/edge is selected, tapping a vertex immediately creates
    // a parallel line — no drag preview needed
    if (callbacks.hasActiveSelection()) {
      callbacks.onVertexTap(hitPosition);
      return true;
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
