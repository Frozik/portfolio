import { describe, expect, it } from 'vitest';

import { createBall } from '../ball';
import { sweepCircleAgainstWalls } from '../collision';
import { BALL_RADIUS_METERS } from '../constants';
import { edgeOf } from '../level';
import { containsPoint } from '../walls';
import { generateLevel } from './generate-level';
import { replay, solve } from './solver';

const SEEDS = [1, 2, 3];
const LEVELS = new Map(SEEDS.map(seed => [seed, generateLevel(seed)]));
const levelOf = (seed: number) => LEVELS.get(seed) ?? generateLevel(seed);
/** Each seed runs the solver, which plays thousands of strokes. */
const HEAVY_TEST_TIMEOUT_MS = 60_000;

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

  it('floats the pickups in open space, clear of every wall', () => {
    for (const seed of SEEDS) {
      const level = levelOf(seed);

      expect(level.pickups.length).toBeGreaterThan(0);
      for (const pickup of level.pickups) {
        expect(level.walls.some(wall => containsPoint(wall, pickup.position))).toBe(false);
        expect(pickup.position.x).toBeGreaterThan(0);
        expect(pickup.position.x).toBeLessThan(level.width);
      }
    }
  });

  it('makes the thin bars elastic on every straight face', () => {
    const bars = SEEDS.flatMap(seed =>
      levelOf(seed).walls.filter(wall => wall.edges.some(edge => edge.kind === 'bounce'))
    ).filter(wall => wall.edges.every(edge => edge.kind !== 'floor'));

    expect(bars.length).toBeGreaterThan(0);
    for (const bar of bars) {
      const { min, max } = bar.bounds;
      expect(Math.min(max.x - min.x, max.y - min.y)).toBeCloseTo(0.12, 5);
    }
  });

  it(
    'is deterministic per seed',
    () => {
      expect(generateLevel(1)).toEqual(levelOf(1));
      expect(levelOf(2)).not.toEqual(levelOf(1));
    },
    HEAVY_TEST_TIMEOUT_MS
  );

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

  it('cuts the cup into a horizontal or vertical face', () => {
    for (const seed of SEEDS) {
      const level = levelOf(seed);
      const wall = level.walls[level.cup.wall];

      expect(edgeOf(level, level.cup).kind).not.toBe('deflector');
      expect(wall.edges.filter(edge => edge.kind === 'cup')).toHaveLength(8);
    }
  });

  it(
    'is playable by its own physics within par',
    () => {
      for (const seed of SEEDS) {
        const level = levelOf(seed);
        const solution = solve(level);

        expect(level.par).toBeGreaterThanOrEqual(2);
        expect(level.par).toBeLessThanOrEqual(6);
        expect(solution).toBeDefined();
        expect(solution && replay(level, solution)).toBe(true);
      }
    },
    HEAVY_TEST_TIMEOUT_MS
  );
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
