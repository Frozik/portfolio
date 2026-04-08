import { packColor, unpackColor } from './color-packing';

const TOLERANCE = 1 / 255;

function expectColorsClose(
  actual: { r: number; g: number; b: number; a: number },
  expected: { r: number; g: number; b: number; a: number }
): void {
  expect(actual.r).toBeCloseTo(expected.r, 2);
  expect(actual.g).toBeCloseTo(expected.g, 2);
  expect(actual.b).toBeCloseTo(expected.b, 2);
  expect(actual.a).toBeCloseTo(expected.a, 2);
}

describe('packColor', () => {
  it('returns a finite number', () => {
    const packed = packColor(1, 0, 0, 1);
    expect(Number.isFinite(packed)).toBe(true);
  });

  it('returns different values for different colors', () => {
    const red = packColor(1, 0, 0, 1);
    const green = packColor(0, 1, 0, 1);
    const blue = packColor(0, 0, 1, 1);
    expect(red).not.toBe(green);
    expect(red).not.toBe(blue);
    expect(green).not.toBe(blue);
  });

  it('never produces NaN', () => {
    // Test many combinations including those that could trigger NaN
    const values = [0, 0.25, 0.5, 0.75, 1];
    for (const r of values) {
      for (const g of values) {
        for (const b of values) {
          for (const a of values) {
            const packed = packColor(r, g, b, a);
            expect(Number.isNaN(packed)).toBe(false);
          }
        }
      }
    }
  });
});

describe('unpackColor', () => {
  it('unpacks a known bit pattern with all zero channels', () => {
    // Pack all zeros and unpack
    const packed = packColor(0, 0, 0, 0);
    const color = unpackColor(packed);
    expectColorsClose(color, { r: 0, g: 0, b: 0, a: 0 });
  });

  it('returns all channels in 0..1 range', () => {
    const packed = packColor(0.5, 0.3, 0.7, 0.9);
    const color = unpackColor(packed);
    expect(color.r).toBeGreaterThanOrEqual(0);
    expect(color.r).toBeLessThanOrEqual(1);
    expect(color.g).toBeGreaterThanOrEqual(0);
    expect(color.g).toBeLessThanOrEqual(1);
    expect(color.b).toBeGreaterThanOrEqual(0);
    expect(color.b).toBeLessThanOrEqual(1);
    expect(color.a).toBeGreaterThanOrEqual(0);
    expect(color.a).toBeLessThanOrEqual(1);
  });
});

describe('packColor -> unpackColor round-trip', () => {
  it('round-trips black (0, 0, 0, 1)', () => {
    const color = unpackColor(packColor(0, 0, 0, 1));
    expectColorsClose(color, { r: 0, g: 0, b: 0, a: 1 });
  });

  it('round-trips white (1, 1, 1, 1) with blue capped', () => {
    const color = unpackColor(packColor(1, 1, 1, 1));
    expectColorsClose(color, { r: 1, g: 1, b: 0x7e / 255, a: 1 });
  });

  it('round-trips pure red (1, 0, 0, 1)', () => {
    const color = unpackColor(packColor(1, 0, 0, 1));
    expectColorsClose(color, { r: 1, g: 0, b: 0, a: 1 });
  });

  it('round-trips pure green (0, 1, 0, 1)', () => {
    const color = unpackColor(packColor(0, 1, 0, 1));
    expectColorsClose(color, { r: 0, g: 1, b: 0, a: 1 });
  });

  it('round-trips pure blue (0, 0, 1, 1) with blue capped', () => {
    const color = unpackColor(packColor(0, 0, 1, 1));
    // Blue 0xFF is capped at 0x7E
    expectColorsClose(color, { r: 0, g: 0, b: 0x7e / 255, a: 1 });
  });

  it('round-trips alpha=0 (fully transparent)', () => {
    const color = unpackColor(packColor(0.5, 0.5, 0.1, 0));
    expectColorsClose(color, { r: 0.5, g: 0.5, b: 0.1, a: 0 });
  });

  it('round-trips mid-range values within tolerance', () => {
    const r = 0.3;
    const g = 0.6;
    const b = 0.2;
    const a = 0.8;
    const color = unpackColor(packColor(r, g, b, a));
    expect(Math.abs(color.r - r)).toBeLessThanOrEqual(TOLERANCE);
    expect(Math.abs(color.g - g)).toBeLessThanOrEqual(TOLERANCE);
    expect(Math.abs(color.b - b)).toBeLessThanOrEqual(TOLERANCE);
    expect(Math.abs(color.a - a)).toBeLessThanOrEqual(TOLERANCE);
  });

  it('round-trips various arbitrary colors within tolerance', () => {
    const testCases = [
      { r: 0.1, g: 0.2, b: 0.3, a: 0.4 },
      { r: 0.9, g: 0.8, b: 0.1, a: 0.5 },
      { r: 0.0, g: 0.0, b: 0.0, a: 0.0 },
      { r: 1.0, g: 0.0, b: 0.0, a: 0.0 },
      { r: 0.0, g: 1.0, b: 0.0, a: 0.0 },
      { r: 0.5, g: 0.5, b: 0.5, a: 0.5 },
      { r: 0.123, g: 0.456, b: 0.012, a: 0.999 },
    ];

    for (const tc of testCases) {
      const color = unpackColor(packColor(tc.r, tc.g, tc.b, tc.a));
      expect(Math.abs(color.r - tc.r)).toBeLessThanOrEqual(TOLERANCE);
      expect(Math.abs(color.g - tc.g)).toBeLessThanOrEqual(TOLERANCE);
      // Blue may be capped, so only check if original <= 0x7E/255
      if (tc.b <= 0x7e / 255) {
        expect(Math.abs(color.b - tc.b)).toBeLessThanOrEqual(TOLERANCE);
      }
      expect(Math.abs(color.a - tc.a)).toBeLessThanOrEqual(TOLERANCE);
    }
  });
});

describe('blue capping at 0x7E (NaN avoidance)', () => {
  it('caps blue=1.0 (0xFF) to 0x7E/255', () => {
    const color = unpackColor(packColor(0, 0, 1, 1));
    expect(color.b).toBeCloseTo(0x7e / 255, 5);
  });

  it('caps blue=0.5 (0x80) to 0x7E/255', () => {
    // 0.5 * 255 = 127.5, rounds to 128 = 0x80, which exceeds 0x7E
    const color = unpackColor(packColor(0, 0, 0.5, 1));
    expect(color.b).toBeCloseTo(0x7e / 255, 5);
  });

  it('does not cap blue below threshold (0x7E/255)', () => {
    const blueBelow = 0x7e / 255; // exactly at threshold
    const color = unpackColor(packColor(0, 0, blueBelow, 1));
    expect(color.b).toBeCloseTo(blueBelow, 5);
  });

  it('does not cap blue well below threshold', () => {
    const blueLow = 0.1; // 0.1 * 255 = 25.5 -> 26, well below 0x7E
    const color = unpackColor(packColor(0, 0, blueLow, 1));
    expect(Math.abs(color.b - blueLow)).toBeLessThanOrEqual(TOLERANCE);
  });

  it('packed result is never NaN even with maximum channel values', () => {
    const packed = packColor(1, 1, 1, 1);
    expect(Number.isNaN(packed)).toBe(false);
    expect(Number.isFinite(packed)).toBe(true);
  });

  it('packed result is never NaN with sign bit set (high blue + alpha combos)', () => {
    // Blue in high byte, alpha in low byte - various combinations
    const combos = [
      [0, 0, 1, 0],
      [0, 0, 1, 0.5],
      [0, 0, 1, 1],
      [1, 1, 1, 0],
      [1, 1, 1, 1],
      [0.5, 0.5, 0.9, 0.5],
    ] as const;

    for (const [r, g, b, a] of combos) {
      const packed = packColor(r, g, b, a);
      expect(Number.isNaN(packed)).toBe(false);
    }
  });
});

describe('edge cases', () => {
  it('handles all zeros', () => {
    const packed = packColor(0, 0, 0, 0);
    expect(packed).toBe(0);
    const color = unpackColor(packed);
    expect(color.r).toBe(0);
    expect(color.g).toBe(0);
    expect(color.b).toBe(0);
    expect(color.a).toBe(0);
  });

  it('handles all ones (with blue cap)', () => {
    const packed = packColor(1, 1, 1, 1);
    expect(Number.isNaN(packed)).toBe(false);
    const color = unpackColor(packed);
    expect(color.r).toBe(1);
    expect(color.g).toBe(1);
    expect(color.b).toBeCloseTo(0x7e / 255, 5);
    expect(color.a).toBe(1);
  });

  it('handles values at exact byte boundaries (n/255)', () => {
    for (let i = 0; i <= 126; i++) {
      const val = i / 255;
      const color = unpackColor(packColor(val, 0, 0, 1));
      expect(color.r).toBeCloseTo(val, 5);
    }
  });

  it('consistently produces the same packed value for identical inputs', () => {
    const a = packColor(0.3, 0.6, 0.1, 0.9);
    const b = packColor(0.3, 0.6, 0.1, 0.9);
    expect(a).toBe(b);
  });

  it('unpack(0) returns all zeros', () => {
    const color = unpackColor(0);
    expect(color.r).toBe(0);
    expect(color.g).toBe(0);
    expect(color.b).toBe(0);
    expect(color.a).toBe(0);
  });
});
