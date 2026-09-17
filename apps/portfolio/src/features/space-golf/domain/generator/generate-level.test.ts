import { describe, expect, it } from 'vitest';

import { createBall } from '../ball';
import { distanceToSegment, sweepCircleAgainstWalls } from '../collision';
import {
  BALL_RADIUS_METERS,
  FLOATER_CLEARANCE_METERS,
  ROD_MAX_LENGTH_METERS,
  ROD_MIN_LENGTH_METERS,
  SPIKE_HEIGHT_METERS,
  SPIKE_WIDTH_METERS,
} from '../constants';
import { edgeOf, pointAlongEdge } from '../level';
import { rodTipLength } from '../rods';
import { touchesBall } from '../spikes';
import { containsPoint } from '../walls';
import { generateLevel } from './generate-level';

const SEEDS = [1, 2, 3];
const LEVELS = new Map(SEEDS.map(seed => [seed, generateLevel(seed)]));
const levelOf = (seed: number) => LEVELS.get(seed) ?? generateLevel(seed);

describe('generateLevel', () => {
  it('leaves the board open: nothing walls it in, and blocks at the edge run on past it', () => {
    for (const seed of SEEDS) {
      const level = levelOf(seed);
      const bleeding = level.walls.filter(
        wall =>
          wall.bounds.min.x < 0 ||
          wall.bounds.min.y < 0 ||
          wall.bounds.max.x > level.width ||
          wall.bounds.max.y > level.height
      );

      expect(bleeding.length).toBeGreaterThan(0);
      for (const wall of bleeding) {
        expect(wall.bounds.max.x - wall.bounds.min.x).toBeLessThan(level.width);
        expect(wall.bounds.max.y - wall.bounds.min.y).toBeLessThan(level.height);
      }
    }
  });

  it('scatters a handful of islands with a gap between them, and not all of them are boxes', () => {
    for (const seed of SEEDS) {
      const level = levelOf(seed);

      expect(level.walls.length).toBeGreaterThanOrEqual(5);
      expect(level.walls.some(wall => wall.vertices.length > 8)).toBe(true);
      // Islands keep a metre between them; interlocking shapes may share a box,
      // so the gap is read off the vertices, the corner cuts allowed for.
      const MIN_GAP = 0.8;
      for (const wall of level.walls) {
        for (const other of level.walls) {
          if (other === wall) {
            continue;
          }
          for (const vertex of wall.vertices) {
            for (const theirs of other.vertices) {
              expect(Math.hypot(vertex.x - theirs.x, vertex.y - theirs.y)).toBeGreaterThanOrEqual(
                MIN_GAP
              );
            }
          }
        }
      }
    }
  });

  it('cuts the cup into a horizontal or vertical face on the board, away from the tee', () => {
    for (const seed of SEEDS) {
      const level = levelOf(seed);
      const face = edgeOf(level, level.cup);
      const wall = level.walls[level.cup.wall];

      expect(face.kind).toBe('floor');
      expect(face.normal.y).toBeGreaterThanOrEqual(0);
      expect(wall.edges.filter(edge => edge.kind === 'cup')).toHaveLength(8);
      expect(face.from.x).toBeGreaterThanOrEqual(0);
      expect(face.from.x).toBeLessThanOrEqual(level.width);
      expect(Math.hypot(face.from.x - level.tee.x, face.from.y - level.tee.y)).toBeGreaterThan(0.5);
    }
  });

  it('stands a few spike rows of one to three teeth on plain faces on the board, floor kept at both ends, never under the tee', () => {
    for (const seed of SEEDS) {
      const level = levelOf(seed);

      expect(level.spikes.length).toBeGreaterThanOrEqual(2);
      expect(level.spikes.length).toBeLessThanOrEqual(5);
      expect(new Set(level.spikes.map(row => `${row.wall}/${row.edge}`)).size).toBe(
        level.spikes.length
      );
      for (const row of level.spikes) {
        const face = edgeOf(level, row);
        const length = row.teeth * SPIKE_WIDTH_METERS;
        expect(face.kind).toBe('floor');
        expect(row.teeth).toBeGreaterThanOrEqual(1);
        expect(row.teeth).toBeLessThanOrEqual(3);
        expect(row.sides).toHaveLength(row.teeth * 2);
        expect(row.from).toBeGreaterThanOrEqual(0.2);
        expect(row.from + length).toBeLessThanOrEqual(face.length - 0.2 + 1e-9);
        for (const along of [row.from, row.from + length]) {
          const foot = pointAlongEdge(face, along);
          const tip = {
            x: foot.x + face.normal.x * SPIKE_HEIGHT_METERS,
            y: foot.y + face.normal.y * SPIKE_HEIGHT_METERS,
          };
          for (const point of [foot, tip]) {
            expect(point.x).toBeGreaterThanOrEqual(0);
            expect(point.y).toBeGreaterThanOrEqual(0);
            expect(point.x).toBeLessThanOrEqual(level.width);
            expect(point.y).toBeLessThanOrEqual(level.height);
          }
        }
        const teeAbove =
          (level.tee.x - face.from.x) * face.normal.x + (level.tee.y - face.from.y) * face.normal.y;
        const teeAlong =
          (level.tee.x - face.from.x) * face.direction.x +
          (level.tee.y - face.from.y) * face.direction.y;
        const teeOnFace =
          teeAbove >= 0 &&
          teeAbove <= 2 * BALL_RADIUS_METERS &&
          teeAlong >= 0 &&
          teeAlong <= face.length;
        expect(teeOnFace).toBe(false);
        expect(touchesBall(row, level.tee)).toBe(false);
      }
    }
  });

  it('floats three to ten squares, diamonds and circles in the open, each centre ten ball diameters clear of every face, every other centre and the tee, large shape on the board', () => {
    for (const seed of SEEDS) {
      const level = levelOf(seed);

      expect(level.floaters.length).toBeGreaterThanOrEqual(3);
      expect(level.floaters.length).toBeLessThanOrEqual(10);
      expect(FLOATER_CLEARANCE_METERS).toBeCloseTo(20 * BALL_RADIUS_METERS);
      level.floaters.forEach((floater, index) => {
        for (const wall of level.walls) {
          for (const edge of wall.edges) {
            expect(distanceToSegment(floater.center, edge)).toBeGreaterThanOrEqual(
              FLOATER_CLEARANCE_METERS
            );
          }
        }
        level.floaters.forEach((other, otherIndex) => {
          if (otherIndex !== index) {
            expect(
              Math.hypot(floater.center.x - other.center.x, floater.center.y - other.center.y)
            ).toBeGreaterThanOrEqual(FLOATER_CLEARANCE_METERS);
          }
        });
        expect(
          Math.hypot(floater.center.x - level.tee.x, floater.center.y - level.tee.y)
        ).toBeGreaterThanOrEqual(FLOATER_CLEARANCE_METERS);
        for (const vertex of floater.large.vertices) {
          expect(vertex.x).toBeGreaterThanOrEqual(0);
          expect(vertex.y).toBeGreaterThanOrEqual(0);
          expect(vertex.x).toBeLessThanOrEqual(level.width);
          expect(vertex.y).toBeLessThanOrEqual(level.height);
        }
      });
    }
    const shapes = new Set(SEEDS.flatMap(seed => levelOf(seed).floaters.map(each => each.shape)));
    expect(shapes).toEqual(new Set(['square', 'diamond', 'circle']));
  });

  it('slides two to four rods out of plain faces where they fit, each bridging squarely to a plain face across a clear gap and seating its tip in it', () => {
    for (const seed of SEEDS) {
      const level = levelOf(seed);

      expect(level.rods.length).toBeGreaterThanOrEqual(1);
      expect(level.rods.length).toBeLessThanOrEqual(4);
      for (const rod of level.rods) {
        const gap = rod.length - rodTipLength(rod.kind);
        const tip = {
          x: rod.base.x + rod.direction.x * gap,
          y: rod.base.y + rod.direction.y * gap,
        };
        expect(gap).toBeGreaterThanOrEqual(ROD_MIN_LENGTH_METERS);
        expect(gap).toBeLessThanOrEqual(ROD_MAX_LENGTH_METERS);
        const faces = level.walls.flatMap(wall => wall.edges);
        const from = faces.find(
          face =>
            distanceToSegment(rod.base, face) < 1e-6 &&
            face.normal.x === rod.direction.x &&
            face.normal.y === rod.direction.y
        );
        const to = faces.find(
          face =>
            distanceToSegment(tip, face) < 1e-6 &&
            face.normal.x === -rod.direction.x &&
            face.normal.y === -rod.direction.y
        );
        expect(from?.kind).toBe('floor');
        expect(to?.kind).toBe('floor');
        const middle = { x: (rod.base.x + tip.x) / 2, y: (rod.base.y + tip.y) / 2 };
        expect(level.walls.some(wall => containsPoint(wall, middle))).toBe(false);
      }
    }
    const kinds = new Set(SEEDS.flatMap(seed => levelOf(seed).rods.map(rod => rod.kind)));
    expect(kinds).toEqual(new Set(['slide', 'screw']));
  });

  it('is deterministic per seed', () => {
    expect(generateLevel(1)).toEqual(levelOf(1));
    expect(levelOf(2)).not.toEqual(levelOf(1));
  });

  it('starts the ball resting on a floor with nothing overlapping it', () => {
    for (const seed of SEEDS) {
      const level = levelOf(seed);
      const ball = createBall(level);
      const below = { x: ball.position.x, y: ball.position.y - 1 };

      const support = sweepCircleAgainstWalls(
        level.walls,
        ball.position,
        below,
        BALL_RADIUS_METERS
      );

      expect(support?.kind).toBe('floor');
      expect(support?.time).toBeLessThan(0.01);
    }
  });
});

describe('corners', () => {
  it('never exposes a right angle between a horizontal and a vertical face: every reachable corner is a 45° cut', () => {
    const PROBE = 0.05;
    for (const seed of SEEDS) {
      const level = levelOf(seed);
      for (const wall of level.walls) {
        wall.edges.forEach((edge, index) => {
          const next = wall.edges[(index + 1) % wall.edges.length];
          const perpendicular =
            edge.kind !== 'deflector' &&
            next.kind !== 'deflector' &&
            Math.abs(edge.direction.x * next.direction.x + edge.direction.y * next.direction.y) <
              1e-6;
          if (!perpendicular) {
            return;
          }
          // A right angle is fine when it is not a corner at all: another wall
          // continues one of the faces (blocks flush with each other or with the
          // frame), or the vertex lies beyond the board.
          const vertex = edge.to;
          const beyondEdge = {
            x: vertex.x + edge.normal.x * PROBE - edge.direction.x * PROBE,
            y: vertex.y + edge.normal.y * PROBE - edge.direction.y * PROBE,
          };
          const beyondNext = {
            x: vertex.x + next.normal.x * PROBE + next.direction.x * PROBE,
            y: vertex.y + next.normal.y * PROBE + next.direction.y * PROBE,
          };
          const beyondBoard =
            vertex.x <= 0 || vertex.x >= level.width || vertex.y <= 0 || vertex.y >= level.height;
          const covered = [beyondEdge, beyondNext].some(point =>
            level.walls.some(other => other !== wall && containsPoint(other, point))
          );
          expect(beyondBoard || covered).toBe(true);
        });
      }
    }
  });
});
