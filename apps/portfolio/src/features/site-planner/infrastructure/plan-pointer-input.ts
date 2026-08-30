import { assertNever } from '@frozik/utils/assert/assertNever';
import type { Vector2 } from '@frozik/utils/math/vector2';
import { computePinchScale, pointerDistance } from '@frozik/utils/webgpu/pinchScale';
import { isNil } from 'lodash-es';

import { isEditableEventTarget } from '../../../shared/lib/isEditableEventTarget';
import type { PlanInputTarget, PlanModifiers } from '../domain/view/plan-input';
import type { PlanViewport } from '../domain/view/plan-viewport';
import { panByPixels, screenToPlan, zoomAroundPoint } from '../domain/view/plan-viewport';

const PRIMARY_BUTTON = 0;
/** Two fingers are the camera; one is whatever tool is in hand. */
const PINCH_POINTER_COUNT = 2;
const SPACE_KEY = ' ';
const UNDO_KEY = 'z';
/** The Windows redo chord; macOS spells the same thing Cmd+Shift+Z. */
const REDO_KEY = 'y';

type HistoryAction = 'undo' | 'redo';
/** Tailwind utility toggled on the canvas while the pan modifier is held. */
const PAN_CURSOR_CLASS = 'cursor-grab';

/**
 * Controls that answer Space themselves. Space is the pan modifier of the
 * canvas, but a focused toolbar button — a tool, the export menu — must still be
 * activated by it rather than have the keystroke taken for the camera.
 */
const ACTIVATABLE_CONTROL_SELECTOR = 'button, [role="button"], a[href]';

export interface PlanPointerInputParams {
  readonly canvas: HTMLCanvasElement;
  readonly target: PlanInputTarget;
  readonly getViewport: () => PlanViewport;
  readonly setViewport: (viewport: PlanViewport) => void;
  /** The hand tool: while it answers true, a primary drag pans instead of editing. */
  readonly isPanToolActive: () => boolean;
}

/**
 * Binds the canvas and the keyboard to the interaction target. Pointer moves are
 * coalesced into one animation frame — a high-rate pointer would otherwise write
 * the cursor readout and the gesture draft to the store several times per
 * painted frame, all but the last of them discarded.
 *
 * The wheel and the middle-button pan belong to the navigation layer; this one
 * adds the primary button, the Space-drag pan, the two-finger camera and the
 * editor hotkeys. The touch camera lives here rather than with the rest of the
 * navigation because a second finger has to call off the gesture the first one
 * started, and the gesture is this module's to end.
 */
export function attachPlanPointerInput({
  canvas,
  target,
  getViewport,
  setViewport,
  isPanToolActive,
}: PlanPointerInputParams): VoidFunction {
  let gesturePointerId: number | undefined;
  let panPointerId: number | undefined;
  let lastPanClientPoint: Vector2 | undefined;
  let isSpaceHeld = false;
  let pendingMoveEvent: PointerEvent | undefined;
  let moveFrameId: number | undefined;

  /** Where every pointer on the canvas is, in client pixels; two of them pinch. */
  const activePointers = new Map<number, Vector2>();
  /** Separation of the pinching pair as of the last frame; nothing while none pinch. */
  let pinchDistancePx: number | undefined;

  const toCanvasPoint = (clientPoint: Vector2): Vector2 => {
    const bounds = canvas.getBoundingClientRect();

    return { x: clientPoint.x - bounds.left, y: clientPoint.y - bounds.top };
  };

  const toPlanPoint = (event: MouseEvent): Vector2 =>
    screenToPlan(getViewport(), toCanvasPoint({ x: event.clientX, y: event.clientY }));

  const cancelPendingMove = (): void => {
    if (!isNil(moveFrameId)) {
      cancelAnimationFrame(moveFrameId);
      moveFrameId = undefined;
    }

    pendingMoveEvent = undefined;
  };

  const applyMove = (event: PointerEvent): void => {
    if (event.pointerId === panPointerId && !isNil(lastPanClientPoint)) {
      setViewport(
        panByPixels(getViewport(), {
          x: event.clientX - lastPanClientPoint.x,
          y: event.clientY - lastPanClientPoint.y,
        })
      );
      lastPanClientPoint = { x: event.clientX, y: event.clientY };

      return;
    }

    if (!isNil(gesturePointerId) && event.pointerId !== gesturePointerId) {
      return;
    }

    target.onPointerMove(toPlanPoint(event), toModifiers(event));
  };

  const flushMove = (): void => {
    moveFrameId = undefined;

    const event = pendingMoveEvent;

    pendingMoveEvent = undefined;

    if (!isNil(event)) {
      applyMove(event);
    }
  };

  const releasePointer = (pointerId: number): void => {
    if (canvas.hasPointerCapture(pointerId)) {
      canvas.releasePointerCapture(pointerId);
    }
  };

  const endPan = (): void => {
    if (!isNil(panPointerId)) {
      releasePointer(panPointerId);
      panPointerId = undefined;
    }

    lastPanClientPoint = undefined;
  };

  const endGesture = (): void => {
    if (!isNil(gesturePointerId)) {
      releasePointer(gesturePointerId);
      gesturePointerId = undefined;
    }
  };

  const isPinching = (): boolean => !isNil(pinchDistancePx);

  /** The pinching pair: the two pointers that were on the canvas first. */
  const readPinchPair = (): readonly Vector2[] =>
    [...activePointers.values()].slice(0, PINCH_POINTER_COUNT);

  const measurePinchCenter = (): Vector2 => {
    const [first, second] = readPinchPair();

    return { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 };
  };

  const measurePinchDistance = (): number => {
    const [first, second] = readPinchPair();

    return pointerDistance(first.x, first.y, second.x, second.y);
  };

  /** A second finger is the camera taking over from whatever the first was doing. */
  const beginPinch = (): void => {
    cancelPendingMove();
    endPan();

    if (!isNil(gesturePointerId)) {
      endGesture();
      target.onPointerCancel();
    }

    pinchDistancePx = measurePinchDistance();
  };

  const applyPinch = (previousCenter: Vector2): void => {
    const distancePx = measurePinchDistance();
    // `computePinchScale` is written for a camera distance, which fingers moving
    // apart make shorter; a zoom moves the other way, so its factor is inverted.
    const cameraScale = computePinchScale(pinchDistancePx ?? distancePx, distancePx);
    const center = measurePinchCenter();

    let viewport = getViewport();

    if (!isNil(cameraScale) && cameraScale > 0) {
      pinchDistancePx = distancePx;
      viewport = zoomAroundPoint(viewport, toCanvasPoint(previousCenter), 1 / cameraScale);
    }

    setViewport(
      panByPixels(viewport, { x: center.x - previousCenter.x, y: center.y - previousCenter.y })
    );
  };

  const handlePointerDown = (event: PointerEvent): void => {
    activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (activePointers.size === PINCH_POINTER_COUNT) {
      beginPinch();

      return;
    }

    if (
      isPinching() ||
      event.button !== PRIMARY_BUTTON ||
      !isNil(gesturePointerId) ||
      !isNil(panPointerId)
    ) {
      return;
    }

    canvas.setPointerCapture(event.pointerId);

    if (isSpaceHeld || isPanToolActive()) {
      panPointerId = event.pointerId;
      lastPanClientPoint = { x: event.clientX, y: event.clientY };

      return;
    }

    gesturePointerId = event.pointerId;
    target.onPointerDown(toPlanPoint(event), toModifiers(event));
  };

  const handlePointerMove = (event: PointerEvent): void => {
    const isTracked = activePointers.has(event.pointerId);
    const previousCenter = isTracked && isPinching() ? measurePinchCenter() : undefined;

    if (isTracked) {
      activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    }

    if (!isNil(previousCenter)) {
      applyPinch(previousCenter);

      return;
    }

    // While two fingers hold the camera, nothing else may move the plan.
    if (isPinching()) {
      return;
    }

    pendingMoveEvent = event;

    if (isNil(moveFrameId)) {
      moveFrameId = requestAnimationFrame(flushMove);
    }
  };

  const forgetAllPointers = (): void => {
    activePointers.clear();
    pinchDistancePx = undefined;
  };

  /** A pinch survives only as long as both of its fingers are down. */
  const forgetPointer = (event: PointerEvent): void => {
    activePointers.delete(event.pointerId);

    if (activePointers.size < PINCH_POINTER_COUNT) {
      pinchDistancePx = undefined;
    }
  };

  const handlePointerUp = (event: PointerEvent): void => {
    forgetPointer(event);

    if (event.pointerId === panPointerId) {
      cancelPendingMove();
      endPan();

      return;
    }

    if (event.pointerId !== gesturePointerId) {
      return;
    }

    // The release carries the final position, so a coalesced move still in
    // flight would only replay a stale one after the gesture has committed.
    cancelPendingMove();
    endGesture();
    target.onPointerUp(toPlanPoint(event), toModifiers(event));
  };

  const handlePointerCancel = (event: PointerEvent): void => {
    forgetPointer(event);

    if (event.pointerId === panPointerId) {
      cancelPendingMove();
      endPan();

      return;
    }

    if (event.pointerId !== gesturePointerId) {
      return;
    }

    cancelPendingMove();
    endGesture();
    target.onPointerCancel();
  };

  const handleDoubleClick = (event: MouseEvent): void => {
    if (event.button === PRIMARY_BUTTON) {
      target.onDoubleClick(toPlanPoint(event), toModifiers(event));
    }
  };

  const handlePointerLeave = (): void => {
    if (isNil(gesturePointerId) && isNil(panPointerId)) {
      target.onPointerLeave();
    }
  };

  const setSpaceHeld = (nextIsSpaceHeld: boolean): void => {
    isSpaceHeld = nextIsSpaceHeld;
    canvas.classList.toggle(PAN_CURSOR_CLASS, nextIsSpaceHeld);
  };

  const handleKeyDown = (event: KeyboardEvent): void => {
    // A hotkey must never fire while the user is typing exact dimensions into
    // the properties panel — including undo, which there means the text editor's.
    if (isEditableEventTarget(event.target)) {
      return;
    }

    const historyAction = toHistoryAction(event);

    if (!isNil(historyAction)) {
      applyHistoryAction(target, historyAction);
      event.preventDefault();

      return;
    }

    // Every other chord belongs to the browser and to the app shell.
    if (event.ctrlKey || event.metaKey) {
      return;
    }

    if (event.key === SPACE_KEY) {
      if (isActivatableControl(event.target)) {
        return;
      }

      setSpaceHeld(true);
      event.preventDefault();

      return;
    }

    if (target.onKeyDown(event.key, toModifiers(event))) {
      event.preventDefault();
    }
  };

  // Not guarded by the typing check: a keyup missed because focus moved into an
  // input would leave the canvas stuck in pan mode.
  const handleKeyUp = (event: KeyboardEvent): void => {
    if (event.key === SPACE_KEY) {
      setSpaceHeld(false);
    }
  };

  const handleWindowBlur = (): void => {
    setSpaceHeld(false);
    cancelPendingMove();
    forgetAllPointers();

    endPan();

    if (!isNil(gesturePointerId)) {
      endGesture();
      target.onPointerCancel();
    }
  };

  canvas.addEventListener('pointerdown', handlePointerDown);
  canvas.addEventListener('pointermove', handlePointerMove);
  canvas.addEventListener('pointerup', handlePointerUp);
  canvas.addEventListener('pointercancel', handlePointerCancel);
  canvas.addEventListener('pointerleave', handlePointerLeave);
  canvas.addEventListener('dblclick', handleDoubleClick);
  window.addEventListener('keydown', handleKeyDown);
  window.addEventListener('keyup', handleKeyUp);
  window.addEventListener('blur', handleWindowBlur);

  return () => {
    canvas.removeEventListener('pointerdown', handlePointerDown);
    canvas.removeEventListener('pointermove', handlePointerMove);
    canvas.removeEventListener('pointerup', handlePointerUp);
    canvas.removeEventListener('pointercancel', handlePointerCancel);
    canvas.removeEventListener('pointerleave', handlePointerLeave);
    canvas.removeEventListener('dblclick', handleDoubleClick);
    window.removeEventListener('keydown', handleKeyDown);
    window.removeEventListener('keyup', handleKeyUp);
    window.removeEventListener('blur', handleWindowBlur);

    cancelPendingMove();
    forgetAllPointers();
    endPan();
    endGesture();
    canvas.classList.remove(PAN_CURSOR_CLASS);
  };
}

function toModifiers({
  altKey,
  shiftKey,
}: {
  readonly altKey: boolean;
  readonly shiftKey: boolean;
}): PlanModifiers {
  return { isAltPressed: altKey, isShiftPressed: shiftKey };
}

function toHistoryAction(event: KeyboardEvent): HistoryAction | undefined {
  if (!event.ctrlKey && !event.metaKey) {
    return undefined;
  }

  const key = event.key.toLowerCase();

  if (key === REDO_KEY) {
    return 'redo';
  }

  if (key !== UNDO_KEY) {
    return undefined;
  }

  return event.shiftKey ? 'redo' : 'undo';
}

function applyHistoryAction(target: PlanInputTarget, action: HistoryAction): void {
  switch (action) {
    case 'undo':
      target.onUndo();

      return;
    case 'redo':
      target.onRedo();

      return;
    default:
      assertNever(action);
  }
}

function isActivatableControl(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && !isNil(target.closest(ACTIVATABLE_CONTROL_SELECTOR));
}
