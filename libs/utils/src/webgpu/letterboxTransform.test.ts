import { describe, expect, it } from 'vitest';

import { computeLetterboxTransform } from './letterboxTransform';

const FIELD_WIDTH_WU = 800;
const FIELD_HEIGHT_WU = 500;

describe('computeLetterboxTransform', () => {
  it('scales by the tighter axis and centers the field on the other one', () => {
    const transform = computeLetterboxTransform({
      canvasWidthPx: 1600,
      canvasHeightPx: 700,
      fieldWidthWu: FIELD_WIDTH_WU,
      fieldHeightWu: FIELD_HEIGHT_WU,
    });

    expect(transform.scale).toBeCloseTo(1.4);
    expect(transform.originX).toBeCloseTo((1600 - FIELD_WIDTH_WU * 1.4) / 2);
    expect(transform.originY).toBe(0);
  });

  it('keeps the scale fractional by default', () => {
    const transform = computeLetterboxTransform({
      canvasWidthPx: 1000,
      canvasHeightPx: 1000,
      fieldWidthWu: FIELD_WIDTH_WU,
      fieldHeightWu: FIELD_HEIGHT_WU,
    });

    expect(transform.scale).toBeCloseTo(1.25);
  });

  it('snaps the scale and the origin to whole pixels when asked', () => {
    const transform = computeLetterboxTransform({
      canvasWidthPx: 1001,
      canvasHeightPx: 1000,
      fieldWidthWu: FIELD_WIDTH_WU,
      fieldHeightWu: FIELD_HEIGHT_WU,
      snapToWholePixels: true,
    });

    expect(transform.scale).toBe(1);
    expect(transform.originX).toBe(Math.round((1001 - FIELD_WIDTH_WU) / 2));
    expect(transform.originY).toBe((1000 - FIELD_HEIGHT_WU) / 2);
  });

  it('falls back to a fractional scale on canvases smaller than the field', () => {
    const transform = computeLetterboxTransform({
      canvasWidthPx: 400,
      canvasHeightPx: 250,
      fieldWidthWu: FIELD_WIDTH_WU,
      fieldHeightWu: FIELD_HEIGHT_WU,
      snapToWholePixels: true,
    });

    expect(transform.scale).toBeCloseTo(0.5);
    expect(transform.originX).toBe(0);
  });
});
