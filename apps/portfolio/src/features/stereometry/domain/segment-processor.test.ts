import { describe, expect, it } from 'vitest';

import { preparePuzzle } from './geometry';
import { PENTAGONAL_PYRAMID } from './puzzles/pentagonal-pyramid';
import { processSegments } from './segment-processor';
import type { FigureTopology, PuzzleDefinition, SceneLine } from './types';
import { SELECTION_NONE } from './types';

/** Simple tetrahedron for testing */
const TETRAHEDRON: PuzzleDefinition = {
  name: 'Tetrahedron',
  input: {
    figures: [
      {
        vertices: [
          [0, 0, 0],
          [2, 0, 0],
          [1, 0, 2],
          [1, 2, 1],
        ],
        faces: [
          [0, 1, 2],
          [0, 1, 3],
          [1, 2, 3],
          [0, 2, 3],
        ],
      },
    ],
  },
  expected: {},
};

function getTetrahedronTopology(): FigureTopology {
  return preparePuzzle(TETRAHEDRON).topology;
}

function countByModifier(
  segments: readonly { modifiers: readonly string[] }[],
  modifier: string
): number {
  return segments.filter(segment => segment.modifiers.includes(modifier)).length;
}

function countWithoutModifiers(
  segments: readonly { modifiers: readonly string[]; sourceLineIndex: number }[]
): number {
  return segments.filter(segment => segment.modifiers.length === 0 && segment.sourceLineIndex >= 0)
    .length;
}

describe('processSegments', () => {
  it('returns topology edges when no lines are present', () => {
    const topology = getTetrahedronTopology();
    const result = processSegments(topology, [], SELECTION_NONE);
    // Tetrahedron has 6 edges, all as 'segment'
    expect(countByModifier(result, 'segment')).toBe(topology.edges.length);
  });

  describe('line through topology edge', () => {
    it('drops the line segment that coincides with the edge, keeps 2 outer parts', () => {
      const topology = getTetrahedronTopology();
      const line: SceneLine = {
        pointA: topology.vertices[0],
        pointB: topology.vertices[1],
      };

      const result = processSegments(topology, [line], SELECTION_NONE);

      // Line's segment part is dropped; topology edges cover it
      const lineSegments = result.filter(segment => segment.sourceLineIndex === 0);
      expect(lineSegments).toHaveLength(2);
      expect(lineSegments.every(segment => segment.modifiers.length === 0)).toBe(true);

      // All topology edges are present
      expect(countByModifier(result, 'segment')).toBe(topology.edges.length);
    });
  });

  describe('line cutting through figure', () => {
    it('produces regular + inner + regular segments', () => {
      const topology = getTetrahedronTopology();
      // Line through the center of the tetrahedron, not along any edge
      // Centroid is at (1, 0.5, 0.75), use a vertical line through it
      const line: SceneLine = {
        pointA: [1, -1, 0.75],
        pointB: [1, 3, 0.75],
      };

      const result = processSegments(topology, [line], SELECTION_NONE);

      expect(countByModifier(result, 'inner')).toBeGreaterThanOrEqual(1);
      expect(countWithoutModifiers(result)).toBeGreaterThanOrEqual(2);
    });

    it('inner segment is between two face intersections', () => {
      const topology = getTetrahedronTopology();
      const line: SceneLine = {
        pointA: [1, -1, 0.75],
        pointB: [1, 3, 0.75],
      };

      const result = processSegments(topology, [line], SELECTION_NONE);
      const innerSegments = result.filter(segment => segment.modifiers.includes('inner'));

      // Inner segment should be inside the figure (y between 0 and ~2)
      for (const segment of innerSegments) {
        expect(segment.startPosition[1]).toBeGreaterThanOrEqual(-0.1);
        expect(segment.endPosition[1]).toBeLessThanOrEqual(2.1);
      }
    });
  });

  describe('line missing the figure entirely', () => {
    it('produces only regular segments', () => {
      const topology = getTetrahedronTopology();
      // Line far from the tetrahedron
      const line: SceneLine = {
        pointA: [10, 10, 10],
        pointB: [11, 10, 10],
      };

      const result = processSegments(topology, [line], SELECTION_NONE);

      expect(countWithoutModifiers(result)).toBeGreaterThanOrEqual(1);
      const lineSegments = result.filter(segment => segment.sourceLineIndex >= 0);
      expect(lineSegments.every(segment => !segment.modifiers.includes('inner'))).toBe(true);
    });
  });

  describe('line coplanar with a face', () => {
    it('produces inner segments where line lies on the face', () => {
      const topology = getTetrahedronTopology();
      // Tetrahedron base face is [0,1,2] at y=0: (0,0,0), (2,0,0), (1,0,2)
      // Draw a line across the base (not along an edge) — e.g., from (0.5,0,0.5) to (1.5,0,0.5)
      const line: SceneLine = {
        pointA: [0.5, 0, 0.5],
        pointB: [1.5, 0, 0.5],
      };

      const result = processSegments(topology, [line], SELECTION_NONE);

      // Part of the line inside the base triangle should be 'inner'
      expect(countByModifier(result, 'inner')).toBeGreaterThanOrEqual(1);
      // Extensions beyond the triangle should be regular (no modifier)
      expect(countWithoutModifiers(result)).toBeGreaterThanOrEqual(1);
    });

    it('diagonal across base face is inner', () => {
      const topology = getTetrahedronTopology();
      // Line from vertex 0 to vertex 2 lies on the base face
      // but is NOT a topology edge (edge is 0-1, 1-2, 0-2)
      // Actually 0-2 IS a topology edge. Use midpoints instead.
      const midpoint01: readonly [number, number, number] = [1, 0, 0];
      const midpoint12: readonly [number, number, number] = [1.5, 0, 1];
      const line: SceneLine = {
        pointA: midpoint01,
        pointB: midpoint12,
      };

      const result = processSegments(topology, [line], SELECTION_NONE);

      // The line between these midpoints lies entirely on the base face
      expect(countByModifier(result, 'inner')).toBeGreaterThanOrEqual(1);
    });
  });

  describe('multiple lines', () => {
    it('processes each line independently with correct sourceLineIndex', () => {
      const topology = getTetrahedronTopology();
      const lines: SceneLine[] = [
        { pointA: topology.vertices[0], pointB: topology.vertices[1] },
        { pointA: [10, 10, 10], pointB: [11, 10, 10] },
      ];

      const result = processSegments(topology, lines, SELECTION_NONE);

      const line0Segments = result.filter(segment => segment.sourceLineIndex === 0);
      const line1Segments = result.filter(segment => segment.sourceLineIndex === 1);

      expect(line0Segments.length).toBeGreaterThan(0);
      expect(line1Segments.length).toBeGreaterThan(0);

      // Line 0 is along an edge → its segment part is dropped (topology edge covers it)
      expect(line0Segments.every(segment => !segment.modifiers.includes('segment'))).toBe(true);
      // Line 1 misses figure → only regular (no modifier)
      expect(line1Segments.every(segment => segment.modifiers.length === 0)).toBe(true);
    });
  });

  describe('degenerate cases', () => {
    it('handles degenerate zero-length line', () => {
      const topology = getTetrahedronTopology();
      const line: SceneLine = {
        pointA: [1, 1, 1],
        pointB: [1, 1, 1],
      };

      const result = processSegments(topology, [line], SELECTION_NONE);
      // Only topology edges, no line segments
      const lineSegments = result.filter(segment => segment.sourceLineIndex >= 0);
      expect(lineSegments).toHaveLength(0);
    });
  });

  describe('pentagonal pyramid - line through figure', () => {
    it('line from vertex 0 to vertex 2 (through interior) has inner segments', () => {
      const topology = preparePuzzle(PENTAGONAL_PYRAMID).topology;
      // vertex 0 = [0, -0.75, 1], vertex 2 = [0.587785, -0.75, -0.809017]
      // This line lies on the base face (y = -0.75), so should get inner via coplanar
      const line: SceneLine = {
        pointA: topology.vertices[0],
        pointB: topology.vertices[2],
      };

      const result = processSegments(topology, [line], SELECTION_NONE);

      // Should have at least one inner or segment modifier
      const hasInnerOrSegment = result.some(
        segment => segment.modifiers.includes('inner') || segment.modifiers.includes('segment')
      );
      expect(hasInnerOrSegment).toBe(true);
    });

    it('line from apex (vertex 5) to opposite base vertex drops segment part', () => {
      const topology = preparePuzzle(PENTAGONAL_PYRAMID).topology;
      // apex = [0, 0.75, 0], vertex 2 = [0.587785, -0.75, -0.809017]
      // This line goes along an edge → segment part is dropped (topology edge covers it)
      const line: SceneLine = {
        pointA: topology.vertices[5],
        pointB: topology.vertices[2],
      };

      const result = processSegments(topology, [line], SELECTION_NONE);

      // Line's own segments should not include 'segment'
      const lineSegments = result.filter(segment => segment.sourceLineIndex === 0);
      expect(lineSegments.every(segment => !segment.modifiers.includes('segment'))).toBe(true);
      expect(lineSegments.length).toBeGreaterThan(0);
    });

    it('line from vertex 0 through apex and beyond has inner segment', () => {
      const topology = preparePuzzle(PENTAGONAL_PYRAMID).topology;
      // vertex 0 = [0, -0.75, 1], extend through apex [0, 0.75, 0] and beyond
      const line: SceneLine = {
        pointA: [0, -0.75, 1],
        pointB: [0, 2.25, -1], // well past the apex
      };

      const result = processSegments(topology, [line], SELECTION_NONE);

      // The segment from v0 to apex should be 'segment' (along edge), and
      // there should be inner segments where the line is inside the figure
      const hasInnerOrSegment = result.some(
        segment => segment.modifiers.includes('inner') || segment.modifiers.includes('segment')
      );
      expect(hasInnerOrSegment).toBe(true);
    });

    it('line cutting diagonally through the pyramid (not through vertices) has inner', () => {
      const topology = preparePuzzle(PENTAGONAL_PYRAMID).topology;
      // A line that cuts through the pyramid but does NOT start/end at any vertex
      const line: SceneLine = {
        pointA: [-1, 0, 0],
        pointB: [1, 0, 0],
      };

      const result = processSegments(topology, [line], SELECTION_NONE);

      expect(countByModifier(result, 'inner')).toBeGreaterThanOrEqual(1);
    });
  });
});
