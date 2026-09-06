import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CLICK_MOVEMENT_THRESHOLD, LINE_HOLD_DELAY_MS } from '../domain/constants';
import type { Vec3Array } from '../domain/topology-types';
import { createDragToConnectController } from './drag-connector';
import type { DragToConnectCallbacks, InitialDragHit } from './drag-connector-types';

const LINE_ID = 7;
const LINE_HIT: InitialDragHit = {
  kind: 'line',
  lineId: LINE_ID,
  direction: [1, 0, 0],
  planeAnchor: [0, 0, 0],
};
const VERTEX: Vec3Array = [2, 3, 4];
/** Where a press lands on the line; anything else on the canvas is empty. */
const ON_LINE = { x: 100, y: 100 };
const OFF_LINE = { x: 300, y: 300 };
const FAR_MOVE = CLICK_MOVEMENT_THRESHOLD * 4;

function pointerEvent(
  type: string,
  { x, y }: { readonly x: number; readonly y: number },
  pointerId = 1
): PointerEvent {
  return new PointerEvent(type, {
    clientX: x,
    clientY: y,
    pointerId,
    isPrimary: true,
    bubbles: true,
    cancelable: true,
  });
}

function setUp(snapAt: readonly { readonly x: number; readonly y: number }[] = []) {
  const canvas = document.createElement('canvas');
  document.body.append(canvas);
  canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 800, height: 600 }) as DOMRect;
  const isAt = (point: { readonly x: number; readonly y: number }, x: number, y: number) =>
    point.x === x && point.y === y;

  const callbacks: DragToConnectCallbacks = {
    performInitialHitTest: vi.fn((x, y) => (isAt(ON_LINE, x, y) ? LINE_HIT : undefined)),
    performSnapHitTest: vi.fn((x, y) =>
      snapAt.some(point => isAt(point, x, y)) ? VERTEX : undefined
    ),
    hasActiveSelection: vi.fn(() => false),
    onDragUpdate: vi.fn(),
    onVertexTap: vi.fn(),
    onLineTap: vi.fn(),
    onLineDoubleTap: vi.fn(),
    onDragComplete: vi.fn(),
    onSecondPointer: vi.fn(),
  };
  const cameraSawPointerDown = vi.fn();
  canvas.addEventListener('pointerdown', cameraSawPointerDown);
  const detach = createDragToConnectController(canvas, callbacks);

  return { canvas, callbacks, cameraSawPointerDown, detach };
}

describe('drag-to-connect: grabbing a line', () => {
  let session: ReturnType<typeof setUp>;

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    session.detach();
    session.canvas.remove();
    vi.useRealTimers();
  });

  it('selects an unselected line and opens the parallel-line drag as soon as it is pulled', () => {
    session = setUp();
    const { canvas, callbacks } = session;

    canvas.dispatchEvent(pointerEvent('pointerdown', ON_LINE));
    expect(callbacks.onDragUpdate).not.toHaveBeenCalled();
    expect(callbacks.onLineTap).not.toHaveBeenCalled();

    window.dispatchEvent(pointerEvent('pointermove', { x: ON_LINE.x + FAR_MOVE, y: ON_LINE.y }));

    expect(callbacks.onLineTap).toHaveBeenCalledWith(LINE_ID);
    expect(callbacks.onDragUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'line', sourceDirection: LINE_HIT.direction })
    );
  });

  it('drops a parallel line through the vertex the line is released on', () => {
    const target = { x: 400, y: 200 };
    session = setUp([target]);
    const { canvas, callbacks } = session;

    canvas.dispatchEvent(pointerEvent('pointerdown', ON_LINE));
    window.dispatchEvent(pointerEvent('pointermove', target));
    window.dispatchEvent(pointerEvent('pointerup', target));

    expect(callbacks.onDragComplete).toHaveBeenCalledWith(VERTEX, [3, 3, 4]);
    expect(callbacks.onDragUpdate).toHaveBeenLastCalledWith(undefined);
  });

  it('a drag released away from any vertex builds nothing and leaves the line selected', () => {
    session = setUp();
    const { canvas, callbacks } = session;

    canvas.dispatchEvent(pointerEvent('pointerdown', ON_LINE));
    window.dispatchEvent(pointerEvent('pointermove', OFF_LINE));
    window.dispatchEvent(pointerEvent('pointerup', OFF_LINE));

    expect(callbacks.onDragComplete).not.toHaveBeenCalled();
    expect(callbacks.onLineTap).toHaveBeenCalledTimes(1);
    expect(callbacks.onLineTap).toHaveBeenCalledWith(LINE_ID);
    expect(callbacks.onLineDoubleTap).not.toHaveBeenCalled();
  });

  it('holding the line still also opens the drag, and a release then never counts as a double tap', () => {
    session = setUp();
    const { canvas, callbacks } = session;

    canvas.dispatchEvent(pointerEvent('pointerdown', ON_LINE));
    window.dispatchEvent(pointerEvent('pointerup', ON_LINE));
    expect(callbacks.onLineTap).toHaveBeenCalledTimes(1);

    canvas.dispatchEvent(pointerEvent('pointerdown', ON_LINE));
    vi.advanceTimersByTime(LINE_HOLD_DELAY_MS + 1);
    expect(callbacks.onDragUpdate).toHaveBeenCalledWith(expect.objectContaining({ kind: 'line' }));

    window.dispatchEvent(pointerEvent('pointerup', ON_LINE));

    expect(callbacks.onLineDoubleTap).not.toHaveBeenCalled();
    expect(callbacks.onLineTap).toHaveBeenCalledTimes(2);
  });

  it('a quick tap still selects, and a second quick tap toggles the extension', () => {
    session = setUp();
    const { canvas, callbacks } = session;

    canvas.dispatchEvent(pointerEvent('pointerdown', ON_LINE));
    window.dispatchEvent(pointerEvent('pointerup', ON_LINE));
    canvas.dispatchEvent(pointerEvent('pointerdown', ON_LINE));
    window.dispatchEvent(pointerEvent('pointerup', ON_LINE));

    expect(callbacks.onLineTap).toHaveBeenCalledTimes(1);
    expect(callbacks.onLineDoubleTap).toHaveBeenCalledWith(LINE_ID);
    expect(callbacks.onDragUpdate).not.toHaveBeenCalled();
  });

  it('leaves a press beside the line to the camera', () => {
    session = setUp();
    const { canvas, callbacks, cameraSawPointerDown } = session;

    canvas.dispatchEvent(pointerEvent('pointerdown', OFF_LINE));
    window.dispatchEvent(pointerEvent('pointermove', ON_LINE));
    window.dispatchEvent(pointerEvent('pointerup', ON_LINE));

    expect(cameraSawPointerDown).toHaveBeenCalledTimes(1);
    expect(callbacks.onDragUpdate).not.toHaveBeenCalled();
    expect(callbacks.onLineTap).not.toHaveBeenCalled();
  });

  it('a press on the line never reaches the camera', () => {
    session = setUp();
    const { canvas, cameraSawPointerDown } = session;

    canvas.dispatchEvent(pointerEvent('pointerdown', ON_LINE));

    expect(cameraSawPointerDown).not.toHaveBeenCalled();
  });
});
