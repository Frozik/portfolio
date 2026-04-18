import { packColor, unpackColor } from './colorPacking';

const CHANNEL_TOLERANCE = 1 / 255;
const BLUE_MAX_NORMALIZED = 0x7e / 255;

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
    expect(Number.isFinite(packColor(1, 0, 0, 1))).toBe(true);
  });

  it('returns different values for different colors', () => {
    const red = packColor(1, 0, 0, 1);
    const green = packColor(0, 1, 0, 1);
    const blue = packColor(0, 0, 1, 1);
    expect(red).not.toBe(green);
    expect(red).not.toBe(blue);
    expect(green).not.toBe(blue);
  });

  it('never produces NaN across the unit cube', () => {
    const samples = [0, 0.25, 0.5, 0.75, 1];
    for (const r of samples) {
      for (const g of samples) {
        for (const b of samples) {
          for (const a of samples) {
            expect(Number.isNaN(packColor(r, g, b, a))).toBe(false);
          }
        }
      }
    }
  });
});

describe('unpackColor', () => {
  it('round-trips primary colors within tolerance', () => {
    expectColorsClose(unpackColor(packColor(1, 0, 0, 1)), { r: 1, g: 0, b: 0, a: 1 });
    expectColorsClose(unpackColor(packColor(0, 1, 0, 1)), { r: 0, g: 1, b: 0, a: 1 });
    expectColorsClose(unpackColor(packColor(0.5, 0.5, 0.1, 0)), {
      r: 0.5,
      g: 0.5,
      b: 0.1,
      a: 0,
    });
  });

  it('caps blue at 0x7E to avoid NaN exponent', () => {
    const { b } = unpackColor(packColor(0, 0, 1, 1));
    expect(b).toBeCloseTo(BLUE_MAX_NORMALIZED, 5);
  });

  it('returns zero struct for a zero input', () => {
    expect(unpackColor(0)).toEqual({ r: 0, g: 0, b: 0, a: 0 });
  });

  it('matches packed value for repeated identical inputs', () => {
    expect(packColor(0.3, 0.6, 0.1, 0.9)).toBe(packColor(0.3, 0.6, 0.1, 0.9));
  });

  it('preserves non-blue channels at every byte boundary below the cap', () => {
    for (let byteValue = 0; byteValue <= BLUE_MAX_BYTE_LIMIT; byteValue++) {
      const normalized = byteValue / 255;
      const { r } = unpackColor(packColor(normalized, 0, 0, 1));
      expect(Math.abs(r - normalized)).toBeLessThanOrEqual(CHANNEL_TOLERANCE);
    }
  });
});

const BLUE_MAX_BYTE_LIMIT = 126;
