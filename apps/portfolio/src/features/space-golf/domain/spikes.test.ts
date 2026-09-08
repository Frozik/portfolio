import { describe, expect, it } from 'vitest';

import { SPIKE_HEIGHT_METERS } from './constants';
import { activeHazards, isExtended } from './spikes';
import { createTestLevel } from './test-level';

describe('spike rows', () => {
  it('flip with the parity of the strokes played', () => {
    const row = { wall: 0, edge: 0, from: 0, length: 1, extendedOnOddStrokes: true };

    expect(isExtended(row, 1)).toBe(true);
    expect(isExtended(row, 2)).toBe(false);
    expect(isExtended({ ...row, extendedOnOddStrokes: false }, 2)).toBe(true);
  });

  it('lift their tips off the floor by the spike height when extended', () => {
    const level = createTestLevel();

    expect(activeHazards(level, 2)).toEqual([]);
    const [hazard] = activeHazards(level, 1);
    expect(hazard.from.y).toBeCloseTo(SPIKE_HEIGHT_METERS);
    expect([hazard.from.x, hazard.to.x].sort()).toEqual([8, 9]);
  });
});
