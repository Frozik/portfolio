import type { Vector2 } from '@frozik/utils/math/vector2';

const PRIMARY_BUTTON = 0;
/** Two taps this close in time and place are a double tap: back to the ball. */
const DOUBLE_TAP_MILLISECONDS = 320;
const TAP_SLOP_PIXELS = 12;
const TAP_MAX_MILLISECONDS = 250;
/** Ctrl + wheel, which is also what a trackpad pinch sends: zoom per pixel of wheel travel. */
const WHEEL_ZOOM_PER_PIXEL = 0.0025;
/** Wheel deltas reported in lines rather than pixels are scaled by this. */
const WHEEL_LINE_PIXELS = 16;
const KEY_PAN_PIXELS = 80;
const KEY_ZOOM_FACTOR = 1.25;

export interface BoardPointerHandlers {
  /** CSS pixels relative to the canvas → a point of the band, in metres at the one scale. */
  readonly toBand: (cssX: number, cssY: number) => Vector2;
  readonly onAnchor: (point: Vector2) => void;
  readonly onPull: (point: Vector2) => void;
  readonly onRelease: VoidFunction;
  readonly onCancel: VoidFunction;
  /** Move the view this many CSS pixels to the right and down the screen. */
  readonly onPan: (rightPixels: number, downPixels: number) => void;
  /** Multiply the zoom: above 1 closer, below 1 further out. */
  readonly onZoom: (factor: number) => void;
  /** Back to the ball. */
  readonly onAttach: VoidFunction;
}

interface Tracked {
  readonly x: number;
  readonly y: number;
}

type Mode = 'idle' | 'band' | 'drag' | 'gesture';

const PAN_KEYS: Readonly<Record<string, readonly [right: number, down: number]>> = {
  arrowleft: [-1, 0],
  a: [-1, 0],
  arrowright: [1, 0],
  d: [1, 0],
  arrowup: [0, -1],
  w: [0, -1],
  arrowdown: [0, 1],
  s: [0, 1],
};

/**
 * The canvas's pointers, the way maps do it so that looking around never
 * collides with the stroke. One finger, or the left button, is always the
 * rubber band: the first press anywhere is the anchor, every move the pull,
 * the release the stroke. Two fingers drag the view and pinch it; the
 * wheel or a trackpad scrolls it, Ctrl + wheel zooms; the right or middle
 * button, or Space with the left, drags it; arrows and WASD step it, `+`
 * and `-` zoom; a double tap or click, or `C`, goes back to the ball. A
 * second finger landing on a held band drops the band without a stroke.
 */
export function createBoardPointerInput(
  canvas: HTMLCanvasElement,
  handlers: BoardPointerHandlers
): VoidFunction {
  const pointers = new Map<number, Tracked>();
  let mode: Mode = 'idle';
  let bandPointer: number | undefined;
  let spaceHeld = false;
  let pressed: { readonly x: number; readonly y: number; readonly time: number } | undefined;
  let lastTap: { readonly x: number; readonly y: number; readonly time: number } | undefined;

  const local = (event: PointerEvent | MouseEvent): Tracked => {
    const rect = canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  const capture = (pointerId: number): void => {
    try {
      canvas.setPointerCapture(pointerId);
    } catch {
      // Synthetic events (tests) have no active pointer to capture.
    }
  };

  const dropBand = (): void => {
    if (mode === 'band') {
      bandPointer = undefined;
      handlers.onCancel();
    }
  };

  const centroid = (): Tracked => {
    let x = 0;
    let y = 0;
    for (const point of pointers.values()) {
      x += point.x;
      y += point.y;
    }
    return { x: x / pointers.size, y: y / pointers.size };
  };

  const spread = (): number => {
    const [first, second] = [...pointers.values()];
    return Math.hypot(second.x - first.x, second.y - first.y);
  };

  const onPointerDown = (event: PointerEvent): void => {
    const point = local(event);
    pointers.set(event.pointerId, point);
    capture(event.pointerId);
    if (pointers.size > 1) {
      dropBand();
      mode = 'gesture';
      return;
    }
    if (event.button !== PRIMARY_BUTTON || spaceHeld) {
      mode = 'drag';
      return;
    }
    mode = 'band';
    bandPointer = event.pointerId;
    pressed = { ...point, time: event.timeStamp };
    handlers.onAnchor(handlers.toBand(point.x, point.y));
  };

  const onPointerMove = (event: PointerEvent): void => {
    const before = pointers.get(event.pointerId);
    if (before === undefined) {
      return;
    }
    const point = local(event);
    if (mode === 'band' && event.pointerId === bandPointer) {
      pointers.set(event.pointerId, point);
      handlers.onPull(handlers.toBand(point.x, point.y));
      return;
    }
    if (mode === 'drag') {
      pointers.set(event.pointerId, point);
      handlers.onPan(before.x - point.x, before.y - point.y);
      return;
    }
    if (mode === 'gesture' && pointers.size > 1) {
      const centreBefore = centroid();
      const spreadBefore = spread();
      pointers.set(event.pointerId, point);
      const centreAfter = centroid();
      handlers.onPan(centreBefore.x - centreAfter.x, centreBefore.y - centreAfter.y);
      if (spreadBefore > 0) {
        handlers.onZoom(spread() / spreadBefore);
      }
    }
  };

  const noteTap = (event: PointerEvent): void => {
    const point = local(event);
    const quick =
      pressed !== undefined &&
      event.timeStamp - pressed.time <= TAP_MAX_MILLISECONDS &&
      Math.hypot(point.x - pressed.x, point.y - pressed.y) <= TAP_SLOP_PIXELS;
    if (!quick) {
      lastTap = undefined;
      return;
    }
    const doubled =
      lastTap !== undefined &&
      event.timeStamp - lastTap.time <= DOUBLE_TAP_MILLISECONDS &&
      Math.hypot(point.x - lastTap.x, point.y - lastTap.y) <= TAP_SLOP_PIXELS * 2;
    lastTap = doubled ? undefined : { ...point, time: event.timeStamp };
    if (doubled) {
      handlers.onAttach();
    }
  };

  const onPointerUp = (event: PointerEvent): void => {
    if (!pointers.delete(event.pointerId)) {
      return;
    }
    if (mode === 'band' && event.pointerId === bandPointer) {
      bandPointer = undefined;
      handlers.onRelease();
      noteTap(event);
    }
    // A finger left over from a gesture is not a band: wait for every finger to lift.
    if (pointers.size === 0) {
      mode = 'idle';
    }
  };

  const cancelAll = (): void => {
    dropBand();
    pointers.clear();
    mode = 'idle';
  };

  const onPointerCancel = (event: PointerEvent): void => {
    if (pointers.has(event.pointerId)) {
      cancelAll();
    }
  };

  const onWheel = (event: WheelEvent): void => {
    event.preventDefault();
    const unit = event.deltaMode === WheelEvent.DOM_DELTA_PIXEL ? 1 : WHEEL_LINE_PIXELS;
    if (event.ctrlKey || event.metaKey) {
      handlers.onZoom(Math.exp(-event.deltaY * unit * WHEEL_ZOOM_PER_PIXEL));
      return;
    }
    handlers.onPan(event.deltaX * unit, event.deltaY * unit);
  };

  const onContextMenu = (event: MouseEvent): void => {
    event.preventDefault();
  };

  const isTyping = (event: KeyboardEvent): boolean =>
    event.target instanceof HTMLElement &&
    (event.target.isContentEditable ||
      ['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName));

  const onKeyDown = (event: KeyboardEvent): void => {
    if (isTyping(event) || event.metaKey || event.ctrlKey || event.altKey) {
      return;
    }
    const key = event.key.toLowerCase();
    if (key === ' ') {
      spaceHeld = true;
      event.preventDefault();
      return;
    }
    const step = PAN_KEYS[key];
    if (step !== undefined) {
      event.preventDefault();
      handlers.onPan(step[0] * KEY_PAN_PIXELS, step[1] * KEY_PAN_PIXELS);
    } else if (key === 'c') {
      handlers.onAttach();
    } else if (key === '+' || key === '=') {
      handlers.onZoom(KEY_ZOOM_FACTOR);
    } else if (key === '-') {
      handlers.onZoom(1 / KEY_ZOOM_FACTOR);
    }
  };

  const onKeyUp = (event: KeyboardEvent): void => {
    if (event.key === ' ') {
      spaceHeld = false;
    }
  };

  const onBlur = (): void => {
    spaceHeld = false;
    cancelAll();
  };

  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', onPointerCancel);
  canvas.addEventListener('wheel', onWheel, { passive: false });
  canvas.addEventListener('contextmenu', onContextMenu);
  canvas.addEventListener('dblclick', handlers.onAttach);
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);

  return () => {
    canvas.removeEventListener('pointerdown', onPointerDown);
    canvas.removeEventListener('pointermove', onPointerMove);
    canvas.removeEventListener('pointerup', onPointerUp);
    canvas.removeEventListener('pointercancel', onPointerCancel);
    canvas.removeEventListener('wheel', onWheel);
    canvas.removeEventListener('contextmenu', onContextMenu);
    canvas.removeEventListener('dblclick', handlers.onAttach);
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
    window.removeEventListener('blur', onBlur);
  };
}
