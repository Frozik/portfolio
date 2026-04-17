import { describe, expect, it } from 'vitest';
import {
  deduplicateParameters,
  isDuplicateParameter,
  isInAnyInterval,
  isRangeInAnyInterval,
  mergeIntervals,
} from './parametric-utils';

describe('isInAnyInterval', () => {
  const intervals = [
    { start: 0.2, end: 0.4 },
    { start: 0.6, end: 0.8 },
  ];

  it('returns true for parameter inside an interval', () => {
    expect(isInAnyInterval(0.3, intervals)).toBe(true);
    expect(isInAnyInterval(0.7, intervals)).toBe(true);
  });

  it('returns false for parameter outside all intervals', () => {
    expect(isInAnyInterval(0.1, intervals)).toBe(false);
    expect(isInAnyInterval(0.5, intervals)).toBe(false);
    expect(isInAnyInterval(0.9, intervals)).toBe(false);
  });

  it('returns false for parameter at interval boundary', () => {
    expect(isInAnyInterval(0.2, intervals)).toBe(false);
    expect(isInAnyInterval(0.4, intervals)).toBe(false);
  });

  it('returns false for empty intervals', () => {
    expect(isInAnyInterval(0.5, [])).toBe(false);
  });
});

describe('isRangeInAnyInterval', () => {
  const intervals = [
    { start: 0.2, end: 0.4 },
    { start: 0.6, end: 0.8 },
  ];

  it('returns true when range is entirely inside one interval', () => {
    expect(isRangeInAnyInterval(0.25, 0.35, intervals)).toBe(true);
  });

  it('returns false when range spans across two intervals', () => {
    expect(isRangeInAnyInterval(0.3, 0.7, intervals)).toBe(false);
  });

  it('returns false when range is outside all intervals', () => {
    expect(isRangeInAnyInterval(0.0, 0.1, intervals)).toBe(false);
  });

  it('returns true when range matches interval boundaries', () => {
    expect(isRangeInAnyInterval(0.2, 0.4, intervals)).toBe(true);
  });

  it('returns false when range partially overlaps an interval', () => {
    expect(isRangeInAnyInterval(0.1, 0.3, intervals)).toBe(false);
  });
});

describe('isDuplicateParameter', () => {
  it('returns true for exact duplicate', () => {
    expect(isDuplicateParameter(0.5, [0.1, 0.5, 0.9])).toBe(true);
  });

  it('returns true for near-duplicate within epsilon', () => {
    expect(isDuplicateParameter(0.5000001, [0.5])).toBe(true);
  });

  it('returns false for distant values', () => {
    expect(isDuplicateParameter(0.5, [0.1, 0.9])).toBe(false);
  });

  it('returns false for empty array', () => {
    expect(isDuplicateParameter(0.5, [])).toBe(false);
  });
});

describe('deduplicateParameters', () => {
  it('removes near-duplicate consecutive values', () => {
    const result = deduplicateParameters([0.1, 0.1000001, 0.5, 0.9]);
    expect(result).toHaveLength(3);
    expect(result[0]).toBeCloseTo(0.1);
    expect(result[1]).toBeCloseTo(0.5);
    expect(result[2]).toBeCloseTo(0.9);
  });

  it('keeps distinct values', () => {
    const result = deduplicateParameters([0.1, 0.5, 0.9]);
    expect(result).toHaveLength(3);
  });

  it('handles empty input', () => {
    expect(deduplicateParameters([])).toHaveLength(0);
  });

  it('handles single value', () => {
    expect(deduplicateParameters([0.5])).toEqual([0.5]);
  });
});

describe('mergeIntervals', () => {
  it('merges overlapping intervals', () => {
    const result = mergeIntervals([
      { start: 0.1, end: 0.4 },
      { start: 0.3, end: 0.6 },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].start).toBeCloseTo(0.1);
    expect(result[0].end).toBeCloseTo(0.6);
  });

  it('merges adjacent intervals within epsilon', () => {
    const result = mergeIntervals([
      { start: 0.1, end: 0.3 },
      { start: 0.3000001, end: 0.5 },
    ]);
    expect(result).toHaveLength(1);
  });

  it('keeps non-overlapping intervals separate', () => {
    const result = mergeIntervals([
      { start: 0.1, end: 0.2 },
      { start: 0.4, end: 0.5 },
    ]);
    expect(result).toHaveLength(2);
  });

  it('handles unsorted input', () => {
    const result = mergeIntervals([
      { start: 0.4, end: 0.6 },
      { start: 0.1, end: 0.3 },
    ]);
    expect(result).toHaveLength(2);
    expect(result[0].start).toBeCloseTo(0.1);
    expect(result[1].start).toBeCloseTo(0.4);
  });

  it('returns empty for empty input', () => {
    expect(mergeIntervals([])).toHaveLength(0);
  });

  it('handles single interval', () => {
    const result = mergeIntervals([{ start: 0.1, end: 0.5 }]);
    expect(result).toHaveLength(1);
  });
});
