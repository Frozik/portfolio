import { describe, expect, it } from 'vitest';

import { createBall } from '../ball';
import { sweepCircleAgainstWalls } from '../collision';
import { BALL_RADIUS_METERS } from '../constants';
import { edgeOf } from '../level';
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

  it('is deterministic per seed', () => {
    expect(generateLevel(1)).toEqual(levelOf(1));
    expect(levelOf(2)).not.toEqual(levelOf(1));
  });

  it('starts the ball resting on a floor with nothing overlapping it', () => {
    for (const seed of SEEDS) {
      const level = levelOf(seed);
      const ball = createBall(level);
      const below = { x: ball.position.x, y: ball.position.y - 1 };

      const support = sweepCircleAgainstWalls(level, ball.position, below, BALL_RADIUS_METERS);

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
