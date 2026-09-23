import { describe, expect, it } from 'vitest';

import {
  advanceCometSky,
  cometHeading,
  cometPosition,
  createCometSky,
  OFFSCREEN_MARGIN_METERS,
} from './comets';

const VISIBLE = { min: { x: -12, y: 40 }, max: { x: 12, y: 54 } };
const FRAME = 1 / 60;

function afterSeconds(seconds: number, seed = 5) {
  let sky = createCometSky(seed);
  for (let tick = 0; tick < Math.round(seconds / FRAME); tick += 1) {
    sky = advanceCometSky(sky, FRAME, VISIBLE);
  }
  return sky;
}

function onEdge(point: { x: number; y: number }): boolean {
  const atX =
    Math.abs(point.x - (VISIBLE.min.x - OFFSCREEN_MARGIN_METERS)) < 1e-6 ||
    Math.abs(point.x - (VISIBLE.max.x + OFFSCREEN_MARGIN_METERS)) < 1e-6;
  const atY =
    Math.abs(point.y - (VISIBLE.min.y - OFFSCREEN_MARGIN_METERS)) < 1e-6 ||
    Math.abs(point.y - (VISIBLE.max.y + OFFSCREEN_MARGIN_METERS)) < 1e-6;
  return atX || atY;
}

describe('the comets', () => {
  it('sends the first one soon after the world is made, and none before its time', () => {
    expect(afterSeconds(1).comet).toBeUndefined();
    expect(afterSeconds(5).comet).toBeDefined();
  });

  it('lays its line from off one edge of the screen to off the other, through the middle of it', () => {
    const { comet } = afterSeconds(5);
    if (comet === undefined) {
      throw new Error('no comet');
    }

    expect(onEdge(comet.from)).toBe(true);
    expect(onEdge(comet.to)).toBe(true);
    const halfway = { x: (comet.from.x + comet.to.x) / 2, y: (comet.from.y + comet.to.y) / 2 };
    expect(halfway.x).toBeGreaterThan(VISIBLE.min.x);
    expect(halfway.x).toBeLessThan(VISIBLE.max.x);
    expect(halfway.y).toBeGreaterThan(VISIBLE.min.y);
    expect(halfway.y).toBeLessThan(VISIBLE.max.y);
  });

  it('flies straight at its own speed, and is gone once it has crossed', () => {
    const started = afterSeconds(5);
    const later = advanceCometSky(started, 0.5, VISIBLE);
    if (started.comet === undefined || later.comet === undefined) {
      throw new Error('no comet');
    }

    const before = cometPosition(started.comet);
    const after = cometPosition(later.comet);
    const flown = Math.hypot(after.x - before.x, after.y - before.y);
    expect(flown).toBeCloseTo(14 * 0.5, 1);
    const heading = cometHeading(later.comet);
    expect((after.x - before.x) / flown).toBeCloseTo(heading.x, 5);

    const crossed = advanceCometSky(later, later.comet.crossingSeconds, VISIBLE);
    expect(crossed.comet).toBeUndefined();
    expect(crossed.passes).toBe(1);
    expect(crossed.waitSeconds).toBeGreaterThanOrEqual(9);
  });

  it('comes by again after a wait, and by a different way each time, the same for the same world', () => {
    const nthComet = (pass: number, seed = 5) => {
      let sky = createCometSky(seed);
      for (let tick = 0; tick < 60 * 600; tick += 1) {
        sky = advanceCometSky(sky, FRAME, VISIBLE);
        if (sky.passes === pass && sky.comet !== undefined) {
          return sky.comet;
        }
      }
      throw new Error(`no comet ${pass}`);
    };

    const first = nthComet(0);
    const second = nthComet(1);

    expect(second.from).not.toEqual(first.from);
    expect(nthComet(1)).toEqual(second);
    expect(nthComet(1, 6).from).not.toEqual(second.from);
  });
});
