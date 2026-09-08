import { describe, expect, it } from 'vitest';

import { createEmptyGrid, fillRect, isConnected, solidRectangles } from './cell-grid';

describe('cell grid', () => {
  it('detects when a block cuts the empty space in two', () => {
    const open = fillRect(createEmptyGrid(4, 4), { x: 1, y: 1, width: 1, height: 1 });
    const cut = fillRect(createEmptyGrid(4, 4), { x: 0, y: 2, width: 4, height: 1 });

    expect(isConnected(open, { x: 0, y: 0 })).toBe(true);
    expect(isConnected(cut, { x: 0, y: 0 })).toBe(false);
  });

  it('merges solid cells into rectangles that cover each cell once', () => {
    const grid = fillRect(fillRect(createEmptyGrid(4, 4), { x: 0, y: 0, width: 2, height: 2 }), {
      x: 2,
      y: 0,
      width: 1,
      height: 1,
    });

    const rects = solidRectangles(grid);

    expect(rects).toEqual([
      { x: 0, y: 0, width: 3, height: 1 },
      { x: 0, y: 1, width: 2, height: 1 },
    ]);
  });
});
