import { packColor } from '@frozik/utils/webgpu/colorPacking';

import { FLOATS_PER_POINT } from './constants';
import { encodePoints } from './delta-encoding';
import type { IDataPoint } from './types';

describe('encodePoints', () => {
  const BASE_TIME = 1000;
  const BASE_VALUE = 50;

  it('returns an empty Float32Array for an empty array', () => {
    const result = encodePoints([], BASE_TIME, BASE_VALUE);

    expect(result).toBeInstanceOf(Float32Array);
    expect(result.length).toBe(0);
  });

  it('encodes a single point with deltas relative to base', () => {
    const point: IDataPoint = {
      time: 1042,
      value: 53,
      size: 2.5,
      color: packColor(1.0, 0.0, 0.0, 1.0),
    };

    const result = encodePoints([point], BASE_TIME, BASE_VALUE);

    expect(result.length).toBe(FLOATS_PER_POINT);
    expect(result[0]).toBeCloseTo(42); // timeDelta = 1042 - 1000
    expect(result[1]).toBeCloseTo(3); // valueDelta = 53 - 50
    expect(result[2]).toBeCloseTo(2.5); // size preserved
  });

  it('encodes a single point at the base as zero deltas', () => {
    const point: IDataPoint = {
      time: BASE_TIME,
      value: BASE_VALUE,
      size: 1.0,
      color: packColor(0.5, 0.5, 0.5, 1.0),
    };

    const result = encodePoints([point], BASE_TIME, BASE_VALUE);

    expect(result[0]).toBe(0); // timeDelta = 0
    expect(result[1]).toBe(0); // valueDelta = 0
  });

  it('encodes multiple points with correct per-point deltas', () => {
    const points: IDataPoint[] = [
      { time: 1010, value: 55, size: 1.0, color: packColor(0.2, 0.6, 0.5, 1.0) },
      { time: 1020, value: 60, size: 2.0, color: packColor(0.4, 0.3, 0.7, 1.0) },
      { time: 1030, value: 45, size: 3.0, color: packColor(0.8, 0.1, 0.2, 1.0) },
    ];

    const result = encodePoints(points, BASE_TIME, BASE_VALUE);

    expect(result.length).toBe(points.length * FLOATS_PER_POINT);

    // Point 0
    expect(result[0]).toBeCloseTo(10); // 1010 - 1000
    expect(result[1]).toBeCloseTo(5); // 55 - 50
    expect(result[2]).toBeCloseTo(1.0);

    // Point 1
    expect(result[FLOATS_PER_POINT]).toBeCloseTo(20); // 1020 - 1000
    expect(result[FLOATS_PER_POINT + 1]).toBeCloseTo(10); // 60 - 50
    expect(result[FLOATS_PER_POINT + 2]).toBeCloseTo(2.0);

    // Point 2
    expect(result[2 * FLOATS_PER_POINT]).toBeCloseTo(30); // 1030 - 1000
    expect(result[2 * FLOATS_PER_POINT + 1]).toBeCloseTo(-5); // 45 - 50
    expect(result[2 * FLOATS_PER_POINT + 2]).toBeCloseTo(3.0);
  });

  it('preserves size field exactly', () => {
    const sizes = [0.001, 1.0, 5.5, 100.0];

    for (const size of sizes) {
      const point: IDataPoint = {
        time: BASE_TIME,
        value: BASE_VALUE,
        size,
        color: packColor(0.5, 0.5, 0.5, 1.0),
      };

      const result = encodePoints([point], BASE_TIME, BASE_VALUE);
      expect(result[2]).toBeCloseTo(size);
    }
  });

  it('preserves color bit pattern through Uint32Array view (no NaN canonicalization)', () => {
    const colors = [
      packColor(1.0, 0.0, 0.0, 1.0),
      packColor(0.0, 1.0, 0.0, 1.0),
      packColor(0.0, 0.0, 1.0, 1.0),
      packColor(0.2, 0.6, 0.8, 1.0),
      packColor(0.0, 0.0, 0.0, 1.0),
    ];

    for (const color of colors) {
      const point: IDataPoint = {
        time: BASE_TIME,
        value: BASE_VALUE,
        size: 1.0,
        color,
      };

      const result = encodePoints([point], BASE_TIME, BASE_VALUE);

      // Read the color channel through a Uint32Array view — this is the same
      // approach used in the shader to recover the packed RGBA bits.
      const u32 = new Uint32Array(result.buffer);
      const colorOffset = 3; // 4th float per point

      // Build expected uint32 from the original packed color float
      const expectedBuf = new ArrayBuffer(4);
      const expectedF32 = new Float32Array(expectedBuf);
      const expectedU32 = new Uint32Array(expectedBuf);
      expectedF32[0] = color;

      expect(u32[colorOffset]).toBe(expectedU32[0]);
    }
  });

  it('handles negative deltas correctly', () => {
    const point: IDataPoint = {
      time: 900, // below base
      value: 30, // below base
      size: 1.0,
      color: packColor(0.5, 0.5, 0.5, 1.0),
    };

    const result = encodePoints([point], BASE_TIME, BASE_VALUE);

    expect(result[0]).toBeCloseTo(-100); // 900 - 1000
    expect(result[1]).toBeCloseTo(-20); // 30 - 50
  });
});
