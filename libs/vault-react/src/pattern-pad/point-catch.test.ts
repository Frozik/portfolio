import { catchesPoint } from './point-catch';

const CELL = { left: 0, top: 0, width: 80, height: 80 };

describe('catching a point of the pattern', () => {
  it('joins a point the finger passes close to its centre', () => {
    expect(catchesPoint(CELL, 40, 40)).toBe(true);
    expect(catchesPoint(CELL, 55, 45)).toBe(true);
  });

  it('leaves a point alone when the finger only crosses a corner of its cell', () => {
    expect(catchesPoint(CELL, 75, 75)).toBe(false);
    expect(catchesPoint(CELL, 5, 70)).toBe(false);
  });
});
