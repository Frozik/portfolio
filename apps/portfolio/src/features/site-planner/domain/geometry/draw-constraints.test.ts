import { describe, expect, it } from 'vitest';

import { applyTypedLength, constrainToAngleStep, segmentReadout } from './draw-constraints';

const ORIGIN = { x: 0, y: 0 };

describe('segmentReadout', () => {
  it('measures a segment east as zero degrees', () => {
    const readout = segmentReadout(ORIGIN, { x: 4.2, y: 0 });

    expect(readout.lengthMeters).toBeCloseTo(4.2);
    expect(readout.angleDegrees).toBeCloseTo(0);
  });

  it('measures north as ninety degrees — plan y runs north', () => {
    expect(segmentReadout(ORIGIN, { x: 0, y: 3 }).angleDegrees).toBeCloseTo(90);
  });

  it('reports a south-west segment in the 0…360 range, never negative', () => {
    const readout = segmentReadout(ORIGIN, { x: -1, y: -1 });

    expect(readout.angleDegrees).toBeCloseTo(225);
    expect(readout.lengthMeters).toBeCloseTo(Math.SQRT2);
  });
});

describe('constrainToAngleStep', () => {
  it('squares a nearly horizontal drag onto the axis, keeping its length', () => {
    const constrained = constrainToAngleStep(ORIGIN, { x: 4, y: 0.3 });

    expect(constrained.y).toBeCloseTo(0);
    expect(constrained.x).toBeCloseTo(Math.hypot(4, 0.3));
  });

  it('locks a nearly vertical drag onto ninety degrees', () => {
    const constrained = constrainToAngleStep(ORIGIN, { x: 0.2, y: 5 });

    expect(constrained.x).toBeCloseTo(0);
    expect(constrained.y).toBeCloseTo(Math.hypot(0.2, 5));
  });

  it('snaps to the 15° step a diagonal falls nearest', () => {
    const constrained = constrainToAngleStep(ORIGIN, { x: 1, y: 1.1 });

    expect(segmentReadout(ORIGIN, constrained).angleDegrees).toBeCloseTo(45);
  });

  it('leaves a zero-length segment alone', () => {
    expect(constrainToAngleStep(ORIGIN, ORIGIN)).toEqual(ORIGIN);
  });
});

describe('applyTypedLength', () => {
  it('pushes the corner to the typed distance along the aimed direction', () => {
    const exact = applyTypedLength(ORIGIN, { x: 3, y: 4 }, 10);

    expect(Math.hypot(exact.x, exact.y)).toBeCloseTo(10);
    // Direction preserved: 3-4-5 triangle scaled twice over.
    expect(exact.x).toBeCloseTo(6);
    expect(exact.y).toBeCloseTo(8);
  });

  it('builds an exact 4.20 m wall from a rough drag', () => {
    const exact = applyTypedLength(ORIGIN, { x: 4.37, y: 0 }, 4.2);

    expect(exact.x).toBeCloseTo(4.2);
  });

  it('ignores a length that cannot be applied', () => {
    expect(applyTypedLength(ORIGIN, ORIGIN, 5)).toEqual(ORIGIN);
    expect(applyTypedLength(ORIGIN, { x: 2, y: 0 }, 0)).toEqual({ x: 2, y: 0 });
  });
});
