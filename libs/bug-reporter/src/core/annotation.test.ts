import { describe, expect, it } from 'vitest';

import type { TShape } from './annotation';
import { addShape, arrowHead, EMPTY_ANNOTATION, redo, toBox, undo } from './annotation';

const RECTANGLE: TShape = {
  kind: 'rectangle',
  from: { x: 10, y: 10 },
  to: { x: 50, y: 30 },
  stroke: { color: '#f00', width: 4 },
};
const ARROW: TShape = {
  kind: 'arrow',
  from: { x: 0, y: 0 },
  to: { x: 40, y: 0 },
  stroke: { color: '#f00', width: 4 },
};

describe('annotation', () => {
  it('ignores an accidental click that draws nothing visible', () => {
    const tap: TShape = {
      kind: 'rectangle',
      from: { x: 5, y: 5 },
      to: { x: 6, y: 7 },
      stroke: { color: '#f00', width: 4 },
    };
    expect(addShape(EMPTY_ANNOTATION, tap)).toBe(EMPTY_ANNOTATION);
  });

  it('keeps earlier shapes untouched when a new one is added', () => {
    const one = addShape(EMPTY_ANNOTATION, RECTANGLE);
    const two = addShape(one, ARROW);

    expect(one.shapes).toEqual([RECTANGLE]);
    expect(two.shapes).toEqual([RECTANGLE, ARROW]);
  });

  it('undo removes the last shape and redo brings it back', () => {
    const drawn = addShape(addShape(EMPTY_ANNOTATION, RECTANGLE), ARROW);
    const undone = undo(drawn);
    expect(undone.shapes).toEqual([RECTANGLE]);
    expect(redo(undone).shapes).toEqual([RECTANGLE, ARROW]);
  });

  it('drawing after an undo discards the redo history', () => {
    const undone = undo(addShape(EMPTY_ANNOTATION, RECTANGLE));
    const redrawn = addShape(undone, ARROW);
    expect(redo(redrawn)).toBe(redrawn);
  });

  it('undo and redo on an empty history are no-ops', () => {
    expect(undo(EMPTY_ANNOTATION)).toBe(EMPTY_ANNOTATION);
    expect(redo(EMPTY_ANNOTATION)).toBe(EMPTY_ANNOTATION);
  });

  it('normalises a box drawn from any corner', () => {
    expect(toBox({ x: 50, y: 30 }, { x: 10, y: 10 })).toEqual({
      x: 10,
      y: 10,
      width: 40,
      height: 20,
    });
  });

  it('puts the arrow head wings behind the tip, symmetric about the shaft', () => {
    const [left, right] = arrowHead({ x: 0, y: 0 }, { x: 100, y: 0 }, 10);
    expect(left.x).toBeLessThan(100);
    expect(right.x).toBeCloseTo(left.x);
    expect(right.y).toBeCloseTo(-left.y);
  });
});
