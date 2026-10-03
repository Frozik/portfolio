import type { MouseEvent, PointerEvent } from 'react';

import type { IColumnMoveSlice } from '../../../extensions/column-move/core';
import type { IHeaderContext } from '../../column';
import { createHeaderDrag } from './headerDrag';

function harness() {
  const calls: string[] = [];
  let dragging: string | null = null;
  const slice: IColumnMoveSlice = {
    get drag() {
      return dragging === null
        ? null
        : { columnId: dragging, targetIndex: undefined, targetGroup: undefined };
    },
    reasonAgainst: () => undefined,
    begin: id => {
      calls.push(`begin:${id}`);
      dragging = id;
    },
    hover: index => void calls.push(`hover:${index}`),
    drop: () => {
      calls.push('drop');
      dragging = null;
      return undefined;
    },
    cancel: () => {
      calls.push('cancel');
      dragging = null;
    },
    move: () => ({ ok: true }),
  };
  const context = { column: { id: 'price' } } as IHeaderContext<never>;
  const cell = document.createElement('div');
  const button = document.createElement('button');
  cell.append(button);
  const drag = createHeaderDrag<never>(slice);
  const props = drag(context);
  const pointer = (target: Element, x: number, extra: Partial<PointerEvent<HTMLDivElement>> = {}) =>
    ({
      button: 0,
      pointerId: 7,
      clientX: x,
      clientY: 0,
      target,
      currentTarget: cell,
      ...extra,
    }) as PointerEvent<HTMLDivElement>;
  const onDocument = (type: string, clientX = 0) =>
    document.dispatchEvent(new window.PointerEvent(type, { clientX, bubbles: true }));
  const begin = () => {
    props.onPointerDown?.(pointer(cell, 10));
    props.onPointerMove?.(pointer(cell, 30));
  };
  const click = () => {
    const event = { stopPropagation: vi.fn() } as unknown as MouseEvent<HTMLDivElement>;
    props.onClickCapture?.(event);
    return event.stopPropagation;
  };
  return { props, cell, button, calls, pointer, slice, onDocument, begin, click };
}

describe('header drag', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('begins only once the pointer moved past the threshold, so a plain press stays a click', () => {
    const { props, cell, calls, pointer, onDocument } = harness();
    props.onPointerDown?.(pointer(cell, 10));
    props.onPointerMove?.(pointer(cell, 12));
    onDocument('pointermove', 12);
    expect(calls).toEqual([]);
    props.onPointerMove?.(pointer(cell, 20));
    expect(calls).toEqual(['begin:price']);
  });

  it('follows the pointer on the document, where it keeps arriving as the cells change places, and drops on release', () => {
    const { calls, onDocument, begin } = harness();
    begin();
    onDocument('pointermove', 60);
    onDocument('pointermove', 90);
    onDocument('pointerup');
    onDocument('pointermove', 120);
    expect(calls).toEqual(['begin:price', 'hover:undefined', 'hover:undefined', 'drop']);
  });

  it('cancels on Escape and on a cancelled pointer', () => {
    const { calls, onDocument, begin } = harness();
    begin();
    document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape' }));
    begin();
    onDocument('pointercancel');
    expect(calls).toEqual(['begin:price', 'cancel', 'begin:price', 'cancel']);
  });

  it('swallows the click that ends a drag and lets the next press through', () => {
    const { props, cell, pointer, onDocument, begin, click } = harness();
    begin();
    onDocument('pointerup');
    expect(click()).toHaveBeenCalledOnce();
    props.onPointerDown?.(pointer(cell, 10));
    expect(click()).not.toHaveBeenCalled();
  });

  it('names no slot while the pointer is over the dragged column itself, which already stands where it landed', () => {
    const { cell, calls, onDocument, begin } = harness();
    cell.dataset.columnId = 'price';
    vi.spyOn(document, 'elementFromPoint').mockReturnValue(cell);
    begin();
    onDocument('pointermove', 60);
    onDocument('pointerup');
    expect(calls).toEqual(['begin:price', 'hover:undefined', 'drop']);
  });

  it('never starts a drag from a control inside the header', () => {
    const { props, button, calls, pointer } = harness();
    props.onPointerDown?.(pointer(button, 10));
    props.onPointerMove?.(pointer(button, 40));
    expect(calls).toEqual([]);
  });
});
