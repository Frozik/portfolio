import { describe, expect, it } from 'vitest';

import { computeGridRects } from './grid-lines';
import type { UnixTimeMs } from './types';

const MINUTE_MS = 60_000;

const BASE_INPUT = {
  plotWidthCss: 800,
  plotHeightCss: 400,
  viewTimeStartMs: 0 as UnixTimeMs,
  viewTimeEndMs: (2 * MINUTE_MS) as UnixTimeMs,
  priceMin: 100,
  priceMax: 104,
  priceStep: 1,
};

describe('computeGridRects', () => {
  it('draws full-height time lines at every tick, thicker on minute boundaries', () => {
    const rects = computeGridRects(BASE_INPUT);
    const timeLines = rects.filter(rect => rect.height === BASE_INPUT.plotHeightCss);

    expect(timeLines.length).toBeGreaterThan(2);
    const minuteLine = timeLines.find(rect => Math.abs(rect.left + rect.width / 2 - 400) < 1);
    expect(minuteLine?.width).toBe(3);
    const secondLine = timeLines.find(rect => rect.width === 1);
    expect(secondLine).toBeDefined();
  });

  it('draws one full-width price line per bin boundary inside the visible range', () => {
    const rects = computeGridRects(BASE_INPUT);
    const priceLines = rects.filter(rect => rect.width === BASE_INPUT.plotWidthCss);

    expect(priceLines.map(rect => Math.round(rect.top + rect.height / 2))).toEqual([
      350, 250, 150, 50,
    ]);
  });

  it('returns nothing for a degenerate viewport', () => {
    expect(
      computeGridRects({ ...BASE_INPUT, viewTimeEndMs: BASE_INPUT.viewTimeStartMs, priceMax: 100 })
    ).toEqual([]);
  });
});
