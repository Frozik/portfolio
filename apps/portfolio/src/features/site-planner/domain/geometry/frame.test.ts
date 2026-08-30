import { area } from 'clipper2-ts';
import { describe, expect, it } from 'vitest';

import { SCALE_UNITS_PER_METER } from '../units';
import { fromClipperPath, toClipperPath, toClipperUnits } from './frame';
import type { Ring } from './polygon-types';

const PLOT_SIDE_METERS = 200;

describe('toClipperPath', () => {
  it('scales metres to whole millimetres', () => {
    const path = toClipperPath([{ x: 1.234, y: -5.678 }]);

    expect(path).toEqual([{ x: 1234, y: -5678 }]);
  });

  it('rounds sub-millimetre coordinates to the nearest unit', () => {
    const path = toClipperPath([
      { x: 0.00049, y: 0.00051 },
      { x: -0.00149, y: -0.00151 },
    ]);

    expect(path).toEqual([
      { x: 0, y: 1 },
      { x: -1, y: -2 },
    ]);
  });

  it('produces only integers', () => {
    const path = toClipperPath([
      { x: 12.3456789, y: 7.7777777 },
      { x: -0.1, y: 0.2 },
    ]);

    for (const point of path) {
      expect(Number.isInteger(point.x)).toBe(true);
      expect(Number.isInteger(point.y)).toBe(true);
    }
  });
});

describe('toClipperPath / fromClipperPath round trip', () => {
  it('restores millimetre-aligned coordinates exactly', () => {
    const ring: Ring = [
      { x: 0, y: 0 },
      { x: 30, y: 0 },
      { x: 30, y: 40.125 },
      { x: -12.5, y: 40.125 },
    ];

    expect(fromClipperPath(toClipperPath(ring))).toEqual(ring);
  });

  it('keeps the deviation of arbitrary coordinates below half a millimetre', () => {
    const ring: Ring = [
      { x: 4.628371, y: 2.913846 },
      { x: -17.000499, y: 59.9999 },
    ];

    const restored = fromClipperPath(toClipperPath(ring));

    restored.forEach((point, index) => {
      expect(Math.abs(point.x - ring[index].x)).toBeLessThanOrEqual(0.5 / SCALE_UNITS_PER_METER);
      expect(Math.abs(point.y - ring[index].y)).toBeLessThanOrEqual(0.5 / SCALE_UNITS_PER_METER);
    });
  });
});

describe('integer range on a large plot', () => {
  it('keeps a 200 m plot far inside the safe integer range', () => {
    const path = toClipperPath([
      { x: 0, y: 0 },
      { x: PLOT_SIDE_METERS, y: 0 },
      { x: PLOT_SIDE_METERS, y: PLOT_SIDE_METERS },
      { x: 0, y: PLOT_SIDE_METERS },
    ]);

    for (const point of path) {
      expect(Number.isSafeInteger(point.x)).toBe(true);
      expect(Number.isSafeInteger(point.y)).toBe(true);
    }

    const expectedUnits = PLOT_SIDE_METERS * SCALE_UNITS_PER_METER;

    expect(area(path)).toBe(expectedUnits * expectedUnits);
    expect(Number.isSafeInteger(area(path))).toBe(true);
  });
});

describe('toClipperUnits', () => {
  it('scales a length to whole millimetres', () => {
    expect(toClipperUnits(3)).toBe(3000);
    expect(toClipperUnits(-2.5)).toBe(-2500);
    expect(toClipperUnits(0.0004)).toBe(0);
  });
});
