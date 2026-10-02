import { describe, expect, it } from 'vitest';

import { rgba } from '../core/series/color';
import type { TRun } from '../core/series/point-run';
import type { IStyle } from '../core/series/style-processor';
import { elementsPerSlot, encodeElements, splitPosition, splitValue } from './texel-encoding';

const PLAIN: IStyle = {
  marks: [],
  fill: { color: rgba(1, 0, 0), size: 2 },
  stroke: { color: rgba(0, 0, 1), size: 0.5 },
};

function floatOf(bits: number): number {
  return new Float32Array(new Uint32Array([bits]).buffer)[0];
}

function pointRun(x: bigint[], value: number[]): TRun<bigint, 'point'> {
  return {
    id: 1,
    revision: 0,
    step: undefined,
    shape: 'point',
    length: x.length,
    x: new BigInt64Array(x),
    value: new Float64Array(value),
  };
}

describe('texel encoding', () => {
  it('fits 128 points or 64 candles into a slot', () => {
    expect(elementsPerSlot('point')).toBe(128);
    expect(elementsPerSlot('candle')).toBe(64);
  });

  it('writes time as exact seconds and nanoseconds, however far from the epoch', () => {
    const texels = encodeElements(pointRun([1_759_363_200_123_456_789n], [1]), PLAIN, 0, 1);

    expect(texels[0]).toBe(1_759_363_200);
    expect(texels[1]).toBe(123_456_789);
  });

  it('writes a moment before the epoch so that its distance to any other stays exact', () => {
    const before = -1_500_000_000n;
    const after = 2_250_000_000n;
    const [beforeSeconds, beforeNanos] = splitPosition(before);
    const [afterSeconds, afterNanos] = splitPosition(after);

    // What the shader does: subtract the seconds in 32 wrapping bits, then the nanoseconds.
    const seconds = (afterSeconds - beforeSeconds) | 0;
    const nanos = afterNanos - beforeNanos;

    expect(beforeNanos).toBe(500_000_000);
    expect(BigInt(seconds) * 1_000_000_000n + BigInt(nanos)).toBe(after - before);
  });

  it('keeps distances exact past the year 2106, where the seconds no longer fit 32 bits', () => {
    const YEAR_2110 = 4_417_000_000n * 1_000_000_000n;
    const [start] = splitPosition(YEAR_2110);
    const [later] = splitPosition(YEAR_2110 + 3600n * 1_000_000_000n);

    expect((later - start) | 0).toBe(3600);
  });

  it('keeps a value to about fourteen digits in two float32 parts', () => {
    const value = 67123.456789;
    const texels = encodeElements(pointRun([0n], [value]), PLAIN, 0, 1);

    const high = floatOf(texels[2]);
    const low = floatOf(texels[3]);

    expect(high).toBe(Math.fround(value));
    expect(high + low).toBeCloseTo(value, 9);
    expect(Math.abs(high - value)).toBeGreaterThan(1e-4);
  });

  it('writes a gap as a NaN the shader can recognise by its bits', () => {
    const texels = encodeElements(pointRun([0n], [Number.NaN]), PLAIN, 0, 1);
    const EXPONENT = 0x7f800000;
    const MANTISSA = 0x007fffff;

    expect(texels[2] & EXPONENT).toBe(EXPONENT);
    expect(texels[2] & MANTISSA).not.toBe(0);
  });

  it('puts the fill and the stroke into the last texel of a point', () => {
    const texels = encodeElements(pointRun([0n], [1]), PLAIN, 0, 1);

    expect(floatOf(texels[4])).toBe(2);
    expect(texels[5]).toBe(rgba(1, 0, 0));
    expect(floatOf(texels[6])).toBe(0.5);
    expect(texels[7]).toBe(rgba(0, 0, 1));
  });

  it('takes a paint given per element from that element', () => {
    const style: IStyle = {
      ...PLAIN,
      fill: { color: new Uint32Array([10, 20, 30]), size: new Float32Array([1, 2, 3]) },
    };

    const texels = encodeElements(pointRun([0n, 1n, 2n], [0, 0, 0]), style, 1, 2);

    expect([floatOf(texels[4]), texels[5]]).toEqual([2, 20]);
    expect([floatOf(texels[12]), texels[13]]).toEqual([3, 30]);
  });

  it('lays a candle over four texels: open, close, low, high, then the paint', () => {
    const candle: TRun<bigint, 'candle'> = {
      id: 1,
      revision: 0,
      step: 60e9,
      shape: 'candle',
      length: 1,
      x: new BigInt64Array([60_000_000_000n]),
      open: new Float64Array([1]),
      min: new Float64Array([0.5]),
      max: new Float64Array([2]),
      close: new Float64Array([1.5]),
    };

    const texels = encodeElements(candle, PLAIN, 0, 1);

    expect(texels).toHaveLength(16);
    expect([texels[0], texels[1]]).toEqual([60, 0]);
    expect([2, 4, 6, 8].map(offset => floatOf(texels[offset]))).toEqual([1, 1.5, 0.5, 2]);
    expect(floatOf(texels[12])).toBe(2);
  });

  it('writes a numeric axis position in two float parts, like a value', () => {
    const run: TRun<number, 'point'> = {
      id: 1,
      revision: 0,
      step: undefined,
      shape: 'point',
      length: 1,
      x: new Float64Array([1234.56789]),
      value: new Float64Array([0]),
    };

    const texels = encodeElements(run, PLAIN, 0, 1);

    expect(floatOf(texels[0]) + floatOf(texels[1])).toBeCloseTo(1234.56789, 9);
  });

  it('splits a viewport bound into the same parts as an element', () => {
    expect(splitPosition(5_000_000_001n)).toEqual([5, 1]);
    const [high, low] = splitValue(67123.456789);
    expect(high + low).toBeCloseTo(67123.456789, 9);
  });
});
