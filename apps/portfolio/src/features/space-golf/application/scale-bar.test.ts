import { describe, expect, it } from 'vitest';

import { MIN_ZOOM, VIEW_PIXELS_PER_METER } from './camera';
import { scaleBarFor } from './scale-bar';

describe('the scale bar', () => {
  it('is one metre long at the one scale: as many pixels as the world has to a metre', () => {
    expect(scaleBarFor(1)).toEqual({ meters: 1, pixels: VIEW_PIXELS_PER_METER });
  });

  it('shows a rounder, longer measure as the view zooms out, so the bar never shrinks to a dash', () => {
    const halfway = scaleBarFor(0.5);
    const overview = scaleBarFor(MIN_ZOOM);

    expect(halfway).toEqual({ meters: 2, pixels: VIEW_PIXELS_PER_METER });
    expect(overview.meters).toBe(5);
    expect(overview.pixels).toBeCloseTo(5 * VIEW_PIXELS_PER_METER * MIN_ZOOM);
  });
});
