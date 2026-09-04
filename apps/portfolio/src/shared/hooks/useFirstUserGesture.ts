import { useEffect } from 'react';

const GESTURE_EVENTS: ReadonlyArray<keyof DocumentEventMap> = [
  'pointerdown',
  'click',
  'keydown',
  'touchstart',
];

/**
 * Runs `onGesture` once, on the first user gesture anywhere in the document.
 * Browsers only let an `AudioContext` start inside a gesture, and Firefox
 * never resumes one created outside it, so the first interaction is the one
 * chance to unlock audio. Capture-phase listeners survive a `stopPropagation`
 * deeper in the tree. `onGesture` must be referentially stable.
 */
export function useFirstUserGesture(onGesture: VoidFunction): void {
  useEffect(() => {
    let fired = false;
    const handler = (): void => {
      if (fired) {
        return;
      }
      fired = true;
      onGesture();
    };
    for (const event of GESTURE_EVENTS) {
      document.addEventListener(event, handler, { capture: true });
    }
    return () => {
      for (const event of GESTURE_EVENTS) {
        document.removeEventListener(event, handler, { capture: true });
      }
    };
  }, [onGesture]);
}
