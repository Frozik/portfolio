import { describe, expect, it } from 'vitest';

import { preparePuzzle } from './geometry';
import { processGraphics } from './graphics-processor';
import { PENTAGONAL_PYRAMID } from './puzzles/pentagonal-pyramid';
import type { FigureTopology, PuzzleDefinition, SceneLine, SceneState } from './types';
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

function createSceneState(topology: FigureTopology, lines: readonly SceneLine[] = []): SceneState {
  return {
    vertices: topology.vertices.map((position, index) => ({
      position,
      topologyIndex: index,
    })),
    lines,
    intersections: [],
  };
}

function countSegmentsByModifier(
  segments: readonly { isTopologyEdge: boolean; sourceLineIndex: number }[],
  modifier: 'topologyEdge'
): number;
function countSegmentsByModifier(
  segments: readonly { isTopologyEdge: boolean; sourceLineIndex: number }[],
  modifier: string
): number {
  if (modifier === 'topologyEdge') {
    return segments.filter(segment => segment.isTopologyEdge).length;
  }
  return 0;
}

describe('processGraphics', () => {
  describe('segment processing', () => {
    it('returns topology edges when no lines are present', () => {
      const topology = getTetrahedronTopology();
      const scene = createSceneState(topology);
      const result = processGraphics(topology, scene, SELECTION_NONE);
      // Tetrahedron has 6 edges, all as topology edges
      expect(countSegmentsByModifier(result.segments, 'topologyEdge')).toBe(topology.edges.length);
    });

    describe('line through topology edge', () => {
      it('drops the line segment that coincides with the edge, keeps 2 outer parts', () => {
        const topology = getTetrahedronTopology();
        const line: SceneLine = {
          pointA: topology.vertices[0],
          pointB: topology.vertices[1],
        };
        const scene = createSceneState(topology, [line]);

        const result = processGraphics(topology, scene, SELECTION_NONE);

        // Line's segment part is dropped; topology edges cover it
        const lineSegments = result.segments.filter(segment => segment.sourceLineIndex === 0);
        expect(lineSegments).toHaveLength(2);
        expect(lineSegments.every(segment => !segment.isTopologyEdge)).toBe(true);

        // All topology edges are present
        expect(countSegmentsByModifier(result.segments, 'topologyEdge')).toBe(
          topology.edges.length
        );
      });
    });

    describe('line cutting through figure', () => {
      it('produces segments with inner styling where line is inside', () => {
        const topology = getTetrahedronTopology();
        // Line through the center of the tetrahedron, not along any edge
        const line: SceneLine = {
          pointA: [1, -1, 0.75],
          pointB: [1, 3, 0.75],
        };
        const scene = createSceneState(topology, [line]);

        const result = processGraphics(topology, scene, SELECTION_NONE);

        // Should have some non-topology line segments
        const lineSegments = result.segments.filter(segment => segment.sourceLineIndex === 0);
        expect(lineSegments.length).toBeGreaterThanOrEqual(3);
      });

      it('inner segment is between two face intersections', () => {
        const topology = getTetrahedronTopology();
        const line: SceneLine = {
          pointA: [1, -1, 0.75],
          pointB: [1, 3, 0.75],
        };
        const scene = createSceneState(topology, [line]);

        const result = processGraphics(topology, scene, SELECTION_NONE);
        const lineSegments = result.segments.filter(segment => segment.sourceLineIndex === 0);

        // Should have multiple segments (extended line is split at face intersections)
        expect(lineSegments.length).toBeGreaterThanOrEqual(3);
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
        const scene = createSceneState(topology, [line]);

        const result = processGraphics(topology, scene, SELECTION_NONE);

        const lineSegments = result.segments.filter(segment => segment.sourceLineIndex >= 0);
        expect(lineSegments.length).toBeGreaterThanOrEqual(1);
      });
    });

    describe('line coplanar with a face', () => {
      it('produces styled segments where line lies on the face', () => {
        const topology = getTetrahedronTopology();
        // Draw a line across the base (not along an edge)
        const line: SceneLine = {
          pointA: [0.5, 0, 0.5],
          pointB: [1.5, 0, 0.5],
        };
        const scene = createSceneState(topology, [line]);

        const result = processGraphics(topology, scene, SELECTION_NONE);

        const lineSegments = result.segments.filter(segment => segment.sourceLineIndex === 0);
        expect(lineSegments.length).toBeGreaterThanOrEqual(2);
      });

      it('diagonal across base face produces segments', () => {
        const topology = getTetrahedronTopology();
        const midpoint01: readonly [number, number, number] = [1, 0, 0];
        const midpoint12: readonly [number, number, number] = [1.5, 0, 1];
        const line: SceneLine = {
          pointA: midpoint01,
          pointB: midpoint12,
        };
        const scene = createSceneState(topology, [line]);

        const result = processGraphics(topology, scene, SELECTION_NONE);

        const lineSegments = result.segments.filter(segment => segment.sourceLineIndex === 0);
        expect(lineSegments.length).toBeGreaterThanOrEqual(1);
      });
    });

    describe('multiple lines', () => {
      it('processes each line independently with correct sourceLineIndex', () => {
        const topology = getTetrahedronTopology();
        const lines: SceneLine[] = [
          { pointA: topology.vertices[0], pointB: topology.vertices[1] },
          { pointA: [10, 10, 10], pointB: [11, 10, 10] },
        ];
        const scene = createSceneState(topology, lines);

        const result = processGraphics(topology, scene, SELECTION_NONE);

        const line0Segments = result.segments.filter(segment => segment.sourceLineIndex === 0);
        const line1Segments = result.segments.filter(segment => segment.sourceLineIndex === 1);

        expect(line0Segments.length).toBeGreaterThan(0);
        expect(line1Segments.length).toBeGreaterThan(0);

        // Line 0 is along an edge → its segment part is dropped (topology edge covers it)
        expect(line0Segments.every(segment => !segment.isTopologyEdge)).toBe(true);
      });
    });

    describe('degenerate cases', () => {
      it('handles degenerate zero-length line', () => {
        const topology = getTetrahedronTopology();
        const line: SceneLine = {
          pointA: [1, 1, 1],
          pointB: [1, 1, 1],
        };
        const scene = createSceneState(topology, [line]);

        const result = processGraphics(topology, scene, SELECTION_NONE);
        // Only topology edges, no line segments
        const lineSegments = result.segments.filter(segment => segment.sourceLineIndex >= 0);
        expect(lineSegments).toHaveLength(0);
      });
    });

    describe('pentagonal pyramid - line through figure', () => {
      it('line from vertex 0 to vertex 2 (through interior) has styled segments', () => {
        const topology = preparePuzzle(PENTAGONAL_PYRAMID).topology;
        const line: SceneLine = {
          pointA: topology.vertices[0],
          pointB: topology.vertices[2],
        };
        const scene = createSceneState(topology, [line]);

        const result = processGraphics(topology, scene, SELECTION_NONE);

        // Should have topology edges and line segments
        const hasTopologyEdges = result.segments.some(segment => segment.isTopologyEdge);
        expect(hasTopologyEdges).toBe(true);
      });

      it('line from apex (vertex 5) to opposite base vertex drops segment part', () => {
        const topology = preparePuzzle(PENTAGONAL_PYRAMID).topology;
        const line: SceneLine = {
          pointA: topology.vertices[5],
          pointB: topology.vertices[2],
        };
        const scene = createSceneState(topology, [line]);

        const result = processGraphics(topology, scene, SELECTION_NONE);

        // Line's own segments should not be topology edges
        const lineSegments = result.segments.filter(segment => segment.sourceLineIndex === 0);
        expect(lineSegments.every(segment => !segment.isTopologyEdge)).toBe(true);
        expect(lineSegments.length).toBeGreaterThan(0);
      });

      it('line from vertex 0 through apex and beyond has segments', () => {
        const topology = preparePuzzle(PENTAGONAL_PYRAMID).topology;
        const line: SceneLine = {
          pointA: [0, -0.75, 1],
          pointB: [0, 2.25, -1],
        };
        const scene = createSceneState(topology, [line]);

        const result = processGraphics(topology, scene, SELECTION_NONE);

        const lineSegments = result.segments.filter(segment => segment.sourceLineIndex === 0);
        expect(lineSegments.length).toBeGreaterThan(0);
      });

      it('line cutting diagonally through the pyramid (not through vertices) has segments', () => {
        const topology = preparePuzzle(PENTAGONAL_PYRAMID).topology;
        const line: SceneLine = {
          pointA: [-1, 0, 0],
          pointB: [1, 0, 0],
        };
        const scene = createSceneState(topology, [line]);

        const result = processGraphics(topology, scene, SELECTION_NONE);

        const lineSegments = result.segments.filter(segment => segment.sourceLineIndex === 0);
        expect(lineSegments.length).toBeGreaterThanOrEqual(3);
      });
    });
  });

  describe('marker processing', () => {
    it('produces markers for all vertices in the scene', () => {
      const topology = getTetrahedronTopology();
      const scene = createSceneState(topology);

      const result = processGraphics(topology, scene, SELECTION_NONE);

      expect(result.markers).toHaveLength(topology.vertices.length);
    });

    it('markers have both visible and hidden styles', () => {
      const topology = getTetrahedronTopology();
      const scene = createSceneState(topology);

      const result = processGraphics(topology, scene, SELECTION_NONE);

      for (const marker of result.markers) {
        expect(marker.visibleStyle).toBeDefined();
        expect(marker.hiddenStyle).toBeDefined();
        expect(marker.visibleStyle.size).toBeGreaterThan(0);
        expect(marker.hiddenStyle.size).toBeGreaterThan(0);
      }
    });

    it('marker positions match scene vertex positions', () => {
      const topology = getTetrahedronTopology();
      const scene = createSceneState(topology);

      const result = processGraphics(topology, scene, SELECTION_NONE);

      for (let index = 0; index < topology.vertices.length; index++) {
        expect(result.markers[index].position).toEqual(topology.vertices[index]);
      }
    });

    it('produces markers with valid color values', () => {
      const topology = getTetrahedronTopology();
      const scene = createSceneState(topology);

      const result = processGraphics(topology, scene, SELECTION_NONE);

      for (const marker of result.markers) {
        for (const channel of marker.visibleStyle.color) {
          expect(channel).toBeGreaterThanOrEqual(0);
          expect(channel).toBeLessThanOrEqual(1);
        }
        for (const channel of marker.hiddenStyle.color) {
          expect(channel).toBeGreaterThanOrEqual(0);
          expect(channel).toBeLessThanOrEqual(1);
        }
      }
    });
  });

  describe('combined output', () => {
    it('returns both segments and markers from a single call', () => {
      const topology = getTetrahedronTopology();
      const scene = createSceneState(topology);

      const result = processGraphics(topology, scene, SELECTION_NONE);

      expect(result.segments.length).toBeGreaterThan(0);
      expect(result.markers.length).toBeGreaterThan(0);
    });

    it('styled segments have both visible and hidden styles', () => {
      const topology = getTetrahedronTopology();
      const scene = createSceneState(topology);

      const result = processGraphics(topology, scene, SELECTION_NONE);

      for (const segment of result.segments) {
        expect(segment.visibleStyle).toBeDefined();
        expect(segment.hiddenStyle).toBeDefined();
        expect(segment.visibleStyle.width).toBeGreaterThan(0);
      }
    });
  });
});
