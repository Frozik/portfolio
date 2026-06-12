import { describe, expect, it } from 'vitest';
import { IntersectionCache } from './intersection';
import type { FigureTopology, TopologyLine, Vec3Array } from './topology-types';

/** Squared distance threshold for asserting two points coincide in the tests. */
const POINT_MATCH_THRESHOLD_SQUARED = 1e-6;

/** A figure topology with no geometry, so intersections come purely from the lines under test. */
const EMPTY_TOPOLOGY: FigureTopology = {
  vertices: [],
  edges: [],
  faces: [],
  faceTriangles: [],
  figureFaceTriangles: [],
};

function makeLine(
  lineId: number,
  pointA: Vec3Array,
  pointB: Vec3Array,
  kind: TopologyLine['kind'] = 'line'
): TopologyLine {
  return {
    lineId,
    pointA,
    pointB,
    kind,
    isInput: false,
    startVertexId: -1,
    endVertexId: -1,
  };
}

function hasIntersectionNear(
  intersections: readonly { readonly position: Vec3Array }[],
  expected: Vec3Array
): boolean {
  return intersections.some(intersection => {
    const deltaX = intersection.position[0] - expected[0];
    const deltaY = intersection.position[1] - expected[1];
    const deltaZ = intersection.position[2] - expected[2];
    const distanceSquared = deltaX * deltaX + deltaY * deltaY + deltaZ * deltaZ;
    return distanceSquared < POINT_MATCH_THRESHOLD_SQUARED;
  });
}

describe('IntersectionCache', () => {
  it('keeps an unrelated intersection when removing a line whose key is a prefix-substring of another (mirrored coordinates)', () => {
    // Mirrored x coordinate: lineKey(removedLine) is a literal substring of
    // lineKey(survivingLine) — they differ only in the leading sign of the
    // first coordinate. The previous substring-based invalidation
    // (cacheKey.includes(removed)) would wrongly evict pairs touching the
    // surviving line. See domain/puzzles/puzzle-1.ts for real mirrored coords.
    const sharedPoint: Vec3Array = [1, 4, 5];

    // removedLine: pointA x = 0.293893 ; key = "0.293893,2...|1...|l"
    const removedLine = makeLine(1, [0.293893, 2, 3], sharedPoint);
    // survivingLine: pointA x = -0.293893 ; key = "-0.293893,2...|1...|l"
    // => lineKey(removedLine) is a substring of lineKey(survivingLine).
    const survivingLine = makeLine(2, [-0.293893, 2, 3], sharedPoint);
    // crossingLine intersects survivingLine at [-0.293893, 2, 3] (a vertical
    // probe through survivingLine's first endpoint), away from removedLine.
    const crossingLine = makeLine(3, [-0.293893, 2, 3], [-0.293893, 2, 4]);

    const expectedIntersection: Vec3Array = [-0.293893, 2, 3];

    const cache = new IntersectionCache();

    // First pass: all three lines present. The surviving × crossing
    // intersection must exist.
    const before = cache.compute([removedLine, survivingLine, crossingLine], EMPTY_TOPOLOGY);
    expect(hasIntersectionNear(before, expectedIntersection)).toBe(true);

    // Second pass: removedLine is gone. The surviving × crossing intersection
    // is unrelated to removedLine and must still be present. With the buggy
    // substring matching it would be evicted and never recomputed.
    const after = cache.compute([survivingLine, crossingLine], EMPTY_TOPOLOGY);
    expect(hasIntersectionNear(after, expectedIntersection)).toBe(true);
  });
});
