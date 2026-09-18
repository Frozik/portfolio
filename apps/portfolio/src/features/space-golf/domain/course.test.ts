import { describe, expect, it } from 'vitest';

import { afterHoleOut, keepingSectors, levelOf, slicesOf, startCourse, withSector } from './course';
import { cupCenter, hasCup } from './cup';
import { sectorAt, sectorKey } from './generator/generate-sector';
import { edgeOf } from './level';

const SIZE = { widthCells: 24, heightCells: 24 };

describe('a new course', () => {
  it('has the block of three by three round the tee, the ball resting on it, and a cup one to three sectors away', () => {
    const { course, ball } = startCourse(7, SIZE);
    const keys = new Set(course.sectors.map(sector => sectorKey(sector.sx, sector.sy)));

    for (let sy = -1; sy <= 1; sy += 1) {
      for (let sx = -1; sx <= 1; sx += 1) {
        expect(keys.has(sectorKey(sx, sy))).toBe(true);
      }
    }
    expect(ball.position).toEqual(course.spawn);
    expect(sectorAt(SIZE, ball.position)).toEqual({ sx: 0, sy: 0 });
    const [sx, sy] = (course.cup?.sector ?? '0,0').split(',').map(Number);
    expect(Math.abs(sx) + Math.abs(sy)).toBeGreaterThanOrEqual(1);
    expect(Math.abs(sx) + Math.abs(sy)).toBeLessThanOrEqual(3);
  });

  it("is one level to the physics — every sector's walls in a row, the cup cut into its face — with the ball's states one per obstacle", () => {
    const { course, ball } = startCourse(7, SIZE);
    const level = levelOf(course);

    expect(level.walls).toHaveLength(
      course.sectors.reduce((sum, each) => sum + each.walls.length, 0)
    );
    expect(ball.spikes).toHaveLength(level.spikes.length);
    expect(ball.floaters).toHaveLength(level.floaters.length);
    expect(ball.rods).toHaveLength(level.rods.length);
    expect(hasCup(level)).toBe(true);
    if (hasCup(level)) {
      expect(edgeOf(level, level.cup).kind).toBe('floor');
      expect(level.walls[level.cup.wall].edges.filter(edge => edge.kind === 'cup')).toHaveLength(8);
    }
  });

  it('draws the cup only in the sector it is cut into', () => {
    const { course } = startCourse(7, SIZE);

    const withCup = slicesOf(course).filter(slice => slice.cup !== undefined);
    expect(withCup).toHaveLength(1);
    expect(sectorKey(withCup[0].sector.sx, withCup[0].sector.sy)).toBe(course.cup?.sector);
  });
});

describe('sectors coming and going', () => {
  it("appends a new sector and its obstacles' states, moving nothing that was there", () => {
    const play = startCourse(7, SIZE);
    const grown = withSector(play, 5, 5);

    expect(grown.course.sectors).toHaveLength(play.course.sectors.length + 1);
    expect(grown.course.sectors.slice(0, -1)).toEqual(play.course.sectors);
    expect(grown.ball.spikes.slice(0, play.ball.spikes.length)).toEqual(play.ball.spikes);
    expect(grown.ball.rods).toHaveLength(levelOf(grown.course).rods.length);
    expect(withSector(grown, 5, 5)).toBe(grown);
  });

  it('drops sectors with their states, always keeping the one the cup is in', () => {
    const play = withSector(startCourse(7, SIZE), 5, 5);
    const flipped = {
      ...play,
      ball: { ...play.ball, spikes: play.ball.spikes.map(each => !each) },
    };

    const kept = keepingSectors(flipped, new Set([sectorKey(0, 0)]));
    const level = levelOf(kept.course);

    const keys = kept.course.sectors.map(sector => sectorKey(sector.sx, sector.sy));
    expect(new Set(keys)).toEqual(new Set([sectorKey(0, 0), play.course.cup?.sector]));
    expect(kept.ball.spikes).toHaveLength(level.spikes.length);
    expect(kept.ball.floaters).toHaveLength(level.floaters.length);
    expect(kept.ball.rods).toHaveLength(level.rods.length);
    kept.ball.spikes.forEach((extended, index) => {
      expect(extended).toBe(!level.spikes[index].extendedAtStart);
    });
  });
});

describe('holing out', () => {
  it('closes the cup under the ball and lifts it onto the face, at rest and ready for the next stroke', () => {
    const play = startCourse(7, SIZE);
    const level = levelOf(play.course);
    const cup = hasCup(level) ? cupCenter(level) : { x: 0, y: 0 };
    const inTheCup = { ...play, ball: { ...play.ball, position: cup, phase: 'holed' as const } };

    const next = afterHoleOut(inTheCup);

    expect(next.ball.phase).toBe('aiming');
    expect(Math.hypot(next.ball.position.x - cup.x, next.ball.position.y - cup.y)).toBeLessThan(
      0.1
    );
    expect(next.ball.rest.position).toEqual(next.ball.position);
    expect(
      levelOf(next.course).walls.some(wall => wall.edges.some(edge => edge.kind === 'cup'))
    ).toBe(true);
  });

  it('moves the epoch on, keeps only the block round the ball, and cuts the next cup one to three sectors from the last', () => {
    const play = startCourse(7, SIZE);
    const level = levelOf(play.course);
    const cup = hasCup(level) ? cupCenter(level) : { x: 0, y: 0 };
    const [wasX, wasY] = (play.course.cup?.sector ?? '0,0').split(',').map(Number);
    const inTheCup = { ...play, ball: { ...play.ball, position: cup, phase: 'holed' as const } };

    const next = afterHoleOut(inTheCup);

    expect(next.course.epoch).toBe(1);
    const [nowX, nowY] = (next.course.cup?.sector ?? '0,0').split(',').map(Number);
    const away = Math.abs(nowX - wasX) + Math.abs(nowY - wasY);
    expect(away).toBeGreaterThanOrEqual(1);
    expect(away).toBeLessThanOrEqual(3);
    const here = sectorAt(SIZE, next.ball.position);
    for (const sector of next.course.sectors) {
      const near = Math.abs(sector.sx - here.sx) <= 1 && Math.abs(sector.sy - here.sy) <= 1;
      const made = sectorKey(sector.sx, sector.sy) === next.course.cup?.sector;
      const onTheWay = Math.abs(sector.sx - wasX) + Math.abs(sector.sy - wasY) <= 3;
      expect(near || made || onTheWay).toBe(true);
    }
    expect(next.ball.spikes).toHaveLength(levelOf(next.course).spikes.length);
  });
});
