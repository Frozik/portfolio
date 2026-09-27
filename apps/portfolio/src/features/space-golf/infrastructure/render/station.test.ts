import { describe, expect, it } from 'vitest';

import type { Station, StationSky } from './station';
import { advanceStationSky, createStationSky, STATION_REACH_METERS } from './station';

const VISIBLE = { min: { x: -12, y: 40 }, max: { x: 12, y: 54 } };
const FRAME = 1 / 60;
const DOWN = { x: 0, y: -1 };
const LEFT = { x: -1, y: 0 };
const WEIGHTLESS = { x: 0, y: 0 };
const SPEED_METERS_PER_SECOND = 1.5;

function advanced(sky: StationSky, seconds: number, gravity = DOWN, visible = VISIBLE): StationSky {
  let later = sky;
  for (let tick = 0; tick < Math.round(seconds / FRAME); tick += 1) {
    later = advanceStationSky(later, gravity, FRAME, visible);
  }
  return later;
}

function launchedSky(gravity = DOWN, seed = 5): StationSky & { readonly station: Station } {
  const sky = advanced(createStationSky(seed, VISIBLE), 8 + FRAME, gravity);
  if (sky.station === undefined) {
    throw new Error('no station');
  }
  return { ...sky, station: sky.station };
}

function stationOf(sky: StationSky): Station {
  if (sky.station === undefined) {
    throw new Error('no station');
  }
  return sky.station;
}

describe('the station', () => {
  it('sends the first one soon after the world is made, and none before its time', () => {
    const sky = createStationSky(5, VISIBLE);

    expect(advanced(sky, 2).station).toBeUndefined();
    expect(advanced(sky, 9).station).toBeDefined();
  });

  it('comes in upstream of the pull with the whole of it still off the screen', () => {
    const { station } = launchedSky(DOWN);

    expect(station.position.y - STATION_REACH_METERS).toBeGreaterThan(VISIBLE.max.y);
    expect(station.position.x).toBeGreaterThan(VISIBLE.min.x);
    expect(station.position.x).toBeLessThan(VISIBLE.max.x);

    const sideways = launchedSky(LEFT).station;
    expect(sideways.position.x - STATION_REACH_METERS).toBeGreaterThan(VISIBLE.max.x);
  });

  it('flies the way gravity pulls, at its own stately speed', () => {
    const started = launchedSky(DOWN);

    const later = stationOf(advanced(started, 2));

    expect(later.attitude).toEqual(DOWN);
    expect(later.position.x).toBeCloseTo(started.station.position.x, 6);
    expect(started.station.position.y - later.position.y).toBeCloseTo(
      SPEED_METERS_PER_SECOND * 2,
      3
    );
  });

  it('goes the way of a new floor without turning: it lies as it set out and falls sideways', () => {
    const started = advanced(launchedSky(DOWN), 4);
    const before = stationOf(started).position;

    const later = stationOf(advanced(started, 2, LEFT));

    expect(later.attitude).toEqual(DOWN);
    expect(later.position.y).toBeCloseTo(before.y, 6);
    expect(before.x - later.position.x).toBeCloseTo(SPEED_METERS_PER_SECOND * 2, 3);
  });

  it('falls by the very pull the dust drifts by: a floor half turned moves it half as fast, between the two', () => {
    const started = advanced(launchedSky(DOWN), 4);
    const before = stationOf(started).position;
    const halfTurned = { x: -0.5, y: -0.5 };

    const later = stationOf(advanceStationSky(started, halfTurned, 1, VISIBLE));

    expect(later.position.x - before.x).toBeCloseTo(halfTurned.x * SPEED_METERS_PER_SECOND, 9);
    expect(later.position.y - before.y).toBeCloseTo(halfTurned.y * SPEED_METERS_PER_SECOND, 9);
  });

  it('hangs still through weightlessness, its day going on all the while', () => {
    const started = advanced(launchedSky(DOWN), 4);

    const later = stationOf(advanced(started, 1, WEIGHTLESS));

    expect(later.position).toEqual(stationOf(started).position);
    expect(later.ageSeconds - stationOf(started).ageSeconds).toBeCloseTo(1, 6);
  });

  it('waits for the floor to settle before it sets out, so it never lies between two floors', () => {
    const turning = { x: -0.5, y: -0.5 };

    const waiting = advanced(createStationSky(5, VISIBLE), 9, turning);

    expect(waiting.station).toBeUndefined();
    expect(stationOf(advanced(waiting, FRAME, LEFT)).attitude).toEqual(LEFT);
  });

  it('is carried most of the way along with a pan: it lies far behind the board', () => {
    const started = advanced(launchedSky(DOWN), 4);
    const panned = {
      min: { x: VISIBLE.min.x + 10, y: VISIBLE.min.y },
      max: { x: VISIBLE.max.x + 10, y: VISIBLE.max.y },
    };

    const moved = stationOf(advanceStationSky(started, DOWN, FRAME, panned));

    const wentBy = moved.position.x - stationOf(started).position.x;
    expect(wentBy).toBeGreaterThan(10 * 0.6);
    expect(wentBy).toBeLessThan(10 * 0.85);
  });

  it('is gone once the whole of it has left the screen, and another comes after a wait', () => {
    let crossed: StationSky = launchedSky(DOWN);
    let lastSeen = stationOf(crossed);
    for (let tick = 0; tick < 60 * 60 && crossed.station !== undefined; tick += 1) {
      lastSeen = crossed.station;
      crossed = advanceStationSky(crossed, DOWN, FRAME, VISIBLE);
    }

    expect(lastSeen.position.y + STATION_REACH_METERS).toBeLessThan(VISIBLE.min.y);
    expect(crossed.station).toBeUndefined();
    expect(crossed.passes).toBe(1);
    expect(crossed.waitSeconds).toBeGreaterThanOrEqual(40);
    expect(crossed.waitSeconds).toBeLessThanOrEqual(100);
    expect(advanced(crossed, crossed.waitSeconds - 1).station).toBeUndefined();
    expect(advanced(crossed, crossed.waitSeconds + 1).station).toBeDefined();
  });

  it('leaves by the side it came in at when the floor turns over under it', () => {
    const started = advanced(launchedSky(DOWN), 1);

    const turnedBack = advanced(started, 20, { x: 0, y: 1 });

    expect(turnedBack.station).toBeUndefined();
    expect(turnedBack.passes).toBe(1);
  });

  it('sends the same stations to the same world, and others to another', () => {
    expect(launchedSky(DOWN, 5).station).toEqual(launchedSky(DOWN, 5).station);
    expect(launchedSky(DOWN, 5).station.dayShare).not.toBe(launchedSky(DOWN, 6).station.dayShare);
    expect(launchedSky(DOWN, 5).station.position).not.toEqual(
      launchedSky(DOWN, 6).station.position
    );
  });
});
