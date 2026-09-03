import { describe, expect, it } from 'vitest';

import { createStair } from '../model/stairs';
import { createSupport } from '../model/supports';
import { deriveStairRun, stairCutout } from './stair-footprint';
import { stairStepPolygons, supportFootprint } from './stair-mesh';

const STANDARD_HEIGHT = 2.7;

describe('stairStepPolygons', () => {
  it('climbs a straight flight one tread per riser, topping out at the floor above', () => {
    const stair = createStair({ kind: 'straight', position: { x: 0, y: 0 } });
    const run = deriveStairRun(STANDARD_HEIGHT);
    const steps = stairStepPolygons(stair, STANDARD_HEIGHT);

    expect(steps).toHaveLength(run.riserCount - 1);
    expect(steps[0].topOffsetMeters).toBeCloseTo(run.riserMeters);
    expect(steps[steps.length - 1].topOffsetMeters).toBeCloseTo(STANDARD_HEIGHT - run.riserMeters);
  });

  it('keeps every step monotonically rising across an l-shape with a landing', () => {
    const stair = createStair({ kind: 'l-shaped', position: { x: 0, y: 0 } });
    const steps = stairStepPolygons(stair, STANDARD_HEIGHT);

    for (let index = 1; index < steps.length; index += 1) {
      expect(steps[index].topOffsetMeters).toBeGreaterThanOrEqual(
        steps[index - 1].topOffsetMeters - 1e-9
      );
    }
    expect(steps[steps.length - 1].topOffsetMeters).toBeLessThan(STANDARD_HEIGHT);
  });

  it('fans a spiral through one sector per riser', () => {
    const stair = createStair({ kind: 'spiral', position: { x: 0, y: 0 } });
    const run = deriveStairRun(STANDARD_HEIGHT);
    const steps = stairStepPolygons(stair, STANDARD_HEIGHT);

    expect(steps).toHaveLength(run.riserCount);
    expect(steps.every(step => step.polygon.outer.length === 5)).toBe(true);
  });

  it('re-derives the whole set when the storey height changes', () => {
    const stair = createStair({ kind: 'straight', position: { x: 0, y: 0 } });

    const shorter = stairStepPolygons(stair, 2.7);
    const taller = stairStepPolygons(stair, 3.4);

    expect(taller.length).toBeGreaterThan(shorter.length);
  });
});

describe('supportFootprint', () => {
  it('boxes a square post around its position', () => {
    const post = createSupport({ position: { x: 5, y: 5 }, profile: 'square' });
    const { outer } = supportFootprint(post);

    expect(outer).toHaveLength(4);

    for (const point of outer) {
      expect(Math.abs(point.x - 5)).toBeCloseTo(post.sizeMeters / 2);
      expect(Math.abs(point.y - 5)).toBeCloseTo(post.sizeMeters / 2);
    }
  });

  it('rings a round post as an octagon of its radius', () => {
    const post = createSupport({ position: { x: 1, y: 2 }, profile: 'round' });
    const { outer } = supportFootprint(post);

    expect(outer).toHaveLength(8);

    for (const point of outer) {
      expect(Math.hypot(point.x - 1, point.y - 2)).toBeCloseTo(post.sizeMeters / 2);
    }
  });
});

describe('stairCutout', () => {
  const FLOOR_TO_FLOOR = 2.92;

  it('opens only the top of a straight flight, not its whole footprint', () => {
    const stair = createStair({ kind: 'straight', position: { x: 0, y: 0 } });
    const steps = stairStepPolygons(stair, FLOOR_TO_FLOOR);
    const cutout = stairCutout(stair, FLOOR_TO_FLOOR, { steps });

    expect(cutout.length).toBeLessThan(steps.length);
    expect(cutout.length).toBeGreaterThan(0);
  });

  it('leaves the floor over the lower flight of an l-shape standing', () => {
    const stair = createStair({ kind: 'l-shaped', position: { x: 0, y: 0 } });
    const steps = stairStepPolygons(stair, FLOOR_TO_FLOOR);
    const cutout = stairCutout(stair, FLOOR_TO_FLOOR, { steps });
    const lowestCut = Math.min(
      ...steps.filter(step => cutout.includes(step.polygon)).map(step => step.topOffsetMeters)
    );

    // Nothing below the headroom line is pierced: that is where the wardrobe
    // upstairs stands.
    expect(lowestCut).toBeGreaterThanOrEqual(FLOOR_TO_FLOOR - 2.0 - 1e-9);
  });

  it('cuts more of the footprint as the storey gets lower', () => {
    const stair = createStair({ kind: 'straight', position: { x: 0, y: 0 } });
    const tall = stairCutout(stair, 3.4, { steps: stairStepPolygons(stair, 3.4) });
    const low = stairCutout(stair, 2.4, { steps: stairStepPolygons(stair, 2.4) });

    expect(low.length / stairStepPolygons(stair, 2.4).length).toBeGreaterThan(
      tall.length / stairStepPolygons(stair, 3.4).length
    );
  });
});
