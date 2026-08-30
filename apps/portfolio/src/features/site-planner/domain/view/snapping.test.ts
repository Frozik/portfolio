import { describe, expect, it } from 'vitest';

import { rotationStepDegrees, snapLength, snapPoint } from './snapping';

describe('snapLength', () => {
  it('rounds to the nearest multiple of the step', () => {
    expect(snapLength(12.34, 0.5)).toBe(12.5);
    expect(snapLength(12.24, 0.5)).toBe(12);
    expect(snapLength(-3.3, 0.5)).toBe(-3.5);
  });

  it('keeps the result free of binary-float dust', () => {
    expect(snapLength(0.29, 0.1)).toBe(0.3);
    expect(snapLength(2.9999, 0.1)).toBe(3);
  });

  it('passes the value through when the step is not a usable size', () => {
    expect(snapLength(12.34, 0)).toBe(12.34);
    expect(snapLength(12.34, -1)).toBe(12.34);
    expect(snapLength(12.34, Number.POSITIVE_INFINITY)).toBe(12.34);
    expect(snapLength(12.34, Number.NaN)).toBe(12.34);
  });

  it('leaves a value already on the grid untouched', () => {
    expect(snapLength(7.5, 0.5)).toBe(7.5);
  });
});

describe('rotationStepDegrees', () => {
  it('turns by a degree at a time by default', () => {
    expect(rotationStepDegrees({ isAltPressed: false, isShiftPressed: false })).toBe(1);
  });

  it('coarsens the step to a sixteenth of a turn while Shift is held', () => {
    expect(rotationStepDegrees({ isAltPressed: false, isShiftPressed: true })).toBe(15);
  });

  it('lets Alt clear the constraint, whatever else is held', () => {
    expect(rotationStepDegrees({ isAltPressed: true, isShiftPressed: false })).toBe(0);
    expect(rotationStepDegrees({ isAltPressed: true, isShiftPressed: true })).toBe(0);
  });
});

describe('snapPoint', () => {
  it('snaps both axes to the grid', () => {
    expect(snapPoint({ x: 12.34, y: -5.67 }, 0.5)).toEqual({ x: 12.5, y: -5.5 });
  });

  it('passes the point through when the step is not a usable size', () => {
    expect(snapPoint({ x: 12.34, y: -5.67 }, 0)).toEqual({ x: 12.34, y: -5.67 });
  });
});
