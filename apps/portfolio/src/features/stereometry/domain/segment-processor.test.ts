import { describe, expect, it } from 'vitest';

import { preparePuzzle } from './geometry';
import { PENTAGONAL_PYRAMID } from './puzzles/pentagonal-pyramid';
import { processSegments } from './segment-processor';
import type { FigureTopology, PuzzleDefinition, SceneLine } from './types';

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
  segments: readonly { modifier?: string }[],
  modifier: string | undefined
): number {
  return segments.filter(segment => segment.modifier === modifier).length;
}

describe('processSegments', () => {
  it('returns empty for no lines', () => {
    const topology = getTetrahedronTopology();
    const result = processSegments(topology, []);
    expect(result).toHaveLength(0);
  });

  describe('line through topology edge', () => {
    it('produces segment + 2 regular segments', () => {
      const topology = getTetrahedronTopology();
      // Line through edge 0-1
      const line: SceneLine = {
        pointA: topology.vertices[0],
        pointB: topology.vertices[1],
      };

      const result = processSegments(topology, [line]);

      expect(countByModifier(result, 'segment')).toBe(1);
      expect(countByModifier(result, undefined)).toBe(2);
      expect(countByModifier(result, 'inner')).toBe(0);
    });

    it('segment portion matches edge endpoints', () => {
      const topology = getTetrahedronTopology();
      const line: SceneLine = {
        pointA: topology.vertices[0],
        pointB: topology.vertices[1],
      };

      const result = processSegments(topology, [line]);
      const segmentParts = result.filter(segment => segment.modifier === 'segment');

      expect(segmentParts).toHaveLength(1);
      // Segment should span approximately from vertex 0 to vertex 1
      const segmentPart = segmentParts[0];
      const startDist = Math.sqrt(
        (segmentPart.startPosition[0] - 0) ** 2 +
          (segmentPart.startPosition[1] - 0) ** 2 +
          (segmentPart.startPosition[2] - 0) ** 2
      );
      const endDist = Math.sqrt(
        (segmentPart.endPosition[0] - 2) ** 2 +
          (segmentPart.endPosition[1] - 0) ** 2 +
          (segmentPart.endPosition[2] - 0) ** 2
      );
      expect(startDist).toBeLessThan(0.01);
      expect(endDist).toBeLessThan(0.01);
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

      const result = processSegments(topology, [line]);

      expect(countByModifier(result, 'inner')).toBeGreaterThanOrEqual(1);
      expect(countByModifier(result, undefined)).toBeGreaterThanOrEqual(2);
    });

    it('inner segment is between two face intersections', () => {
      const topology = getTetrahedronTopology();
      const line: SceneLine = {
        pointA: [1, -1, 0.75],
        pointB: [1, 3, 0.75],
      };

      const result = processSegments(topology, [line]);
      const innerSegments = result.filter(segment => segment.modifier === 'inner');

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

      const result = processSegments(topology, [line]);

      expect(countByModifier(result, undefined)).toBeGreaterThanOrEqual(1);
      expect(countByModifier(result, 'inner')).toBe(0);
      expect(countByModifier(result, 'segment')).toBe(0);
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

      const result = processSegments(topology, [line]);

      // Part of the line inside the base triangle should be 'inner'
      expect(countByModifier(result, 'inner')).toBeGreaterThanOrEqual(1);
      // Extensions beyond the triangle should be regular (no modifier)
      expect(countByModifier(result, undefined)).toBeGreaterThanOrEqual(1);
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

      const result = processSegments(topology, [line]);

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

      const result = processSegments(topology, lines);

      const line0Segments = result.filter(segment => segment.sourceLineIndex === 0);
      const line1Segments = result.filter(segment => segment.sourceLineIndex === 1);

      expect(line0Segments.length).toBeGreaterThan(0);
      expect(line1Segments.length).toBeGreaterThan(0);

      // Line 0 is along an edge → has segment modifier
      expect(line0Segments.some(segment => segment.modifier === 'segment')).toBe(true);
      // Line 1 misses figure → only regular (no modifier)
      expect(line1Segments.every(segment => segment.modifier === undefined)).toBe(true);
    });
  });

  describe('degenerate cases', () => {
    it('handles degenerate zero-length line', () => {
      const topology = getTetrahedronTopology();
      const line: SceneLine = {
        pointA: [1, 1, 1],
        pointB: [1, 1, 1],
      };

      const result = processSegments(topology, [line]);
      expect(result).toHaveLength(0);
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

      const result = processSegments(topology, [line]);

      // Should have at least one inner or segment modifier
      const hasInnerOrSegment = result.some(
        segment => segment.modifier === 'inner' || segment.modifier === 'segment'
      );
      expect(hasInnerOrSegment).toBe(true);
    });

    it('line from apex (vertex 5) to opposite base vertex has inner segments', () => {
      const topology = preparePuzzle(PENTAGONAL_PYRAMID).topology;
      // apex = [0, 0.75, 0], vertex 2 = [0.587785, -0.75, -0.809017]
      // This line goes along an edge, so it should get 'segment'
      const line: SceneLine = {
        pointA: topology.vertices[5],
        pointB: topology.vertices[2],
      };

      const result = processSegments(topology, [line]);

      expect(countByModifier(result, 'segment')).toBe(1);
    });

    it('line from vertex 0 through apex and beyond has inner segment', () => {
      const topology = preparePuzzle(PENTAGONAL_PYRAMID).topology;
      // vertex 0 = [0, -0.75, 1], extend through apex [0, 0.75, 0] and beyond
      const line: SceneLine = {
        pointA: [0, -0.75, 1],
        pointB: [0, 2.25, -1], // well past the apex
      };

      const result = processSegments(topology, [line]);

      // The segment from v0 to apex should be 'segment' (along edge), and
      // there should be inner segments where the line is inside the figure
      const hasInnerOrSegment = result.some(
        segment => segment.modifier === 'inner' || segment.modifier === 'segment'
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

      const result = processSegments(topology, [line]);

      expect(countByModifier(result, 'inner')).toBeGreaterThanOrEqual(1);
    });
  });
});
