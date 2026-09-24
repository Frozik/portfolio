import { describe, expect, it } from 'vitest';

import {
  distanceBetweenSegments,
  sweepCircleAgainstSegment,
  sweepCircleAgainstWalls,
} from './collision';
import { createTestLevel } from './test-level';

const RADIUS = 0.1;
const FLOOR = {
  from: { x: 0, y: 0 },
  to: { x: 10, y: 0 },
  direction: { x: 1, y: 0 },
  normal: { x: 0, y: 1 },
  length: 10,
};

describe('sweepCircleAgainstSegment', () => {
  it('finds where a falling circle meets the face, radius included', () => {
    const hit = sweepCircleAgainstSegment({ x: 5, y: 1.1 }, { x: 5, y: -0.9 }, RADIUS, FLOOR);

    expect(hit?.at).toBe('face');
    expect(hit?.time).toBeCloseTo(0.5);
    expect(hit?.normal).toEqual({ x: 0, y: 1 });
  });

  it('ignores motion away from the face and motion past its end', () => {
    expect(
      sweepCircleAgainstSegment({ x: 5, y: 0.1 }, { x: 5, y: 2 }, RADIUS, FLOOR)
    ).toBeUndefined();
    expect(
      sweepCircleAgainstSegment({ x: 12, y: 1 }, { x: 12, y: -1 }, RADIUS, FLOOR)
    ).toBeUndefined();
  });

  it('rounds the ends: a circle clipping the corner gets the corner normal', () => {
    const hit = sweepCircleAgainstSegment({ x: 10.05, y: 1 }, { x: 10.05, y: -1 }, RADIUS, FLOOR);

    expect(hit?.at).toBe('corner');
    expect(hit?.normal.x).toBeGreaterThan(0);
    expect(hit?.normal.y).toBeGreaterThan(0);
  });

  it('reports a contact at time zero for a circle already resting on the face', () => {
    const hit = sweepCircleAgainstSegment({ x: 5, y: 0.1 }, { x: 5, y: 0.09 }, RADIUS, FLOOR);

    expect(hit?.time).toBe(0);
  });
});

describe('sweepCircleAgainstWalls', () => {
  it('returns the earliest face across every wall with its kind', () => {
    const level = createTestLevel();

    const hit = sweepCircleAgainstWalls(level.walls, { x: 1, y: 3 }, { x: 8, y: 3 }, RADIUS);

    expect(hit?.wall).toBe(4);
    expect(hit?.kind).toBe('floor');
    expect(hit?.normal).toEqual({ x: -1, y: 0 });
  });
});

describe('distanceBetweenSegments', () => {
  const segment = (from: { x: number; y: number }, to: { x: number; y: number }) => {
    const length = Math.hypot(to.x - from.x, to.y - from.y);
    const direction = { x: (to.x - from.x) / length, y: (to.y - from.y) / length };
    return { from, to, direction, normal: { x: direction.y, y: -direction.x }, length };
  };

  it('is nothing for two segments that cross, though every end of each is far from the other', () => {
    const across = segment({ x: -5, y: 0 }, { x: 5, y: 0 });
    const upright = segment({ x: 0, y: -5 }, { x: 0, y: 5 });

    expect(distanceBetweenSegments(across, upright)).toBe(0);
  });

  it('is the gap between two that run side by side, and the nearest ends of two that do not cross', () => {
    const low = segment({ x: 0, y: 0 }, { x: 10, y: 0 });
    const high = segment({ x: 2, y: 3 }, { x: 8, y: 3 });
    const beyond = segment({ x: 12, y: 1 }, { x: 20, y: 5 });

    expect(distanceBetweenSegments(low, high)).toBeCloseTo(3);
    expect(distanceBetweenSegments(low, beyond)).toBeCloseTo(Math.hypot(2, 1));
    expect(distanceBetweenSegments(beyond, low)).toBeCloseTo(Math.hypot(2, 1));
  });

  it('is nothing for two that merely touch, end on the other', () => {
    const along = segment({ x: 0, y: 0 }, { x: 10, y: 0 });
    const touching = segment({ x: 5, y: 0 }, { x: 5, y: 4 });

    expect(distanceBetweenSegments(along, touching)).toBe(0);
  });
});
