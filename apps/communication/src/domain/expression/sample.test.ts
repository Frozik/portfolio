import { assert } from '@frozik/utils/assert/assert';
import { describe, expect, it } from 'vitest';

import { parseExpression } from './parse';
import type { SampledCurve, SampleRange } from './sample';
import { sampleCurve, validateSampleRange } from './sample';

function curveOf(source: string, range: SampleRange): SampledCurve {
  const parsed = parseExpression(source, { maxLength: 200, maxDepth: 32 });
  assert(parsed.ok, source);
  return sampleCurve(parsed.value, range);
}

function gapsNear(curve: SampledCurve, at: number, tolerance: number): number {
  let count = 0;
  curve.x.forEach((x, index) => {
    if (Math.abs(x - at) <= tolerance && Number.isNaN(curve.y[index])) {
      count += 1;
    }
  });
  return count;
}

describe('curve sampling', () => {
  it('samples evenly from the first x to the last', () => {
    const curve = curveOf('x^2 + 2x + 3', { xMin: -1, xMax: 1, points: 5 });
    expect([...curve.x]).toEqual([-1, -0.5, 0, 0.5, 1]);
    expect([...curve.y]).toEqual([2, 2.25, 3, 4.25, 6]);
  });

  it('leaves a gap where the function is undefined', () => {
    const curve = curveOf('sqrt(x)', { xMin: -1, xMax: 1, points: 3 });
    expect(curve.y[0]).toBeNaN();
    expect(curve.y[2]).toBe(1);
  });

  it('breaks the line at an asymptote instead of drawing a vertical stroke across it', () => {
    const reciprocal = curveOf('1/x', { xMin: -10, xMax: 10, points: 1000 });
    expect(gapsNear(reciprocal, 0, 0.05)).toBeGreaterThan(0);
    expect(gapsNear(reciprocal, 5, 4)).toBe(0);

    const tangent = curveOf('tan(x)', { xMin: -3, xMax: 3, points: 2000 });
    expect(gapsNear(tangent, Math.PI / 2, 0.01)).toBeGreaterThan(0);
    expect(gapsNear(tangent, -Math.PI / 2, 0.01)).toBeGreaterThan(0);
  });

  it('keeps a steep but continuous curve whole', () => {
    const steep = curveOf('1000x', { xMin: -1, xMax: 1, points: 1001 });
    expect(steep.y.some(Number.isNaN)).toBe(false);
  });

  it('accepts only a forward range and a bounded number of points', () => {
    expect(validateSampleRange({ xMin: 1, xMax: 1, points: 10 }, 100)).toEqual({
      ok: false,
      error: 'invalid-range',
    });
    expect(validateSampleRange({ xMin: 0, xMax: 1, points: 1 }, 100)).toEqual({
      ok: false,
      error: 'too-few-points',
    });
    expect(validateSampleRange({ xMin: 0, xMax: 1, points: 101 }, 100)).toEqual({
      ok: false,
      error: 'too-many-points',
    });
    expect(validateSampleRange({ xMin: 0, xMax: 1, points: 100 }, 100).ok).toBe(true);
  });
});
