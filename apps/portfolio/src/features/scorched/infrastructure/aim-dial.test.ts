import { describe, expect, it } from 'vitest';

import type { AimState } from '../domain/types';
import { fromDialDegrees, toDialDegrees, turnDial } from './aim-dial';

describe('aim dial', () => {
  it('maps a right-facing elevation onto the lower half of the dial', () => {
    expect(toDialDegrees({ facing: 'right', elevationDegrees: 0 })).toBe(0);
    expect(toDialDegrees({ facing: 'right', elevationDegrees: 45 })).toBe(45);
    expect(toDialDegrees({ facing: 'right', elevationDegrees: 90 })).toBe(90);
  });

  it('maps a left-facing elevation onto the upper half of the dial', () => {
    expect(toDialDegrees({ facing: 'left', elevationDegrees: 90 })).toBe(90);
    expect(toDialDegrees({ facing: 'left', elevationDegrees: 45 })).toBe(135);
    expect(toDialDegrees({ facing: 'left', elevationDegrees: 0 })).toBe(180);
  });

  it('round-trips every dial position back to itself', () => {
    for (let dial = 0; dial <= 180; dial += 15) {
      expect(toDialDegrees(fromDialDegrees(dial))).toBe(dial);
    }
  });

  it('flips the turret to the other side when the dial passes straight up', () => {
    const aim: AimState = { facing: 'right', elevationDegrees: 89, power: 500 };

    expect(turnDial(aim, 2)).toEqual({ facing: 'left', elevationDegrees: 89, power: 500 });
  });

  it('stops at the horizontal instead of wrapping around', () => {
    const leftmost: AimState = { facing: 'left', elevationDegrees: 0, power: 300 };
    const rightmost: AimState = { facing: 'right', elevationDegrees: 0, power: 300 };

    expect(turnDial(leftmost, 10)).toEqual(leftmost);
    expect(turnDial(rightmost, -10)).toEqual(rightmost);
  });

  it('keeps the power untouched while the barrel turns', () => {
    expect(turnDial({ facing: 'right', elevationDegrees: 30, power: 777 }, 5).power).toBe(777);
  });
});
