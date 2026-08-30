import { describe, expect, it } from 'vitest';

import { northNeedleAngleDegrees, northOffsetTowards } from './north-offset';

describe('northNeedleAngleDegrees', () => {
  it('stands the needle straight up while the plan is drawn to true north', () => {
    expect(northNeedleAngleDegrees(0)).toBe(0);
  });

  it('swings the needle anticlockwise as the plan is turned east of true north', () => {
    // 270° clockwise from the top is straight to the left: a plot drawn a
    // quarter turn east of true north has geographic north to its west.
    expect(northNeedleAngleDegrees(90)).toBe(270);
    expect(northNeedleAngleDegrees(30)).toBe(330);
  });

  it('reads an offset written outside a single turn as its folded twin', () => {
    expect(northNeedleAngleDegrees(450)).toBe(270);
    expect(northNeedleAngleDegrees(-90)).toBe(90);
  });
});

describe('northOffsetTowards', () => {
  it('reads a needle dragged straight up as no offset at all', () => {
    expect(northOffsetTowards({ x: 0, y: -10 })).toBe(0);
  });

  it('reads a needle dragged to the left as a plan turned east of true north', () => {
    expect(northOffsetTowards({ x: -10, y: 0 })).toBeCloseTo(90);
  });

  it('reads a needle dragged to the right as a plan turned west of true north', () => {
    expect(northOffsetTowards({ x: 10, y: 0 })).toBeCloseTo(270);
  });

  it('ignores how far from the centre the pointer is', () => {
    expect(northOffsetTowards({ x: -3, y: -3 })).toBeCloseTo(45);
    expect(northOffsetTowards({ x: -300, y: -300 })).toBeCloseTo(45);
  });

  it('inverts the needle angle it was read from', () => {
    for (const northOffsetDegrees of [0, 17, 90, 213.5, 359]) {
      const needleAngle = northNeedleAngleDegrees(northOffsetDegrees);
      const radians = (needleAngle * Math.PI) / 180;

      expect(northOffsetTowards({ x: Math.sin(radians), y: -Math.cos(radians) })).toBeCloseTo(
        northOffsetDegrees
      );
    }
  });
});
