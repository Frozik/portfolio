import { describe, expect, it } from 'vitest';

import { clampToZone } from './touch-zone';

const ZONE = { width: 200, height: 400 };

describe('clampToZone', () => {
  it('leaves a point inside the zone where it is', () => {
    expect(clampToZone({ x: 120, y: 250 }, ZONE)).toEqual({ x: 120, y: 250 });
  });

  it('stops a point that crossed the middle of the screen at the zone edge', () => {
    expect(clampToZone({ x: -60, y: 250 }, ZONE)).toEqual({ x: 0, y: 250 });
    expect(clampToZone({ x: 260, y: 250 }, ZONE)).toEqual({ x: 200, y: 250 });
  });

  it('stops a point that left the zone above or below', () => {
    expect(clampToZone({ x: 120, y: -30 }, ZONE)).toEqual({ x: 120, y: 0 });
    expect(clampToZone({ x: 120, y: 430 }, ZONE)).toEqual({ x: 120, y: 400 });
  });
});
