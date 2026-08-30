import type { Vector2 } from '@frozik/utils/math/vector2';
import { isNil } from 'lodash-es';

import type { PlanViewport } from '../../domain/view/plan-viewport';
import { panByPixels, zoomAroundPoint } from '../../domain/view/plan-viewport';

/** Scale change of one full wheel notch. */
const ZOOM_PER_NOTCH = 1.15;
/** `deltaY` a mouse wheel reports for one notch in pixel mode. */
const PIXELS_PER_NOTCH = 100;
const LINES_PER_NOTCH = 3;
const PAGES_PER_NOTCH = 1;
const MIDDLE_BUTTON = 1;

export interface PlanNavigationParams {
  readonly canvas: HTMLCanvasElement;
  readonly getViewport: () => PlanViewport;
  readonly setViewport: (viewport: PlanViewport) => void;
}

/**
 * Camera-only pointer input: the wheel zooms towards the cursor and the middle
 * button pans. The primary button is deliberately left alone — it belongs to the
 * active tool, which the interaction controller owns.
 */
export function attachPlanNavigation({
  canvas,
  getViewport,
  setViewport,
}: PlanNavigationParams): VoidFunction {
  let panPointerId: number | undefined;
  let lastClientPoint: Vector2 | undefined;

  const handleWheel = (event: WheelEvent): void => {
    // The page must not scroll under a zoom gesture, so the listener is active.
    event.preventDefault();

    const notches = toNotches(event);

    if (notches === 0) {
      return;
    }

    setViewport(
      zoomAroundPoint(getViewport(), toCanvasPoint(canvas, event), ZOOM_PER_NOTCH ** -notches)
    );
  };

  // Chrome on Windows opens its autoscroll widget on a middle press; only the
  // legacy mouse event can call that off.
  const handleMouseDown = (event: MouseEvent): void => {
    if (event.button === MIDDLE_BUTTON) {
      event.preventDefault();
    }
  };

  const handlePointerDown = (event: PointerEvent): void => {
    if (event.button !== MIDDLE_BUTTON || !isNil(panPointerId)) {
      return;
    }

    panPointerId = event.pointerId;
    lastClientPoint = { x: event.clientX, y: event.clientY };
    canvas.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: PointerEvent): void => {
    if (event.pointerId !== panPointerId || isNil(lastClientPoint)) {
      return;
    }

    const deltaPx: Vector2 = {
      x: event.clientX - lastClientPoint.x,
      y: event.clientY - lastClientPoint.y,
    };

    lastClientPoint = { x: event.clientX, y: event.clientY };
    setViewport(panByPixels(getViewport(), deltaPx));
  };

  const endPan = (event: PointerEvent): void => {
    if (event.pointerId !== panPointerId) {
      return;
    }

    if (canvas.hasPointerCapture(event.pointerId)) {
      canvas.releasePointerCapture(event.pointerId);
    }

    panPointerId = undefined;
    lastClientPoint = undefined;
  };

  canvas.addEventListener('wheel', handleWheel, { passive: false });
  canvas.addEventListener('mousedown', handleMouseDown);
  canvas.addEventListener('pointerdown', handlePointerDown);
  canvas.addEventListener('pointermove', handlePointerMove);
  canvas.addEventListener('pointerup', endPan);
  canvas.addEventListener('pointercancel', endPan);

  return () => {
    canvas.removeEventListener('wheel', handleWheel);
    canvas.removeEventListener('mousedown', handleMouseDown);
    canvas.removeEventListener('pointerdown', handlePointerDown);
    canvas.removeEventListener('pointermove', handlePointerMove);
    canvas.removeEventListener('pointerup', endPan);
    canvas.removeEventListener('pointercancel', endPan);
  };
}

function toNotches(event: WheelEvent): number {
  switch (event.deltaMode) {
    case WheelEvent.DOM_DELTA_LINE:
      return event.deltaY / LINES_PER_NOTCH;
    case WheelEvent.DOM_DELTA_PAGE:
      return event.deltaY / PAGES_PER_NOTCH;
    default:
      return event.deltaY / PIXELS_PER_NOTCH;
  }
}

function toCanvasPoint(canvas: HTMLCanvasElement, event: MouseEvent): Vector2 {
  const bounds = canvas.getBoundingClientRect();

  return { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
}
