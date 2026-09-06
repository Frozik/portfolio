import type { Vector2 } from '@frozik/utils/math/vector2';
import { isNil } from 'lodash-es';

import type { PlanInputTarget } from '../domain/view/plan-input';
import type { PlanViewport } from '../domain/view/plan-viewport';
import { panByPixels, screenToPlan } from '../domain/view/plan-viewport';
import { PinchGesture } from './pinch-gesture';
import { attachPlanKeyboardInput } from './plan-keyboard-input';
import { toModifiers } from './plan-modifiers';

const PRIMARY_BUTTON = 0;
/** Tailwind utility toggled on the canvas while the pan modifier is held. */
const PAN_CURSOR_CLASS = 'cursor-grab';

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
  const pinch = new PinchGesture();

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

  /** A second finger is the camera taking over from whatever the first was doing. */
  const beginPinch = (): void => {
    cancelPendingMove();
    endPan();

    if (!isNil(gesturePointerId)) {
      endGesture();
      target.onPointerCancel();
    }
  };

  const handlePointerDown = (event: PointerEvent): void => {
    if (pinch.trackPointerDown(event)) {
      beginPinch();

      return;
    }

    if (
      pinch.isPinching() ||
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
    const previousCenter = pinch.trackPointerMove(event);

    if (!isNil(previousCenter)) {
      setViewport(pinch.apply(getViewport(), previousCenter, toCanvasPoint));

      return;
    }

    // While two fingers hold the camera, nothing else may move the plan.
    if (pinch.isPinching()) {
      return;
    }

    pendingMoveEvent = event;

    if (isNil(moveFrameId)) {
      moveFrameId = requestAnimationFrame(flushMove);
    }
  };

  const handlePointerUp = (event: PointerEvent): void => {
    pinch.forgetPointer(event);

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
    pinch.forgetPointer(event);

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

  const handleWindowBlur = (): void => {
    setSpaceHeld(false);
    cancelPendingMove();
    pinch.forgetAll();

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
  window.addEventListener('blur', handleWindowBlur);

  const detachKeyboard = attachPlanKeyboardInput({ target, setSpaceHeld });

  return () => {
    canvas.removeEventListener('pointerdown', handlePointerDown);
    canvas.removeEventListener('pointermove', handlePointerMove);
    canvas.removeEventListener('pointerup', handlePointerUp);
    canvas.removeEventListener('pointercancel', handlePointerCancel);
    canvas.removeEventListener('pointerleave', handlePointerLeave);
    canvas.removeEventListener('dblclick', handleDoubleClick);
    window.removeEventListener('blur', handleWindowBlur);
    detachKeyboard();

    cancelPendingMove();
    pinch.forgetAll();
    endPan();
    endGesture();
    canvas.classList.remove(PAN_CURSOR_CLASS);
  };
}
