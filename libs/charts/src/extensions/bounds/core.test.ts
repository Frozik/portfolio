import { describe, expect, it } from 'vitest';

import { createChart } from '../../core/create-chart';
import { numberDomain } from '../../core/viewport/number-domain';
import type { IBoundsOptions } from './core';
import { bounds } from './core';

function viewportWith(options: IBoundsOptions<number>) {
  return createChart({
    x: { domain: numberDomain, start: 0, end: 100 },
    series: [],
    extensions: [bounds(options)],
  }).viewport;
}

describe('bounds', () => {
  it('slides a range that crosses a limit back inside, keeping its length', () => {
    const viewport = viewportWith({ min: 0, max: 1000 });

    viewport.jump({ start: -30, end: 70 });
    expect(viewport.current).toEqual({ start: 0, end: 100 });

    viewport.jump({ start: 950, end: 1050 });
    expect(viewport.current).toEqual({ start: 900, end: 1000 });
  });

  it('shows everything between the limits when asked for more', () => {
    const viewport = viewportWith({ min: 0, max: 1000 });

    viewport.jump({ start: -500, end: 5000 });

    expect(viewport.current).toEqual({ start: 0, end: 1000 });
  });

  it('widens a range shorter than the least span round its middle', () => {
    const viewport = viewportWith({ minRange: 60 });

    viewport.jump({ start: 495, end: 505 });

    expect(viewport.current).toEqual({ start: 470, end: 530 });
  });

  it('leaves a side unlimited until the data that limits it is known', () => {
    const viewport = viewportWith({ max: 'data' });

    viewport.jump({ start: 5000, end: 6000 });

    expect(viewport.current).toEqual({ start: 5000, end: 6000 });
  });
});
