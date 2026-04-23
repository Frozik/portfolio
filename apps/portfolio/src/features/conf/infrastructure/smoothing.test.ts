import { describe, expect, it } from 'vitest';
import type { IGlassesTransform } from '../domain';
import { DEFAULT_SMOOTHING_ALPHA, smoothGlassesTransform } from './smoothing';

const FLOAT_TOLERANCE = 1e-9;

function makeTransform(fill: number): IGlassesTransform {
  return {
    translateX: fill,
    translateY: fill,
    rotateDeg: fill,
    scaleX: fill,
    scaleY: fill,
  };
}

describe('smoothGlassesTransform', () => {
  it('returns `next` verbatim when there is no previous sample', () => {
    const next = makeTransform(10);
    expect(smoothGlassesTransform(null, next, DEFAULT_SMOOTHING_ALPHA)).toBe(next);
  });

  it('returns `next` verbatim when alpha is 1', () => {
    const previous = makeTransform(0);
    const next = makeTransform(10);
    const result = smoothGlassesTransform(previous, next, 1);
    expect(result.translateX).toBeCloseTo(10, 12);
    expect(result.scaleX).toBeCloseTo(10, 12);
  });

  it('returns `previous` verbatim when alpha is 0', () => {
    const previous = makeTransform(5);
    const next = makeTransform(10);
    const result = smoothGlassesTransform(previous, next, 0);
    expect(result.translateX).toBeCloseTo(5, 12);
    expect(result.rotateDeg).toBeCloseTo(5, 12);
  });

  it('lerps every numeric field independently', () => {
    const previous: IGlassesTransform = {
      translateX: 0,
      translateY: 10,
      rotateDeg: 30,
      scaleX: 1,
      scaleY: 2,
    };
    const next: IGlassesTransform = {
      translateX: 100,
      translateY: 20,
      rotateDeg: -30,
      scaleX: 3,
      scaleY: 4,
    };
    const alpha = 0.25;
    const result = smoothGlassesTransform(previous, next, alpha);

    expect(Math.abs(result.translateX - 25)).toBeLessThan(FLOAT_TOLERANCE);
    expect(Math.abs(result.translateY - 12.5)).toBeLessThan(FLOAT_TOLERANCE);
    expect(Math.abs(result.rotateDeg - 15)).toBeLessThan(FLOAT_TOLERANCE);
    expect(Math.abs(result.scaleX - 1.5)).toBeLessThan(FLOAT_TOLERANCE);
    expect(Math.abs(result.scaleY - 2.5)).toBeLessThan(FLOAT_TOLERANCE);
  });
});
