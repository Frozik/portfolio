import { describe, expect, test } from 'vitest';

import { hexToLinearRgb } from './color-utils';

describe('hexToLinearRgb', () => {
  test('pure red maps to channel 1 on the red axis only', () => {
    const linear = hexToLinearRgb('#FF0000');
    expect(linear.r).toBeCloseTo(1, 6);
    expect(linear.g).toBeCloseTo(0, 6);
    expect(linear.b).toBeCloseTo(0, 6);
  });

  test('short-form #000 expands to all-zero channels', () => {
    const linear = hexToLinearRgb('#000');
    expect(linear.r).toBe(0);
    expect(linear.g).toBe(0);
    expect(linear.b).toBe(0);
  });

  test('pure white maps to all-one channels', () => {
    const linear = hexToLinearRgb('#FFFFFF');
    expect(linear.r).toBeCloseTo(1, 6);
    expect(linear.g).toBeCloseTo(1, 6);
    expect(linear.b).toBeCloseTo(1, 6);
  });

  test('mid-gray follows the piecewise sRGB curve, not gamma-2.2', () => {
    const linear = hexToLinearRgb('#808080');
    // 0x80/255 ≈ 0.50196 → > 0.04045 cutoff → gamma branch:
    //   ((0.50196 + 0.055) / 1.055) ** 2.4 ≈ 0.2159
    // Importantly NOT 0.5 (which a gamma-1 / linear assumption would give)
    // and NOT 0.218 (which a `c**2.2` shortcut would give).
    expect(linear.r).toBeCloseTo(0.2159, 3);
    expect(linear.g).toBeCloseTo(0.2159, 3);
    expect(linear.b).toBeCloseTo(0.2159, 3);
    expect(linear.r).not.toBeCloseTo(0.5, 2);
  });

  test('short-form expands by repeating each digit (#abc → #aabbcc)', () => {
    const expanded = hexToLinearRgb('#aabbcc');
    const short = hexToLinearRgb('#abc');
    expect(short.r).toBeCloseTo(expanded.r, 8);
    expect(short.g).toBeCloseTo(expanded.g, 8);
    expect(short.b).toBeCloseTo(expanded.b, 8);
  });

  test('throws when the leading hash is missing', () => {
    expect(() => hexToLinearRgb('FF0000')).toThrow();
  });

  test('throws on non-hex characters', () => {
    expect(() => hexToLinearRgb('#XYZ')).toThrow();
    expect(() => hexToLinearRgb('#GG0000')).toThrow();
  });

  test('throws on disallowed lengths (4 hex chars)', () => {
    expect(() => hexToLinearRgb('#FF00')).toThrow();
  });

  test('throws on disallowed lengths (5 hex chars)', () => {
    expect(() => hexToLinearRgb('#FF000')).toThrow();
  });

  test('linear segment applies for very dark channels (≤ 0.04045)', () => {
    // 0x0A / 255 ≈ 0.03922 → ≤ 0.04045 → linear branch: 0.03922 / 12.92.
    const linear = hexToLinearRgb('#0A0A0A');
    expect(linear.r).toBeCloseTo(0.03922 / 12.92, 5);
  });
});
