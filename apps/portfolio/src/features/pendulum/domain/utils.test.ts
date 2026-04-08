import { zNormalization } from './utils';

describe('zNormalization', () => {
  it('normalizes a value within range', () => {
    expect(zNormalization(5, 10)).toBe(0.5);
  });

  it('returns 1 when value equals positive deviation', () => {
    expect(zNormalization(10, 10)).toBe(1);
  });

  it('returns -1 when value equals negative deviation', () => {
    expect(zNormalization(-10, 10)).toBe(-1);
  });

  it('clamps value exceeding positive deviation to 1', () => {
    expect(zNormalization(20, 10)).toBe(1);
  });

  it('clamps value exceeding negative deviation to -1', () => {
    expect(zNormalization(-20, 10)).toBe(-1);
  });

  it('returns 0 for value of 0', () => {
    expect(zNormalization(0, 10)).toBe(0);
  });

  it('normalizes negative values within range', () => {
    expect(zNormalization(-3, 6)).toBe(-0.5);
  });

  it('normalizes symmetrically for positive and negative values', () => {
    const positive = zNormalization(7, 10);
    const negative = zNormalization(-7, 10);

    expect(positive).toBe(0.7);
    expect(negative).toBe(-0.7);
    expect(positive).toBe(-negative);
  });

  it('returns NaN when deviation is 0', () => {
    expect(zNormalization(5, 0)).toBeNaN();
  });

  it('returns NaN when both value and deviation are 0', () => {
    expect(zNormalization(0, 0)).toBeNaN();
  });

  it('handles very small deviation values', () => {
    expect(zNormalization(0.005, 0.01)).toBe(0.5);
  });

  it('handles very large values', () => {
    expect(zNormalization(1e10, 1e10)).toBe(1);
  });
});
