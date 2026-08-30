import { describe, expect, it } from 'vitest';

import { computeExportViewport, EXPORT_MARGIN_PX } from './export-viewport';
import { DEFAULT_PIXELS_PER_METER, MIN_PIXELS_PER_METER, screenToPlan } from './plan-viewport';

const NICE_MULTIPLIERS: readonly number[] = [1, 2, 5];

function isNiceScale(pixelsPerMeter: number): boolean {
  const decade = 10 ** Math.floor(Math.log10(pixelsPerMeter));

  return NICE_MULTIPLIERS.some(multiplier => multiplier * decade === pixelsPerMeter);
}

describe('computeExportViewport', () => {
  it('scales the quick-start plot to a round number of pixels per metre', () => {
    const viewport = computeExportViewport({ minX: 0, minY: 0, maxX: 30, maxY: 40 });

    expect(isNiceScale(viewport.pixelsPerMeter)).toBe(true);
    expect(viewport.widthPx).toBe(30 * viewport.pixelsPerMeter + 2 * EXPORT_MARGIN_PX);
    expect(viewport.heightPx).toBe(40 * viewport.pixelsPerMeter + 2 * EXPORT_MARGIN_PX);
  });

  it('centres the plot and leaves the margin free on every side', () => {
    const bounds = { minX: 10, minY: 20, maxX: 40, maxY: 60 };
    const viewport = computeExportViewport(bounds);

    const northWest = screenToPlan(viewport, { x: EXPORT_MARGIN_PX, y: EXPORT_MARGIN_PX });
    const southEast = screenToPlan(viewport, {
      x: viewport.widthPx - EXPORT_MARGIN_PX,
      y: viewport.heightPx - EXPORT_MARGIN_PX,
    });

    expect(northWest.x).toBeCloseTo(bounds.minX);
    expect(northWest.y).toBeCloseTo(bounds.maxY);
    expect(southEast.x).toBeCloseTo(bounds.maxX);
    expect(southEast.y).toBeCloseTo(bounds.minY);
  });

  it('keeps a large plot inside the sheet the maximum extent allows', () => {
    const viewport = computeExportViewport({ minX: 0, minY: 0, maxX: 200, maxY: 150 });

    expect(viewport.widthPx).toBeLessThanOrEqual(2400);
    expect(viewport.heightPx).toBeLessThanOrEqual(2400);
    expect(isNiceScale(viewport.pixelsPerMeter)).toBe(true);
  });

  it('holds the sheet at the maximum extent for a plot too large for the finest scale', () => {
    // Kilometres across: the scale bottoms out at one pixel per metre, and the
    // sheet has to stop at its ceiling rather than follow the plot.
    const viewport = computeExportViewport({ minX: 0, minY: 0, maxX: 8000, maxY: 5000 });

    expect(viewport.pixelsPerMeter).toBe(MIN_PIXELS_PER_METER);
    expect(viewport.widthPx).toBe(2400);
    expect(viewport.heightPx).toBe(2400);
  });

  it('falls back to the editor scale and a legible sheet for an empty plot', () => {
    const viewport = computeExportViewport({ minX: 5, minY: 5, maxX: 5, maxY: 5 });

    expect(viewport.pixelsPerMeter).toBe(DEFAULT_PIXELS_PER_METER);
    expect(viewport.widthPx).toBeGreaterThan(2 * EXPORT_MARGIN_PX);
    expect(viewport.heightPx).toBeGreaterThan(2 * EXPORT_MARGIN_PX);
  });
});
