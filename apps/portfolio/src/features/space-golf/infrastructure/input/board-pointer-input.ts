import type { Vector2 } from '@frozik/utils/math/vector2';

const PRIMARY_BUTTON = 0;

export interface BoardPointerHandlers {
  /** CSS pixels relative to the canvas → board metres. */
  readonly toBoard: (cssX: number, cssY: number) => Vector2;
  readonly onAnchor: (point: Vector2) => void;
  readonly onPull: (point: Vector2) => void;
  readonly onRelease: VoidFunction;
  readonly onCancel: VoidFunction;
}

/**
 * The rubber band on a pointer: the first press anywhere on the canvas is the
 * anchor, every move updates the pull, the release plays the stroke, and a
 * cancelled pointer or a lost window drops the band without a stroke.
 */
export function createBoardPointerInput(
  canvas: HTMLCanvasElement,
  handlers: BoardPointerHandlers
): VoidFunction {
  let activePointer: number | undefined;

  const toBoard = (event: PointerEvent): Vector2 => {
    const rect = canvas.getBoundingClientRect();
    return handlers.toBoard(event.clientX - rect.left, event.clientY - rect.top);
  };

  const onPointerDown = (event: PointerEvent): void => {
    if (event.button !== PRIMARY_BUTTON || activePointer !== undefined) {
      return;
    }
    activePointer = event.pointerId;
    try {
      canvas.setPointerCapture(event.pointerId);
    } catch {
      // Synthetic events (tests) have no active pointer to capture.
    }
    handlers.onAnchor(toBoard(event));
  };

  const onPointerMove = (event: PointerEvent): void => {
    if (event.pointerId === activePointer) {
      handlers.onPull(toBoard(event));
    }
  };

  const onPointerUp = (event: PointerEvent): void => {
    if (event.pointerId === activePointer) {
      activePointer = undefined;
      handlers.onRelease();
    }
  };

  const cancel = (): void => {
    if (activePointer !== undefined) {
      activePointer = undefined;
      handlers.onCancel();
    }
  };

  const onPointerCancel = (event: PointerEvent): void => {
    if (event.pointerId === activePointer) {
      cancel();
    }
  };

  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', onPointerCancel);
  window.addEventListener('blur', cancel);

  return () => {
    canvas.removeEventListener('pointerdown', onPointerDown);
    canvas.removeEventListener('pointermove', onPointerMove);
    canvas.removeEventListener('pointerup', onPointerUp);
    canvas.removeEventListener('pointercancel', onPointerCancel);
    window.removeEventListener('blur', cancel);
  };
}
