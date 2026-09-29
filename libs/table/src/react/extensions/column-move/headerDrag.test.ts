import type { PointerEvent } from 'react';

import type { IColumnMoveSlice } from '../../../extensions/column-move/core';
import type { IHeaderContext } from '../../column';
import { createHeaderDrag } from './headerDrag';

function harness() {
  const calls: string[] = [];
  const slice: IColumnMoveSlice = {
    drag: null,
    reasonAgainst: () => undefined,
    begin: id => void calls.push(`begin:${id}`),
    hover: () => undefined,
    drop: () => undefined,
    cancel: () => undefined,
    move: () => ({ ok: true }),
  };
  const context = { column: { id: 'price' } } as IHeaderContext<never>;
  const cell = document.createElement('div');
  const captured: number[] = [];
  cell.setPointerCapture = (pointerId: number) => void captured.push(pointerId);
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
  return { props, drag, context, cell, button, captured, calls, pointer, slice };
}

describe('header drag', () => {
  it('captures the pointer only once the drag has begun, so a plain click reaches the buttons', () => {
    const { props, cell, captured, calls, pointer } = harness();
    props.onPointerDown?.(pointer(cell, 10));
    expect(captured).toEqual([]);
    props.onPointerMove?.(pointer(cell, 12));
    expect(calls).toEqual([]);
    props.onPointerMove?.(pointer(cell, 20));
    expect(captured).toEqual([7]);
    expect(calls).toEqual(['begin:price']);
  });

  it('keeps following the pointer after the header re-rendered its handlers mid-drag', () => {
    const { props, drag, context, cell, calls, pointer, slice } = harness();
    const hovered: (number | undefined)[] = [];
    slice.hover = index => void hovered.push(index);
    props.onPointerDown?.(pointer(cell, 10));
    props.onPointerMove?.(pointer(cell, 30));
    expect(calls).toEqual(['begin:price']);
    const rerendered = drag(context);
    rerendered.onPointerMove?.(pointer(cell, 60));
    expect(hovered).toHaveLength(2);
  });

  it('never starts a drag from a control inside the header', () => {
    const { props, button, captured, calls, pointer } = harness();
    props.onPointerDown?.(pointer(button, 10));
    props.onPointerMove?.(pointer(button, 40));
    expect(captured).toEqual([]);
    expect(calls).toEqual([]);
  });
});
