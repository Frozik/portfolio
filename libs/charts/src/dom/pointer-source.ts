import type { IPointerInput, IPointerSource, TPointerKind } from '../core/host/pointer-source';
import { PointerListeners } from '../core/host/pointer-source';

const POINTER_EVENTS = [
  'pointerdown',
  'pointermove',
  'pointerup',
  'pointercancel',
  'pointerleave',
] as const;

const POINTER_PHASES: Readonly<Record<(typeof POINTER_EVENTS)[number], IPointerInput['phase']>> = {
  pointerdown: 'down',
  pointermove: 'move',
  pointerup: 'up',
  pointercancel: 'cancel',
  pointerleave: 'leave',
};

function kindOf(event: PointerEvent): TPointerKind {
  return event.pointerType === 'touch' || event.pointerType === 'pen' ? event.pointerType : 'mouse';
}

export interface IDomPointerSource extends IPointerSource {
  dispose(): void;
}

/**
 * Pointer and wheel events of an element as the headless layers take them:
 * positions from the element's corner, a pressed pointer captured so a drag
 * that leaves the element keeps going.
 */
export function createPointerSource(element: HTMLElement): IDomPointerSource {
  const listeners = new PointerListeners();

  const positionOf = (event: MouseEvent): { readonly x: number; readonly y: number } => {
    const box = element.getBoundingClientRect();
    return { x: event.clientX - box.left, y: event.clientY - box.top };
  };

  const onPointer = (phase: IPointerInput['phase'], event: PointerEvent): void => {
    if (phase === 'down') {
      element.setPointerCapture(event.pointerId);
    } else if (phase === 'up' && element.hasPointerCapture(event.pointerId)) {
      element.releasePointerCapture(event.pointerId);
    }
    const input: IPointerInput = {
      phase,
      pointerId: event.pointerId,
      kind: kindOf(event),
      ...positionOf(event),
      timeStamp: event.timeStamp,
    };
    listeners.pointer(input);
  };

  const onWheel = (event: WheelEvent): void => {
    event.preventDefault();
    listeners.wheel({ ...positionOf(event), deltaY: event.deltaY });
  };

  const stopListening = new AbortController();
  for (const name of POINTER_EVENTS) {
    element.addEventListener(name, event => onPointer(POINTER_PHASES[name], event), {
      signal: stopListening.signal,
    });
  }
  element.addEventListener('wheel', onWheel, { passive: false, signal: stopListening.signal });

  return {
    subscribe: (listener, priority) => listeners.add(listener, priority),
    setCursor(cursor): void {
      element.style.cursor = cursor;
    },
    dispose(): void {
      stopListening.abort();
      listeners.clear();
    },
  };
}
