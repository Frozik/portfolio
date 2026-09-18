import { describe, expect, it } from 'vitest';

import { createBall, respawn } from './ball';
import {
  AIM_DEAD_ZONE_METERS,
  MAX_SPEED_METERS_PER_SECOND,
  PREVIEW_DOT_COUNT,
  PREVIEW_INTERVAL_SECONDS,
} from './constants';
import { previewDots } from './preview';
import { aim, shoot } from './shot';
import { createTestLevel } from './test-level';
import { distance, length } from './vector';

const level = createTestLevel();
const ANCHOR = { x: 4, y: 4 };

describe('aim', () => {
  it('launches from the pull point back towards the anchor', () => {
    const velocity = aim(ANCHOR, { x: 4, y: 3 });

    expect(velocity?.x).toBe(0);
    expect(velocity?.y).toBeGreaterThan(0);
  });

  it('caps the speed however far the band is pulled', () => {
    const velocity = aim(ANCHOR, { x: 4, y: -20 });

    expect(velocity && length(velocity)).toBeCloseTo(MAX_SPEED_METERS_PER_SECOND);
  });

  it('is slack inside the dead zone around the anchor', () => {
    expect(aim(ANCHOR, { x: 4 + AIM_DEAD_ZONE_METERS / 2, y: 4 })).toBeUndefined();
  });
});

describe('previewDots', () => {
  const from = createBall(level).position;

  it('draws five dots that spread with the pull and stop spreading at the cap', () => {
    const gentle = previewDots(from, aim(ANCHOR, { x: 3.7, y: 4 }) ?? { x: 0, y: 0 });
    const strong = previewDots(from, aim(ANCHOR, { x: 1, y: 4 }) ?? { x: 0, y: 0 });
    const capped = previewDots(from, aim(ANCHOR, { x: -10, y: 4 }) ?? { x: 0, y: 0 });

    expect(gentle).toHaveLength(PREVIEW_DOT_COUNT);
    expect(distance(strong[0], strong[1])).toBeGreaterThan(distance(gentle[0], gentle[1]));
    expect(distance(capped[0], capped[1])).toBeCloseTo(distance(strong[0], strong[1]), 1);
  });

  it('shows the impulse, not the flight: the dots run straight along the launch velocity', () => {
    const dots = previewDots(from, { x: 3, y: 4 });

    dots.forEach((dot, index) => {
      expect(dot.x - from.x).toBeCloseTo(3 * PREVIEW_INTERVAL_SECONDS * (index + 1));
      expect(dot.y - from.y).toBeCloseTo(4 * PREVIEW_INTERVAL_SECONDS * (index + 1));
    });
  });
});

describe('shoot and respawn', () => {
  it('counts the stroke on launch and keeps it after a destroyed ball respawns', () => {
    const launched = shoot(level, createBall(level), { x: 1, y: 1 });
    const back = respawn({ ...launched, phase: 'destroyed', position: { x: 5, y: 5 } });

    expect(launched.stroke).toBe(1);
    expect(back.phase).toBe('aiming');
    expect(back.stroke).toBe(1);
    expect(back.position).toEqual(level.tee);
  });
});
