import { describe, expect, it } from 'vitest';

import { computeViewTransform } from './view-transform';

const FIELD_SIZE_WU = 208;

describe('computeViewTransform', () => {
  it('picks the largest integer scale that fits', () => {
    const transform = computeViewTransform(1000, 700, FIELD_SIZE_WU, FIELD_SIZE_WU);

    expect(transform.scale).toBe(3);
  });

  it('centers the field with letterboxing', () => {
    const transform = computeViewTransform(1000, 700, FIELD_SIZE_WU, FIELD_SIZE_WU);
    const fieldSizePx = FIELD_SIZE_WU * transform.scale;

    expect(transform.originX).toBe((1000 - fieldSizePx) / 2);
    expect(transform.originY).toBe((700 - fieldSizePx) / 2);
  });

  it('honours per-stage field dimensions', () => {
    const transform = computeViewTransform(800, 800, FIELD_SIZE_WU, 112);

    expect(transform.scale).toBe(3);
    expect(transform.originY).toBe((800 - 112 * 3) / 2);
  });

  it('falls back to a fractional scale on canvases smaller than the field', () => {
    const transform = computeViewTransform(104, 104, FIELD_SIZE_WU, FIELD_SIZE_WU);

    expect(transform.scale).toBeCloseTo(0.5);
    expect(transform.originX).toBe(0);
  });
});
