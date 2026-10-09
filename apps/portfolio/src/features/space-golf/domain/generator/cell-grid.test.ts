import { describe, expect, it } from 'vitest';

import {
  createEmptyGrid,
  fillRect,
  hasDiagonalOnlyContact,
  hasNarrowSlot,
  isConnected,
} from './cell-grid';

describe('cell grid', () => {
  it('detects when a block cuts the empty space in two', () => {
    const open = fillRect(createEmptyGrid(4, 4), { x: 1, y: 1, width: 1, height: 1 });
    const cut = fillRect(createEmptyGrid(4, 4), { x: 0, y: 2, width: 4, height: 1 });

    expect(isConnected(open, { x: 0, y: 0 })).toBe(true);
    expect(isConnected(cut, { x: 0, y: 0 })).toBe(false);
  });

  it('finds a slot narrower than a passage between two blocks, and lets a run to the board edge be', () => {
    const whole = { x: 0, y: 0, width: 8, height: 4 };
    const left = fillRect(createEmptyGrid(8, 4), { x: 1, y: 0, width: 1, height: 4 });
    const slot = fillRect(left, { x: 3, y: 0, width: 1, height: 4 });
    const passage = fillRect(left, { x: 4, y: 0, width: 1, height: 4 });

    expect(hasNarrowSlot(left, 2, whole)).toBe(false);
    expect(hasNarrowSlot(slot, 2, whole)).toBe(true);
    expect(hasNarrowSlot(passage, 2, whole)).toBe(false);
  });

  it('finds a corner-only contact where cells were added, and leaves alone one that already stood elsewhere', () => {
    const staircase = fillRect(
      fillRect(createEmptyGrid(10, 6), { x: 0, y: 0, width: 1, height: 1 }),
      {
        x: 1,
        y: 1,
        width: 1,
        height: 1,
      }
    );
    const farArm = { x: 6, y: 2, width: 3, height: 2 };
    const touchingArm = { x: 2, y: 2, width: 2, height: 2 };

    expect(hasDiagonalOnlyContact(fillRect(staircase, farArm), farArm)).toBe(false);
    expect(hasDiagonalOnlyContact(fillRect(staircase, touchingArm), touchingArm)).toBe(true);
  });
});
