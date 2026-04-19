import {
  CLICK_MOVEMENT_THRESHOLD,
  DOUBLE_CLICK_DISTANCE_THRESHOLD,
  DOUBLE_CLICK_TIME_THRESHOLD_MS,
  LINE_HOLD_DELAY_MS,
} from './constants';
import type { Vec3Array } from './topology-types';

/** Outcome of the hit test performed at pointer-down. Determines drag semantics. */
export type InitialDragHit =
  | { readonly kind: 'vertex'; readonly position: Vec3Array }
  | {
      readonly kind: 'line';
      readonly lineId: number;
      /** `pointB − pointA` of the source line; used to build a parallel line at the snap vertex. */
      readonly direction: Vec3Array;
      /** Any point on the source line; used as the unprojection plane when no snap vertex is present. */
      readonly planeAnchor: Vec3Array;
    };

export type DragPreviewState =
  | {
      readonly kind: 'vertex';
      readonly startPosition: Vec3Array;
      readonly cursorScreenX: number;
      readonly cursorScreenY: number;
      readonly snapTargetPosition: Vec3Array | undefined;
    }
  | {
      readonly kind: 'line';
      readonly sourceDirection: Vec3Array;
      readonly planeAnchor: Vec3Array;
      readonly cursorScreenX: number;
      readonly cursorScreenY: number;
      readonly snapTargetPosition: Vec3Array | undefined;
    };

export interface DragToConnectCallbacks {
  /** Hit-test at pointer-down. Returns whichever candidate wins the unified scoring. */
  readonly performInitialHitTest: (screenX: number, screenY: number) => InitialDragHit | undefined;
  /** Hit-test during drag for snap targets. Ignores lines so they can't override a valid vertex snap. */
  readonly performSnapHitTest: (screenX: number, screenY: number) => Vec3Array | undefined;
  readonly hasActiveSelection: () => boolean;
  /** True when this specific line is the currently selected one. Gates the
   *  drag-to-parallel gesture so unselected lines only accept tap/double-tap. */
  readonly isLineSelected: (lineId: number) => boolean;
  readonly onDragStart: () => void;
  readonly onDragUpdate: (preview: DragPreviewState | undefined) => void;
  readonly onVertexTap: (position: Vec3Array) => void;
  readonly onLineTap: (lineId: number) => void;
  readonly onLineDoubleTap: (lineId: number) => void;
  readonly onDragComplete: (startPosition: Vec3Array, endPosition: Vec3Array) => void;
}

/**
 * Drag-to-connect controller. Intercepts pointer events in the capture phase
 * so it owns the entire line/vertex gesture surface.
 *
 * Gestures:
 * - Vertex tap (quick release) → `onVertexTap` (creates a parallel line if a
 *   line is selected; otherwise no-op).
 * - Vertex press + drag to another vertex → `onDragComplete(start, end)`.
 * - Line quick tap → `onLineTap` (select).
 * - Line double-tap → `onLineDoubleTap` (extend/collapse).
 * - Line press-and-hold past `LINE_HOLD_DELAY_MS` (or sizable movement) →
 *   drag-to-parallel: preview appears; release on a snap vertex calls
 *   `onDragComplete(snap, snap+direction)`; release off-vertex falls back
 *   to `onLineTap` (select).
 *
 * Uses Pointer Events for unified mouse/touch/pen handling.
 *
 * @returns Cleanup function that removes all event listeners.
 */
export function createDragToConnectController(
  canvas: HTMLCanvasElement,
  callbacks: DragToConnectCallbacks
): VoidFunction {
  // Drag is "active" once preview should be rendered and pointer-move tracks snaps.
  let activeHit: InitialDragHit | undefined;
  // Line hits spend time in "pending" state (hold delay) before activating.
  let pendingHit: InitialDragHit | undefined;
  // A pending line may drag only when it's the currently selected one.
  // Unselected lines stay in pending forever → release = tap/double-tap.
  let pendingAllowsDrag = false;
  let activePointerId: number | undefined;
  let pointerDownClientX = 0;
  let pointerDownClientY = 0;
  let holdTimerId: number | undefined;

  // Double-tap tracking for lines. Resets after a double-tap is emitted so a
  // third quick tap begins a new single/double cycle.
  let lastLineTapLineId: number | undefined;
  let lastLineTapTime = 0;
  let lastLineTapClientX = 0;
  let lastLineTapClientY = 0;

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

  function buildPreview(
    hit: InitialDragHit,
    cursorScreenX: number,
    cursorScreenY: number,
    snapPosition: Vec3Array | undefined
  ): DragPreviewState {
    if (hit.kind === 'vertex') {
      return {
        kind: 'vertex',
        startPosition: hit.position,
        cursorScreenX,
        cursorScreenY,
        snapTargetPosition:
          snapPosition !== undefined && !isSamePosition(snapPosition, hit.position)
            ? snapPosition
            : undefined,
      };
    }
    return {
      kind: 'line',
      sourceDirection: hit.direction,
      planeAnchor: hit.planeAnchor,
      cursorScreenX,
      cursorScreenY,
      snapTargetPosition: snapPosition,
    };
  }

  function clearHoldTimer(): void {
    if (holdTimerId !== undefined) {
      window.clearTimeout(holdTimerId);
      holdTimerId = undefined;
    }
  }

  function activateDrag(
    screenX: number,
    screenY: number,
    snapPosition: Vec3Array | undefined
  ): void {
    const hit = pendingHit;
    if (hit === undefined) {
      return;
    }
    clearHoldTimer();
    pendingHit = undefined;
    pendingAllowsDrag = false;
    activeHit = hit;
    callbacks.onDragStart();
    callbacks.onDragUpdate(buildPreview(hit, screenX, screenY, snapPosition));
  }

  function onHoldTimerFire(): void {
    const { screenX, screenY } = getCanvasRelativeCoords(pointerDownClientX, pointerDownClientY);
    activateDrag(screenX, screenY, undefined);
  }

  function handleLineTap(lineId: number, clientX: number, clientY: number): void {
    const now = performance.now();
    const timeSinceLastTap = now - lastLineTapTime;
    const distanceFromLastTap = Math.sqrt(
      (clientX - lastLineTapClientX) ** 2 + (clientY - lastLineTapClientY) ** 2
    );
    const isDoubleTap =
      lastLineTapLineId === lineId &&
      timeSinceLastTap < DOUBLE_CLICK_TIME_THRESHOLD_MS &&
      distanceFromLastTap < DOUBLE_CLICK_DISTANCE_THRESHOLD;

    if (isDoubleTap) {
      lastLineTapLineId = undefined;
      callbacks.onLineDoubleTap(lineId);
      return;
    }

    lastLineTapLineId = lineId;
    lastLineTapTime = now;
    lastLineTapClientX = clientX;
    lastLineTapClientY = clientY;
    callbacks.onLineTap(lineId);
  }

  function beginInteraction(event: PointerEvent): boolean {
    const { screenX, screenY } = getCanvasRelativeCoords(event.clientX, event.clientY);
    const hit = callbacks.performInitialHitTest(screenX, screenY);

    if (hit === undefined) {
      return false;
    }

    // Vertex tap with a line already selected immediately creates a parallel
    // line through the tapped vertex — no drag preview needed.
    if (hit.kind === 'vertex' && callbacks.hasActiveSelection()) {
      callbacks.onVertexTap(hit.position);
      return true;
    }

    activePointerId = event.pointerId;
    pointerDownClientX = event.clientX;
    pointerDownClientY = event.clientY;

    if (hit.kind === 'vertex') {
      // Vertex drag starts immediately — no hold required.
      activeHit = hit;
      callbacks.onDragStart();
      callbacks.onDragUpdate(buildPreview(hit, screenX, screenY, undefined));
    } else {
      // Line hit waits out the hold delay before activating drag; a quick
      // release in this window is a tap (select / double-tap). The drag
      // itself is only allowed when this line is the current selection —
      // unselected lines never activate drag regardless of hold or movement.
      pendingHit = hit;
      pendingAllowsDrag = callbacks.isLineSelected(hit.lineId);
      if (pendingAllowsDrag) {
        holdTimerId = window.setTimeout(onHoldTimerFire, LINE_HOLD_DELAY_MS);
      }
    }

    return true;
  }

  function updateInteraction(clientX: number, clientY: number): void {
    const { screenX, screenY } = getCanvasRelativeCoords(clientX, clientY);

    if (pendingHit !== undefined) {
      if (!pendingAllowsDrag) {
        return;
      }
      // Still in hold phase — promote to active drag if the user has moved
      // enough to clearly express drag intent before the timer fires.
      const movement = Math.max(
        Math.abs(clientX - pointerDownClientX),
        Math.abs(clientY - pointerDownClientY)
      );
      if (movement >= CLICK_MOVEMENT_THRESHOLD) {
        const snapPosition = callbacks.performSnapHitTest(screenX, screenY);
        activateDrag(screenX, screenY, snapPosition);
      }
      return;
    }

    if (activeHit === undefined) {
      return;
    }

    const snapPosition = callbacks.performSnapHitTest(screenX, screenY);
    callbacks.onDragUpdate(buildPreview(activeHit, screenX, screenY, snapPosition));
  }

  function endInteraction(clientX: number, clientY: number): void {
    // Release during hold phase → line tap (select / double-tap).
    if (pendingHit !== undefined) {
      const pending = pendingHit;
      clearHoldTimer();
      pendingHit = undefined;
      pendingAllowsDrag = false;
      activePointerId = undefined;
      if (pending.kind === 'line') {
        handleLineTap(pending.lineId, clientX, clientY);
      }
      return;
    }

    const hit = activeHit;
    if (hit === undefined) {
      return;
    }

    const { screenX, screenY } = getCanvasRelativeCoords(clientX, clientY);
    const snapPosition = callbacks.performSnapHitTest(screenX, screenY);

    activeHit = undefined;
    activePointerId = undefined;
    callbacks.onDragUpdate(undefined);

    if (hit.kind === 'vertex') {
      if (snapPosition !== undefined && !isSamePosition(snapPosition, hit.position)) {
        callbacks.onDragComplete(hit.position, snapPosition);
      } else {
        callbacks.onVertexTap(hit.position);
      }
      return;
    }

    // Active line-drag release: snap vertex → parallel line; otherwise no-op
    // (the line is already selected — it entered drag via hold — so we just
    // abandon the drag without firing a tap that could trip double-tap logic).
    if (snapPosition !== undefined) {
      const endPosition: Vec3Array = [
        snapPosition[0] + hit.direction[0],
        snapPosition[1] + hit.direction[1],
        snapPosition[2] + hit.direction[2],
      ];
      callbacks.onDragComplete(snapPosition, endPosition);
    }
  }

  function cancelInteraction(): void {
    clearHoldTimer();
    pendingHit = undefined;
    pendingAllowsDrag = false;
    activeHit = undefined;
    activePointerId = undefined;
    callbacks.onDragUpdate(undefined);
  }

  function onPointerDown(event: PointerEvent): void {
    // A second pointer arriving during an active interaction cancels it so
    // the camera doesn't enter pinch mode mid-drag.
    if (activeHit !== undefined || pendingHit !== undefined) {
      cancelInteraction();
      event.stopPropagation();
      return;
    }

    if (!event.isPrimary) {
      return;
    }

    if (beginInteraction(event)) {
      event.stopPropagation();
    }
  }

  function onPointerMove(event: PointerEvent): void {
    if (event.pointerId !== activePointerId) {
      return;
    }
    if (activeHit === undefined && pendingHit === undefined) {
      return;
    }
    updateInteraction(event.clientX, event.clientY);
  }

  function onPointerUp(event: PointerEvent): void {
    if (event.pointerId !== activePointerId) {
      return;
    }
    if (activeHit === undefined && pendingHit === undefined) {
      return;
    }
    endInteraction(event.clientX, event.clientY);
  }

  // Capture phase gives priority over camera and click detector (bubble phase)
  canvas.addEventListener('pointerdown', onPointerDown, { capture: true });
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);

  return () => {
    clearHoldTimer();
    canvas.removeEventListener('pointerdown', onPointerDown, { capture: true });
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
  };
}
