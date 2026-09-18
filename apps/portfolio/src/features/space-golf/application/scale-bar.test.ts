import { describe, expect, it } from 'vitest';

import { MIN_ZOOM, VIEW_PIXELS_PER_METER } from './camera';
import { scaleBarFor } from './scale-bar';

describe('the scale bar', () => {
  it('is one metre long at the one scale: as many pixels as the world has to a metre', () => {
    expect(scaleBarFor(1)).toEqual({ meters: 1, pixels: VIEW_PIXELS_PER_METER });
  });

  it("is still one metre at a phone's home zoom, and a rounder, longer measure once a metre would shrink to a dash", () => {
    const overview = scaleBarFor(MIN_ZOOM);

    expect(scaleBarFor(0.5)).toEqual({ meters: 1, pixels: VIEW_PIXELS_PER_METER / 2 });
    expect(overview.meters).toBe(2);
    expect(overview.pixels).toBeCloseTo(2 * VIEW_PIXELS_PER_METER * MIN_ZOOM);
  });
});
