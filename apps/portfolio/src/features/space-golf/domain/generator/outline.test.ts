import { describe, expect, it } from 'vitest';

import { createEmptyGrid, fillRect } from './cell-grid';
import { traceOutlines } from './outline';

describe('traceOutlines', () => {
  it('walks an L-shaped island counter-clockwise through its six corners only', () => {
    const grid = fillRect(fillRect(createEmptyGrid(6, 6), { x: 1, y: 1, width: 3, height: 1 }), {
      x: 1,
      y: 2,
      width: 1,
      height: 2,
    });

    const [outline] = traceOutlines(grid);

    expect(traceOutlines(grid)).toHaveLength(1);
    expect(outline).toEqual([
      { x: 1, y: 1 },
      { x: 4, y: 1 },
      { x: 4, y: 2 },
      { x: 2, y: 2 },
      { x: 2, y: 4 },
      { x: 1, y: 4 },
    ]);
  });

  it('gives every island its own loop and follows the board edge for one lying on it', () => {
    const grid = fillRect(fillRect(createEmptyGrid(6, 6), { x: 0, y: 0, width: 2, height: 2 }), {
      x: 4,
      y: 4,
      width: 1,
      height: 1,
    });

    const outlines = traceOutlines(grid);

    expect(outlines).toHaveLength(2);
    expect(outlines).toContainEqual([
      { x: 0, y: 0 },
      { x: 2, y: 0 },
      { x: 2, y: 2 },
      { x: 0, y: 2 },
    ]);
  });
});
