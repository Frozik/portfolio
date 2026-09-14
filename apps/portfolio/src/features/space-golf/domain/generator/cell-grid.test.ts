import { describe, expect, it } from 'vitest';

import { createEmptyGrid, fillRect, isConnected } from './cell-grid';

describe('cell grid', () => {
  it('detects when a block cuts the empty space in two', () => {
    const open = fillRect(createEmptyGrid(4, 4), { x: 1, y: 1, width: 1, height: 1 });
    const cut = fillRect(createEmptyGrid(4, 4), { x: 0, y: 2, width: 4, height: 1 });

    expect(isConnected(open, { x: 0, y: 0 })).toBe(true);
    expect(isConnected(cut, { x: 0, y: 0 })).toBe(false);
  });
});
