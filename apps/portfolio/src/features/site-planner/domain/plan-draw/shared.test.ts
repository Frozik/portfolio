import { describe, expect, it } from 'vitest';

import { chooseNiceStepAtLeast, chooseNiceStepAtMost, formatMeters } from './shared';

describe('chooseNiceStepAtLeast', () => {
  it('rounds up to the next 1 / 2 / 5 step', () => {
    expect(chooseNiceStepAtLeast(0.7)).toBe(1);
    expect(chooseNiceStepAtLeast(1)).toBe(1);
    expect(chooseNiceStepAtLeast(1.2)).toBe(2);
    expect(chooseNiceStepAtLeast(3)).toBe(5);
    expect(chooseNiceStepAtLeast(6)).toBe(10);
    expect(chooseNiceStepAtLeast(120)).toBe(200);
  });

  it('keeps sub-metre steps round', () => {
    expect(chooseNiceStepAtLeast(0.06)).toBeCloseTo(0.1, 12);
    expect(chooseNiceStepAtLeast(0.3)).toBeCloseTo(0.5, 12);
  });

  it('falls back to one metre for a step that is not a usable size', () => {
    expect(chooseNiceStepAtLeast(0)).toBe(1);
    expect(chooseNiceStepAtLeast(-4)).toBe(1);
    expect(chooseNiceStepAtLeast(Number.POSITIVE_INFINITY)).toBe(1);
  });
});

describe('chooseNiceStepAtMost', () => {
  it('rounds down to the previous 1 / 2 / 5 step', () => {
    expect(chooseNiceStepAtMost(140)).toBe(100);
    expect(chooseNiceStepAtMost(9.9)).toBe(5);
    expect(chooseNiceStepAtMost(10)).toBe(10);
    expect(chooseNiceStepAtMost(2)).toBe(2);
    expect(chooseNiceStepAtMost(1.9)).toBe(1);
  });

  it('keeps a sub-metre span round instead of collapsing it', () => {
    expect(chooseNiceStepAtMost(0.7)).toBeCloseTo(0.5, 12);
    expect(chooseNiceStepAtMost(0.15)).toBeCloseTo(0.1, 12);
  });

  it('falls back to one metre for a span that is not a usable size', () => {
    expect(chooseNiceStepAtMost(0)).toBe(1);
    expect(chooseNiceStepAtMost(Number.NaN)).toBe(1);
  });
});

describe('formatMeters', () => {
  it('renders two decimals and the given unit by default', () => {
    expect(formatMeters(12.5, 'm')).toBe('12.50 m');
  });

  it('honours an explicit precision', () => {
    expect(formatMeters(10, 'm', 0)).toBe('10 m');
    expect(formatMeters(0.5, 'm', 1)).toBe('0.5 m');
  });
});
