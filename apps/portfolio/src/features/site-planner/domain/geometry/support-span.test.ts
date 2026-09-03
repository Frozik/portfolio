import { describe, expect, it } from 'vitest';

import { createSupport } from '../model/supports';
import type { MultiPolygon } from './polygon-types';
import { supportSpan } from './support-span';

/** A 10×10 storey footprint with its corner at the origin. */
const FOOTPRINT: MultiPolygon = [
  {
    outer: [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ],
    holes: [],
  },
];

/** A plot falling one metre eastward — the slope every canopy has to cope with. */
const slopingGround = (point: { readonly x: number }) => 100 - point.x * 0.1;

describe('supportSpan', () => {
  it('stands a post inside the footprint on the floor', () => {
    const span = supportSpan({
      post: createSupport({ position: { x: 5, y: 5 } }),
      storeyFootprint: FOOTPRINT,
      floorElevation: 100.5,
      ceilingElevation: 103.2,
      groundElevationAt: slopingGround,
    });

    expect(span.baseElevation).toBe(100.5);
    expect(span.topElevation).toBe(103.2);
  });

  it('stands a post beyond the footprint on the ground under it', () => {
    const span = supportSpan({
      post: createSupport({ position: { x: 14, y: 5 } }),
      storeyFootprint: FOOTPRINT,
      floorElevation: 100.5,
      ceilingElevation: 103.2,
      groundElevationAt: slopingGround,
    });

    expect(span.baseElevation).toBeCloseTo(98.6);
  });

  it('keeps one ceiling datum so a plate over a slope stays horizontal', () => {
    const uphill = supportSpan({
      post: createSupport({ position: { x: 12, y: 2 } }),
      storeyFootprint: FOOTPRINT,
      floorElevation: 100.5,
      ceilingElevation: 103.2,
      groundElevationAt: slopingGround,
    });
    const downhill = supportSpan({
      post: createSupport({ position: { x: 18, y: 2 } }),
      storeyFootprint: FOOTPRINT,
      floorElevation: 100.5,
      ceilingElevation: 103.2,
      groundElevationAt: slopingGround,
    });

    expect(uphill.topElevation).toBe(downhill.topElevation);
    // The downhill post is the longer one — exactly the slope's drop.
    expect(downhill.topElevation - downhill.baseElevation).toBeGreaterThan(
      uphill.topElevation - uphill.baseElevation
    );
    expect(
      downhill.topElevation - downhill.baseElevation - (uphill.topElevation - uphill.baseElevation)
    ).toBeCloseTo(0.6);
  });
});
