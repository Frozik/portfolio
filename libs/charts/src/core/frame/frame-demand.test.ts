import { describe, expect, it } from 'vitest';

import { FrameDemand } from './frame-demand';

describe('FrameDemand', () => {
  it('idles when nobody asks for frames', () => {
    expect(new FrameDemand(10).fps).toBe(10);
    expect(new FrameDemand(10).intervalMs).toBe(100);
  });

  it('runs at the highest rate raised, at once', () => {
    const demand = new FrameDemand(10);

    demand.raise(30);
    demand.raise(60);

    expect(demand.fps).toBe(60);
  });

  it('lets a raised rate lapse half a second after the last raise', () => {
    const demand = new FrameDemand(10);
    demand.raise(60);
    demand.tick(1000);

    demand.tick(1400);
    expect(demand.fps).toBe(60);

    demand.tick(1500);
    expect(demand.fps).toBe(10);
  });

  it('holds the rate for as long as it keeps being raised', () => {
    const demand = new FrameDemand(10);
    for (let now = 0; now <= 2000; now += 100) {
      demand.raise(60);
      demand.tick(now);
    }

    expect(demand.fps).toBe(60);
  });
});
