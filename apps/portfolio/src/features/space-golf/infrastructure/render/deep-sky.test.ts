import { describe, expect, it } from 'vitest';

import { advanceDeepSky, brightnessOf, createDeepSky } from './deep-sky';

const VISIBLE = { min: { x: -3, y: 40 }, max: { x: 3, y: 53 } };
const FRAME = 1 / 60;
const LIFE_SECONDS = 42;

function afterSeconds(seconds: number, visible = VISIBLE) {
  let sky = createDeepSky(7, VISIBLE);
  for (let tick = 0; tick < Math.round(seconds / FRAME); tick += 1) {
    sky = advanceDeepSky(sky, FRAME, visible);
  }
  return sky;
}

describe('the deep sky', () => {
  it('comes up out of nothing and goes back into it, so nothing is ever seen to appear', () => {
    const sky = createDeepSky(7, VISIBLE);
    const [first] = sky.objects;

    expect(brightnessOf({ ...first, ageSeconds: 0 })).toBe(0);
    expect(brightnessOf({ ...first, ageSeconds: LIFE_SECONDS * 0.35 })).toBeCloseTo(1);
    expect(brightnessOf({ ...first, ageSeconds: LIFE_SECONDS })).toBe(0);
  });

  it('holds its things apart in time, so they do not all come and go together', () => {
    const sky = createDeepSky(7, VISIBLE);

    const ages = sky.objects.map(object => object.ageSeconds);
    expect(new Set(ages).size).toBe(ages.length);
  });

  it('lives one thing out and puts another in its place, elsewhere', () => {
    const sky = afterSeconds(LIFE_SECONDS + 1);

    expect(sky.lives.some(life => life > 0)).toBe(true);
    expect(sky.objects.every(object => object.ageSeconds < LIFE_SECONDS)).toBe(true);
  });

  it('is carried nearly all the way along with a pan: it lies further off than any mote of dust', () => {
    const sky = createDeepSky(7, VISIBLE);
    const panned = {
      min: { x: VISIBLE.min.x + 10, y: VISIBLE.min.y },
      max: { x: VISIBLE.max.x + 10, y: VISIBLE.max.y },
    };

    const moved = advanceDeepSky(sky, FRAME, panned);

    moved.objects.forEach((object, index) => {
      const wentBy = object.position.x - sky.objects[index].position.x;
      expect(wentBy).toBeGreaterThan(10 * 0.8);
      expect(wentBy).toBeLessThan(10);
    });
  });

  it('drifts by itself, so the sky is never quite still', () => {
    const sky = createDeepSky(7, VISIBLE);

    const moved = advanceDeepSky(sky, 1, VISIBLE);

    moved.objects.forEach((object, index) => {
      const before = sky.objects[index].position;
      expect(object.position.x !== before.x || object.position.y !== before.y).toBe(true);
    });
  });

  it('shows the same sky for the same world: a seed is a place, not a shuffle', () => {
    expect(createDeepSky(11, VISIBLE).objects).toEqual(createDeepSky(11, VISIBLE).objects);
    expect(createDeepSky(11, VISIBLE).objects).not.toEqual(createDeepSky(12, VISIBLE).objects);
  });
});
