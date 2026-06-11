import { describe, expect, it } from 'vitest';

import { NO_CONNECTED_VERTEX_INDEX } from './constants';
import type { RenderSegment } from './render-types';
import { mergeCollinearSegments } from './segment-merge';
import type { Vec3Array } from './topology-types';

function createSegment(overrides: Partial<RenderSegment> = {}): RenderSegment {
  return {
    startPosition: [0, 0, 0],
    endPosition: [1, 0, 0],
    lineId: 1,
    modifiers: [],
    startVertexIndex: NO_CONNECTED_VERTEX_INDEX,
    endVertexIndex: NO_CONNECTED_VERTEX_INDEX,
    ...overrides,
  };
}

function collinearChain(points: readonly Vec3Array[], lineId = 1): RenderSegment[] {
  const segments: RenderSegment[] = [];
  for (let index = 0; index < points.length - 1; index++) {
    segments.push(
      createSegment({ startPosition: points[index], endPosition: points[index + 1], lineId })
    );
  }
  return segments;
}

describe('mergeCollinearSegments', () => {
  it('returns input untouched for empty and single-segment lists', () => {
    expect(mergeCollinearSegments([])).toEqual([]);

    const single = [createSegment()];
    expect(mergeCollinearSegments(single)).toEqual(single);
  });

  it('merges a chain of three collinear segments into one', () => {
    const segments = collinearChain([
      [0, 0, 0],
      [1, 0, 0],
      [2, 0, 0],
      [3, 0, 0],
    ]);

    const merged = mergeCollinearSegments(segments);

    expect(merged).toHaveLength(1);
    expect(merged[0].startPosition).toEqual([0, 0, 0]);
    expect(merged[0].endPosition).toEqual([3, 0, 0]);
  });

  it('merges in both directions when the seed sits mid-chain (any input order)', () => {
    const chain = collinearChain([
      [0, 0, 0],
      [1, 0, 0],
      [2, 0, 0],
      [3, 0, 0],
      [4, 0, 0],
    ]);
    // Middle segment first so the walk has to extend both ways
    const shuffled = [chain[2], chain[0], chain[4 - 1], chain[1]];

    const merged = mergeCollinearSegments(shuffled);

    expect(merged).toHaveLength(1);
    const [start, end] = [merged[0].startPosition, merged[0].endPosition].sort(
      (positionA, positionB) => positionA[0] - positionB[0]
    );
    expect(start).toEqual([0, 0, 0]);
    expect(end).toEqual([4, 0, 0]);
  });

  it('preserves outer vertex indices of the chain ends', () => {
    const first = createSegment({
      startPosition: [0, 0, 0],
      endPosition: [1, 0, 0],
      startVertexIndex: 7,
    });
    const second = createSegment({
      startPosition: [1, 0, 0],
      endPosition: [2, 0, 0],
      endVertexIndex: 9,
    });

    const merged = mergeCollinearSegments([first, second]);

    expect(merged).toHaveLength(1);
    expect(merged[0].startVertexIndex).toBe(7);
    expect(merged[0].endVertexIndex).toBe(9);
  });

  it('does not merge across a junction occupied by a scene vertex', () => {
    const first = createSegment({
      startPosition: [0, 0, 0],
      endPosition: [1, 0, 0],
      endVertexIndex: 4,
    });
    const second = createSegment({
      startPosition: [1, 0, 0],
      endPosition: [2, 0, 0],
      startVertexIndex: 4,
    });

    expect(mergeCollinearSegments([first, second])).toHaveLength(2);
  });

  it('does not merge segments with different modifiers', () => {
    const first = createSegment({ endPosition: [1, 0, 0], modifiers: ['inner'] });
    const second = createSegment({ startPosition: [1, 0, 0], endPosition: [2, 0, 0] });

    expect(mergeCollinearSegments([first, second])).toHaveLength(2);
  });

  it('treats modifier order as irrelevant', () => {
    const first = createSegment({ endPosition: [1, 0, 0], modifiers: ['input', 'segment'] });
    const second = createSegment({
      startPosition: [1, 0, 0],
      endPosition: [2, 0, 0],
      modifiers: ['segment', 'input'],
    });

    expect(mergeCollinearSegments([first, second])).toHaveLength(1);
  });

  it('does not merge segments belonging to different lines', () => {
    const first = createSegment({ endPosition: [1, 0, 0], lineId: 1 });
    const second = createSegment({ startPosition: [1, 0, 0], endPosition: [2, 0, 0], lineId: 2 });

    expect(mergeCollinearSegments([first, second])).toHaveLength(2);
  });

  it('merges start-to-start oriented segments by flipping one of them', () => {
    // Both segments start at the shared point and run in opposite directions —
    // together they form one straight line
    const first = createSegment({
      startPosition: [1, 0, 0],
      endPosition: [0, 0, 0],
      endVertexIndex: 3,
    });
    const second = createSegment({
      startPosition: [1, 0, 0],
      endPosition: [2, 0, 0],
      endVertexIndex: 5,
    });

    const merged = mergeCollinearSegments([first, second]);

    expect(merged).toHaveLength(1);
    const xs = [merged[0].startPosition[0], merged[0].endPosition[0]].sort();
    expect(xs).toEqual([0, 2]);
    const vertexIndexes = [merged[0].startVertexIndex, merged[0].endVertexIndex].sort();
    expect(vertexIndexes).toEqual([3, 5]);
  });

  it('does not merge non-collinear segments sharing a point', () => {
    const first = createSegment({ endPosition: [1, 0, 0] });
    const second = createSegment({ startPosition: [1, 0, 0], endPosition: [1, 1, 0] });

    expect(mergeCollinearSegments([first, second])).toHaveLength(2);
  });

  it('merges end-to-end oriented segments (shared point is the end of both)', () => {
    const first = createSegment({ startPosition: [0, 0, 0], endPosition: [1, 0, 0] });
    const second = createSegment({ startPosition: [2, 0, 0], endPosition: [1, 0, 0] });

    const merged = mergeCollinearSegments([first, second]);

    // Orientation differs but the union is still one straight chain — must merge
    expect(merged).toHaveLength(1);
    const xs = [merged[0].startPosition[0], merged[0].endPosition[0]].sort();
    expect(xs).toEqual([0, 2]);
  });

  it('does not merge at a T-junction where three segment endpoints meet', () => {
    const first = createSegment({ startPosition: [0, 0, 0], endPosition: [1, 0, 0] });
    const second = createSegment({ startPosition: [1, 0, 0], endPosition: [2, 0, 0] });
    const branch = createSegment({ startPosition: [1, 0, 0], endPosition: [1, 1, 0] });

    expect(mergeCollinearSegments([first, second, branch])).toHaveLength(3);
  });

  it('ignores zero-length segments instead of merging through them', () => {
    const degenerate = createSegment({ startPosition: [1, 0, 0], endPosition: [1, 0, 0] });
    const regular = createSegment({ startPosition: [0, 0, 0], endPosition: [1, 0, 0] });

    expect(mergeCollinearSegments([degenerate, regular])).toHaveLength(2);
  });

  it('merges independent chains within one group separately', () => {
    const chainA = collinearChain([
      [0, 0, 0],
      [1, 0, 0],
      [2, 0, 0],
    ]);
    const chainB = collinearChain([
      [0, 5, 0],
      [1, 5, 0],
      [2, 5, 0],
    ]);

    const merged = mergeCollinearSegments([...chainA, ...chainB]);

    expect(merged).toHaveLength(2);
  });
});
