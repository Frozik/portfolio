import type { Vector2 } from '@frozik/utils/math/vector2';
import { describe, expect, it } from 'vitest';

import type { Play } from '../domain/course';
import { hasSector, startCourse } from '../domain/course';
import { sectorBounds } from '../domain/generator/generate-sector';
import type { Bounds } from '../domain/level';
import { chart, ground, nothingSeen, sectorSizeFor } from './charting';

const SIZE = { widthCells: 24, heightCells: 24 };
const WORLD_SEED = 3;
const AHEAD_SECTORS = 2;
const ENOUGH_FRAMES = 40;

function viewRound(point: Vector2): Bounds {
  return { min: { x: point.x - 3, y: point.y - 6 }, max: { x: point.x + 3, y: point.y + 6 } };
}

function flying(play: Play, velocity: Vector2): Play {
  return { ...play, ball: { ...play.ball, phase: 'flying', velocity } };
}

function frames(play: Play, count: number, visible = viewRound(play.ball.position)): Play {
  let current = play;
  for (let frame = 0; frame < count; frame += 1) {
    current = chart(current, nothingSeen(), visible).play;
  }
  return current;
}

describe('sectorSizeFor', () => {
  it('is never smaller than twelve metres a side and grows to what the screen shows', () => {
    expect(sectorSizeFor({ width: 390, height: 844 })).toEqual({ widthCells: 24, heightCells: 27 });
    expect(sectorSizeFor({ width: 1600, height: 900 })).toEqual({
      widthCells: 50,
      heightCells: 29,
    });
  });
});

describe('charting the course', () => {
  it("uses the ball's rest to make the country two sectors out in every direction, a sector a frame", () => {
    const play = startCourse(WORLD_SEED, SIZE);

    const oneFrame = frames(play, 1);
    const rested = frames(play, ENOUGH_FRAMES);

    expect(oneFrame.course.sectors.length).toBe(play.course.sectors.length + 1);
    for (let sy = -AHEAD_SECTORS; sy <= AHEAD_SECTORS; sy += 1) {
      for (let sx = -AHEAD_SECTORS; sx <= AHEAD_SECTORS; sx += 1) {
        expect(hasSector(rested.course, sx, sy)).toBe(true);
      }
    }
    expect(frames(rested, 1).course.sectors).toBe(rested.course.sectors);
  });

  it('makes nothing while the ball flies over country that is already there', () => {
    const rested = frames(startCourse(WORLD_SEED, SIZE), ENOUGH_FRAMES);
    const inFlight = flying(rested, { x: 3, y: 2 });

    expect(frames(inFlight, 10).course.sectors).toBe(inFlight.course.sectors);
  });

  it('stops making the country the moment the ball flies, however much of it is still missing, and takes it up again at rest', () => {
    const fresh = startCourse(WORLD_SEED, SIZE);
    const inFlight = frames(flying(fresh, { x: 1, y: 1 }), 10);

    expect(inFlight.course.sectors).toBe(fresh.course.sectors);

    const atRestAgain: Play = { ...inFlight, ball: fresh.ball };
    expect(frames(atRestAgain, 1).course.sectors.length).toBe(fresh.course.sectors.length + 1);
  });

  it('makes on the fly only the sector a flight is heading into and finds missing', () => {
    const rested = frames(startCourse(WORLD_SEED, SIZE), ENOUGH_FRAMES);
    const edge = sectorBounds(SIZE, AHEAD_SECTORS, 0);
    const position = { x: edge.max.x - 1, y: edge.min.y + 6 };
    const leaving = flying({ ...rested, ball: { ...rested.ball, position } }, { x: 10, y: 0 });
    expect(hasSector(leaving.course, AHEAD_SECTORS + 1, 0)).toBe(false);

    const charted = frames(leaving, 3, viewRound(rested.ball.position));

    expect(hasSector(charted.course, AHEAD_SECTORS + 1, 0)).toBe(true);
    expect(charted.course.sectors.length).toBe(leaving.course.sectors.length + 1);
  });

  it('makes what the camera shows before anything else, in flight as at rest', () => {
    const play = startCourse(WORLD_SEED, SIZE);
    const far = sectorBounds(SIZE, 6, 0);
    const lookingFar = viewRound({ x: far.min.x + 6, y: far.min.y + 6 });

    expect(hasSector(frames(play, 1, lookingFar).course, 6, 0)).toBe(true);
    expect(hasSector(frames(flying(play, { x: 1, y: 1 }), 1, lookingFar).course, 6, 0)).toBe(true);
  });

  it('never leaves the ball over ground that is not there', () => {
    const play = startCourse(WORLD_SEED, SIZE);
    const far = sectorBounds(SIZE, 9, -7);
    const position = { x: far.min.x + 3, y: far.min.y + 3 };
    const thrown = flying({ ...play, ball: { ...play.ball, position } }, { x: 0, y: -1 });

    expect(hasSector(ground(thrown).course, 9, -7)).toBe(true);
  });
});
