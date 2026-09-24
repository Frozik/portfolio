import { describe, expect, it } from 'vitest';

import { distanceBetweenSegments, distanceToSegment, sweepCircleAgainstWalls } from '../collision';
import {
  BALL_RADIUS_METERS,
  CELL_METERS,
  FLOATER_CLEARANCE_METERS,
  FLOATER_LARGE_SIDE_METERS,
  ROD_MAX_LENGTH_METERS,
  ROD_MIN_LENGTH_METERS,
} from '../constants';
import { rodPath, rodSeat, rodTipLength, rodWidth } from '../rods';
import { containsPoint } from '../walls';
import type { Sector, SectorRequest } from './generate-sector';
import { generateSector, sectorAt, sectorBounds, SECTOR_OVERHANG_CELLS } from './generate-sector';

const SIZE = { widthCells: 24, heightCells: 27 };
const SEEDS = [1, 2, 3];

function request(overrides: Partial<SectorRequest> = {}): SectorRequest {
  return {
    worldSeed: 1,
    epoch: 0,
    sx: 0,
    sy: 0,
    size: SIZE,
    neighbours: [],
    keepClear: [],
    withTee: false,
    ...overrides,
  };
}

function gapBetween(a: Sector, b: Sector): number {
  let nearest = Number.POSITIVE_INFINITY;
  for (const mine of a.cells) {
    for (const theirs of b.cells) {
      nearest = Math.min(
        nearest,
        Math.max(Math.abs(mine.x - theirs.x), Math.abs(mine.y - theirs.y))
      );
    }
  }
  return nearest;
}

describe('sectors of the plane', () => {
  it('tile it: a point belongs to one sector, negative ground included', () => {
    expect(sectorAt(SIZE, { x: 1, y: 1 })).toEqual({ sx: 0, sy: 0 });
    expect(sectorAt(SIZE, { x: -0.1, y: 13.6 })).toEqual({ sx: -1, sy: 1 });
    expect(sectorBounds(SIZE, -1, 1)).toEqual({ min: { x: -12, y: 13.5 }, max: { x: 0, y: 27 } });
  });
});

describe('generateSector', () => {
  it('is the same sector for the same world, epoch, place and neighbours, and another after a hole', () => {
    expect(generateSector(request())).toEqual(generateSector(request()));
    expect(generateSector(request({ epoch: 1 })).cells).not.toEqual(
      generateSector(request()).cells
    );
  });

  it('fills its ground with islands of many shapes that may reach a little into the sectors next door and no further', () => {
    for (const worldSeed of SEEDS) {
      const sector = generateSector(request({ worldSeed, sx: -2, sy: 3 }));
      const ground = sectorBounds(SIZE, -2, 3);
      const reach = SECTOR_OVERHANG_CELLS * CELL_METERS;

      expect(sector.walls.length).toBeGreaterThanOrEqual(4);
      expect(sector.walls.some(wall => wall.vertices.length >= 12)).toBe(true);
      for (const wall of sector.walls) {
        expect(wall.bounds.min.x).toBeGreaterThanOrEqual(ground.min.x - reach - 1e-9);
        expect(wall.bounds.min.y).toBeGreaterThanOrEqual(ground.min.y - reach - 1e-9);
        expect(wall.bounds.max.x).toBeLessThanOrEqual(ground.max.x + reach + 1e-9);
        expect(wall.bounds.max.y).toBeLessThanOrEqual(ground.max.y + reach + 1e-9);
      }
    }
  });

  it("keeps the islands' gap across the seam to a sector already standing next door, with no empty lane along the border", () => {
    for (const worldSeed of SEEDS) {
      const first = generateSector(request({ worldSeed }));
      const second = generateSector(request({ worldSeed, sx: 1, neighbours: [first] }));

      expect(gapBetween(first, second)).toBeGreaterThan(3);
      const border = sectorBounds(SIZE, 1, 0).min.x / CELL_METERS;
      const nearTheSeam = [...first.cells, ...second.cells].filter(
        cell => Math.abs(cell.x - border) <= 2
      );
      expect(nearTheSeam.length).toBeGreaterThan(0);
    }
  });

  it('grows nothing over the ball where it lies', () => {
    const ball = { x: 11.5, y: 6 };
    for (const worldSeed of SEEDS) {
      const beside = generateSector(request({ worldSeed, sx: 1, keepClear: [ball] }));

      expect(beside.walls.some(wall => containsPoint(wall, ball))).toBe(false);
      for (const wall of beside.walls) {
        for (const edge of wall.edges) {
          expect(distanceToSegment(ball, edge)).toBeGreaterThan(0.5);
        }
      }
    }
  });

  it('gives only the first sector of a world a tee, on flat floor with room to spare', () => {
    const SPARE_METERS = 0.1;
    expect(generateSector(request()).tee).toBeUndefined();
    for (let worldSeed = 1; worldSeed <= 30; worldSeed += 1) {
      const sector = generateSector(request({ worldSeed, withTee: true }));
      const tee = sector.tee ?? { x: 0, y: 0 };
      const support = sweepCircleAgainstWalls(
        sector.walls,
        tee,
        { x: tee.x, y: tee.y - 1 },
        BALL_RADIUS_METERS
      );

      expect(support?.kind, `seed ${worldSeed}`).toBe('floor');
      expect(support?.at, `seed ${worldSeed}`).toBe('face');
      const face = sector.walls[support?.wall ?? 0].edges[support?.edge ?? 0];
      expect(Math.min(face.from.x, face.to.x)).toBeLessThanOrEqual(
        tee.x - BALL_RADIUS_METERS - SPARE_METERS
      );
      expect(Math.max(face.from.x, face.to.x)).toBeGreaterThanOrEqual(
        tee.x + BALL_RADIUS_METERS + SPARE_METERS
      );
    }
  });

  it('stands spike rows on its own plain faces, floaters clear of every wall and of each other, and rods across clear gaps', () => {
    const kinds = new Set<string>();
    for (const worldSeed of SEEDS) {
      const first = generateSector(request({ worldSeed }));
      const sector = generateSector(request({ worldSeed, sx: 1, neighbours: [first] }));
      const walls = [...sector.walls, ...first.walls];

      for (const row of sector.spikes) {
        expect(row.teeth).toBeGreaterThanOrEqual(1);
        expect(row.teeth).toBeLessThanOrEqual(3);
        expect(
          sector.walls.some(wall =>
            wall.edges.some(
              edge => edge.kind === 'floor' && distanceToSegment(row.base.from, edge) < 1e-6
            )
          )
        ).toBe(true);
      }
      sector.floaters.forEach((floater, index) => {
        for (const wall of walls) {
          for (const edge of wall.edges) {
            expect(distanceToSegment(floater.center, edge)).toBeGreaterThanOrEqual(
              FLOATER_CLEARANCE_METERS
            );
          }
        }
        [...sector.floaters, ...first.floaters].forEach((other, otherIndex) => {
          if (other !== floater && otherIndex !== index) {
            expect(
              Math.hypot(floater.center.x - other.center.x, floater.center.y - other.center.y)
            ).toBeGreaterThanOrEqual(FLOATER_CLEARANCE_METERS - 1e-9);
          }
        });
      });
      for (const rod of sector.rods) {
        kinds.add(rod.kind);
        const gap = rod.length - rodTipLength(rod.kind);
        expect(gap).toBeGreaterThanOrEqual(ROD_MIN_LENGTH_METERS);
        expect(gap).toBeLessThanOrEqual(ROD_MAX_LENGTH_METERS);
        const middle = {
          x: rod.base.x + (rod.direction.x * gap) / 2,
          y: rod.base.y + (rod.direction.y * gap) / 2,
        };
        expect(walls.some(wall => containsPoint(wall, middle))).toBe(false);
      }
    }
    expect(kinds.size).toBeGreaterThan(0);
  });

  it("hands the neighbours' rods to what it places next, so nothing of a new sector is laid across a rod already standing next door", () => {
    // The rule itself is the placers' and is specified there; here only that a sector passes on what it was handed.
    const floaterReach = (FLOATER_LARGE_SIDE_METERS / 2) * Math.SQRT2;
    const standing: Sector[] = [];
    for (const sx of [0, 1]) {
      for (const sy of [0, 1]) {
        standing.push(generateSector(request({ worldSeed: 5, sx, sy, neighbours: [...standing] })));
      }
    }
    const rods = standing.flatMap(sector => sector.rods);
    const floaters = standing.flatMap(sector => sector.floaters);

    expect(rods.length).toBeGreaterThan(4);
    rods.forEach((rod, index) => {
      const path = rodPath(rod);
      for (const other of rods.slice(index + 1)) {
        const apart = rodWidth(rod.kind) / 2 + rodWidth(other.kind) / 2;
        expect(distanceBetweenSegments(path, rodPath(other))).toBeGreaterThanOrEqual(apart);
      }
      for (const floater of floaters) {
        expect(distanceToSegment(floater.center, path)).toBeGreaterThanOrEqual(
          floaterReach + rodWidth(rod.kind) / 2
        );
      }
    });
  });

  it('fastens every rod to islands of its own: it slides out of one and seats in one, so no rod is left in the air when the sector next door is made anew', () => {
    const onOwnFace = (sector: Sector, point: { x: number; y: number }): boolean =>
      sector.walls.some(wall =>
        wall.edges.some(edge => edge.kind === 'floor' && distanceToSegment(point, edge) < 1e-6)
      );
    let rods = 0;
    for (let worldSeed = 1; worldSeed <= 12; worldSeed += 1) {
      const standing: Sector[] = [];
      for (const [sx, sy] of [
        [0, 0],
        [1, 0],
        [0, 1],
        [1, 1],
      ]) {
        const sector = generateSector(request({ worldSeed, sx, sy, neighbours: standing }));
        for (const rod of sector.rods) {
          rods += 1;
          expect(onOwnFace(sector, rod.base)).toBe(true);
          expect(onOwnFace(sector, rodSeat(rod))).toBe(true);
        }
        standing.push(sector);
      }
    }
    expect(rods).toBeGreaterThan(0);
  });
});
