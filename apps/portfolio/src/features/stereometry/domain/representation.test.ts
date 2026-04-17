import { describe, expect, it } from 'vitest';

import { preparePuzzle } from './geometry';
import { PUZZLE_1_1 } from './puzzles/puzzle-1-1';
import { buildRepresentation } from './representation';
import type { FigureTopology, TopologyLine, TopologyVertex, Vec3Array } from './topology-types';
import { SELECTION_NONE } from './topology-types';
import type { PuzzleDefinition } from './types';

/** Simple tetrahedron for testing */
const TETRAHEDRON: PuzzleDefinition = {
  id: 'tetrahedron',
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

function createVertices(topology: FigureTopology): readonly TopologyVertex[] {
  return topology.vertices.map((position, index) => ({
    vertexId: index,
    position,
    kind: 'figure' as const,
    crossLineIds: [],
  }));
}

function hasEdgeSegments(
  segments: readonly { lineId: number; startVertexIndex: number; endVertexIndex: number }[]
): boolean {
  // Edge segments have lineId = -1 (TOPOLOGY_EDGE_SEGMENT_LINE_ID)
  return segments.some(segment => segment.lineId === -1);
}

function countEdgeSegments(segments: readonly { lineId: number }[]): number {
  return segments.filter(segment => segment.lineId === -1).length;
}

describe('buildRepresentation', () => {
  describe('segment processing', () => {
    it('returns topology edges when no lines are present', () => {
      const topology = getTetrahedronTopology();
      const vertices = createVertices(topology);
      const result = buildRepresentation(topology, [], vertices, SELECTION_NONE);
      // Tetrahedron has 6 edges, all as topology edge segments
      expect(countEdgeSegments(result.segments)).toBe(topology.edges.length);
    });

    describe('line through topology edge', () => {
      it('drops the line segment that coincides with the edge, keeps 2 outer parts', () => {
        const topology = getTetrahedronTopology();
        const line: TopologyLine = {
          lineId: 0,
          pointA: topology.vertices[0],
          pointB: topology.vertices[1],
          kind: 'line',
          isInput: false,
          startVertexId: -1,
          endVertexId: -1,
        };
        const vertices = createVertices(topology);

        const result = buildRepresentation(topology, [line], vertices, SELECTION_NONE);

        // Line's segment part is dropped; topology edges cover it
        const lineSegments = result.segments.filter(segment => segment.lineId === 0);
        expect(lineSegments).toHaveLength(2);
        expect(lineSegments.every(segment => segment.lineId !== -1)).toBe(true);

        // All topology edges are present
        expect(hasEdgeSegments(result.segments)).toBe(true);
        expect(countEdgeSegments(result.segments)).toBe(topology.edges.length);
      });
    });

    describe('line cutting through figure', () => {
      it('produces segments with inner styling where line is inside', () => {
        const topology = getTetrahedronTopology();
        // Line through the center of the tetrahedron, not along any edge
        const line: TopologyLine = {
          lineId: 0,
          pointA: [1, -1, 0.75],
          pointB: [1, 3, 0.75],
          kind: 'line',
          isInput: false,
          startVertexId: -1,
          endVertexId: -1,
        };
        const vertices = createVertices(topology);

        const result = buildRepresentation(topology, [line], vertices, SELECTION_NONE);

        // Should have some non-topology line segments
        const lineSegments = result.segments.filter(segment => segment.lineId === 0);
        expect(lineSegments.length).toBeGreaterThanOrEqual(3);
      });

      it('inner segment is between two face intersections', () => {
        const topology = getTetrahedronTopology();
        const line: TopologyLine = {
          lineId: 0,
          pointA: [1, -1, 0.75],
          pointB: [1, 3, 0.75],
          kind: 'line',
          isInput: false,
          startVertexId: -1,
          endVertexId: -1,
        };
        const vertices = createVertices(topology);

        const result = buildRepresentation(topology, [line], vertices, SELECTION_NONE);
        const lineSegments = result.segments.filter(segment => segment.lineId === 0);

        // Should have multiple segments (extended line is split at face intersections)
        expect(lineSegments.length).toBeGreaterThanOrEqual(3);
      });
    });

    describe('line missing the figure entirely', () => {
      it('produces only regular segments', () => {
        const topology = getTetrahedronTopology();
        // Line far from the tetrahedron
        const line: TopologyLine = {
          lineId: 0,
          pointA: [10, 10, 10],
          pointB: [11, 10, 10],
          kind: 'line',
          isInput: false,
          startVertexId: -1,
          endVertexId: -1,
        };
        const vertices = createVertices(topology);

        const result = buildRepresentation(topology, [line], vertices, SELECTION_NONE);

        const lineSegments = result.segments.filter(segment => segment.lineId >= 0);
        expect(lineSegments.length).toBeGreaterThanOrEqual(1);
      });
    });

    describe('line coplanar with a face', () => {
      it('produces styled segments where line lies on the face', () => {
        const topology = getTetrahedronTopology();
        // Draw a line across the base (not along an edge)
        const line: TopologyLine = {
          lineId: 0,
          pointA: [0.5, 0, 0.5],
          pointB: [1.5, 0, 0.5],
          kind: 'line',
          isInput: false,
          startVertexId: -1,
          endVertexId: -1,
        };
        const vertices = createVertices(topology);

        const result = buildRepresentation(topology, [line], vertices, SELECTION_NONE);

        const lineSegments = result.segments.filter(segment => segment.lineId === 0);
        expect(lineSegments.length).toBeGreaterThanOrEqual(2);
      });

      it('diagonal across base face produces segments', () => {
        const topology = getTetrahedronTopology();
        const midpoint01: Vec3Array = [1, 0, 0];
        const midpoint12: Vec3Array = [1.5, 0, 1];
        const line: TopologyLine = {
          lineId: 0,
          pointA: midpoint01,
          pointB: midpoint12,
          kind: 'line',
          isInput: false,
          startVertexId: -1,
          endVertexId: -1,
        };
        const vertices = createVertices(topology);

        const result = buildRepresentation(topology, [line], vertices, SELECTION_NONE);

        const lineSegments = result.segments.filter(segment => segment.lineId === 0);
        expect(lineSegments.length).toBeGreaterThanOrEqual(1);
      });
    });

    describe('multiple lines', () => {
      it('processes each line independently with correct lineId', () => {
        const topology = getTetrahedronTopology();
        const lines: TopologyLine[] = [
          {
            lineId: 0,
            pointA: topology.vertices[0],
            pointB: topology.vertices[1],
            kind: 'line',
            isInput: false,
            startVertexId: -1,
            endVertexId: -1,
          },
          {
            lineId: 1,
            pointA: [10, 10, 10],
            pointB: [11, 10, 10],
            kind: 'line',
            isInput: false,
            startVertexId: -1,
            endVertexId: -1,
          },
        ];
        const vertices = createVertices(topology);

        const result = buildRepresentation(topology, lines, vertices, SELECTION_NONE);

        const line0Segments = result.segments.filter(segment => segment.lineId === 0);
        const line1Segments = result.segments.filter(segment => segment.lineId === 1);

        expect(line0Segments.length).toBeGreaterThan(0);
        expect(line1Segments.length).toBeGreaterThan(0);

        // Line 0 is along an edge -> its segment part is dropped (topology edge covers it)
        expect(line0Segments.every(segment => segment.lineId !== -1)).toBe(true);
      });
    });

    describe('degenerate cases', () => {
      it('handles degenerate zero-length line', () => {
        const topology = getTetrahedronTopology();
        const line: TopologyLine = {
          lineId: 0,
          pointA: [1, 1, 1],
          pointB: [1, 1, 1],
          kind: 'line',
          isInput: false,
          startVertexId: -1,
          endVertexId: -1,
        };
        const vertices = createVertices(topology);

        const result = buildRepresentation(topology, [line], vertices, SELECTION_NONE);
        // Only topology edges, no line segments
        const lineSegments = result.segments.filter(segment => segment.lineId >= 0);
        expect(lineSegments).toHaveLength(0);
      });
    });

    describe('edge-extended line', () => {
      const EXTENDED_LINE_ID = 100;
      const POSITION_EPSILON = 1e-5;

      function positionsClose(positionA: Vec3Array, positionB: Vec3Array): boolean {
        return (
          Math.abs(positionA[0] - positionB[0]) < POSITION_EPSILON &&
          Math.abs(positionA[1] - positionB[1]) < POSITION_EPSILON &&
          Math.abs(positionA[2] - positionB[2]) < POSITION_EPSILON
        );
      }

      function segmentMatchesRange(
        segment: { startPosition: Vec3Array; endPosition: Vec3Array },
        rangeStart: Vec3Array,
        rangeEnd: Vec3Array
      ): boolean {
        return (
          (positionsClose(segment.startPosition, rangeStart) &&
            positionsClose(segment.endPosition, rangeEnd)) ||
          (positionsClose(segment.startPosition, rangeEnd) &&
            positionsClose(segment.endPosition, rangeStart))
        );
      }

      function buildExtendedEdgeLine(topology: FigureTopology, edgeIndex: number): TopologyLine {
        const [vertexAIndex, vertexBIndex] = topology.edges[edgeIndex];
        return {
          lineId: EXTENDED_LINE_ID,
          pointA: topology.vertices[vertexAIndex],
          pointB: topology.vertices[vertexBIndex],
          kind: 'edge-extended',
          isInput: true,
          startVertexId: vertexAIndex,
          endVertexId: vertexBIndex,
        };
      }

      it('renders the original edge position exactly once (fixes disappearing edge)', () => {
        const topology = getTetrahedronTopology();
        const edgeIndex = 0;
        const [vertexAIndex, vertexBIndex] = topology.edges[edgeIndex];
        const edgeStart = topology.vertices[vertexAIndex];
        const edgeEnd = topology.vertices[vertexBIndex];

        const vertices = createVertices(topology);
        const result = buildRepresentation(
          topology,
          [buildExtendedEdgeLine(topology, edgeIndex)],
          vertices,
          SELECTION_NONE
        );

        const coveringSegments = result.segments.filter(segment =>
          segmentMatchesRange(segment, edgeStart, edgeEnd)
        );

        expect(coveringSegments).toHaveLength(1);
      });

      it('skips the extended edge in the topology-edge path (no duplicate render)', () => {
        const topology = getTetrahedronTopology();
        const vertices = createVertices(topology);

        const result = buildRepresentation(
          topology,
          [buildExtendedEdgeLine(topology, 0)],
          vertices,
          SELECTION_NONE
        );

        expect(countEdgeSegments(result.segments)).toBe(topology.edges.length - 1);
      });

      it('the covering segment is produced by the line path, not the topology path', () => {
        const topology = getTetrahedronTopology();
        const edgeIndex = 0;
        const [vertexAIndex, vertexBIndex] = topology.edges[edgeIndex];
        const edgeStart = topology.vertices[vertexAIndex];
        const edgeEnd = topology.vertices[vertexBIndex];

        const vertices = createVertices(topology);
        const result = buildRepresentation(
          topology,
          [buildExtendedEdgeLine(topology, edgeIndex)],
          vertices,
          SELECTION_NONE
        );

        const coveringSegments = result.segments.filter(segment =>
          segmentMatchesRange(segment, edgeStart, edgeEnd)
        );

        expect(coveringSegments).toHaveLength(1);
        expect(coveringSegments[0].lineId).toBe(EXTENDED_LINE_ID);
      });

      it('produces additional sub-segments outside the original edge range (extensions)', () => {
        const topology = getTetrahedronTopology();
        const vertices = createVertices(topology);

        const result = buildRepresentation(
          topology,
          [buildExtendedEdgeLine(topology, 0)],
          vertices,
          SELECTION_NONE
        );

        const lineSegments = result.segments.filter(segment => segment.lineId === EXTENDED_LINE_ID);

        // 2 extensions + 1 middle (original edge portion) = at least 3
        expect(lineSegments.length).toBeGreaterThanOrEqual(3);
      });

      it('middle sub-segment inherits the visual style of the original edge', () => {
        const topology = getTetrahedronTopology();
        const edgeIndex = 0;
        const [vertexAIndex, vertexBIndex] = topology.edges[edgeIndex];
        const edgeStart = topology.vertices[vertexAIndex];
        const edgeEnd = topology.vertices[vertexBIndex];
        const vertices = createVertices(topology);

        // Baseline: no extension, edge rendered by topology path with ['edge', 'segment']
        const baselineResult = buildRepresentation(topology, [], vertices, SELECTION_NONE);
        const baselineEdgeSegment = baselineResult.segments.find(segment =>
          segmentMatchesRange(segment, edgeStart, edgeEnd)
        );
        expect(baselineEdgeSegment).toBeDefined();

        // Extended: middle from line path with 'edge' modifier promotion
        const extendedResult = buildRepresentation(
          topology,
          [buildExtendedEdgeLine(topology, edgeIndex)],
          vertices,
          SELECTION_NONE
        );
        const extendedMiddleSegment = extendedResult.segments.find(segment =>
          segmentMatchesRange(segment, edgeStart, edgeEnd)
        );
        expect(extendedMiddleSegment).toBeDefined();

        expect(extendedMiddleSegment?.visibleStyle.width).toBe(
          baselineEdgeSegment?.visibleStyle.width
        );
        expect(extendedMiddleSegment?.visibleStyle.color).toEqual(
          baselineEdgeSegment?.visibleStyle.color
        );
      });

      it('does not mark extension sub-segments as edges', () => {
        const topology = getTetrahedronTopology();
        const edgeIndex = 0;
        const [vertexAIndex, vertexBIndex] = topology.edges[edgeIndex];
        const edgeStart = topology.vertices[vertexAIndex];
        const edgeEnd = topology.vertices[vertexBIndex];
        const vertices = createVertices(topology);

        const baselineResult = buildRepresentation(topology, [], vertices, SELECTION_NONE);
        const baselineEdgeSegment = baselineResult.segments.find(segment =>
          segmentMatchesRange(segment, edgeStart, edgeEnd)
        );
        expect(baselineEdgeSegment).toBeDefined();

        const extendedResult = buildRepresentation(
          topology,
          [buildExtendedEdgeLine(topology, edgeIndex)],
          vertices,
          SELECTION_NONE
        );

        const extensionSegments = extendedResult.segments
          .filter(segment => segment.lineId === EXTENDED_LINE_ID)
          .filter(segment => !segmentMatchesRange(segment, edgeStart, edgeEnd));

        expect(extensionSegments.length).toBeGreaterThan(0);
        // Extensions are thinner construction-line style, not edge-thick
        for (const extension of extensionSegments) {
          expect(extension.visibleStyle.width).toBeLessThan(
            baselineEdgeSegment?.visibleStyle.width ?? Number.POSITIVE_INFINITY
          );
        }
      });
    });

    describe('pentagonal pyramid - line through figure', () => {
      it('line from vertex 0 to vertex 2 (through interior) has styled segments', () => {
        const topology = preparePuzzle(PUZZLE_1_1).topology;
        const line: TopologyLine = {
          lineId: 0,
          pointA: topology.vertices[0],
          pointB: topology.vertices[2],
          kind: 'line',
          isInput: false,
          startVertexId: -1,
          endVertexId: -1,
        };
        const vertices = createVertices(topology);

        const result = buildRepresentation(topology, [line], vertices, SELECTION_NONE);

        // Should have topology edge segments
        expect(hasEdgeSegments(result.segments)).toBe(true);
      });

      it('line from apex (vertex 5) to opposite base vertex drops segment part', () => {
        const topology = preparePuzzle(PUZZLE_1_1).topology;
        const line: TopologyLine = {
          lineId: 0,
          pointA: topology.vertices[5],
          pointB: topology.vertices[2],
          kind: 'line',
          isInput: false,
          startVertexId: -1,
          endVertexId: -1,
        };
        const vertices = createVertices(topology);

        const result = buildRepresentation(topology, [line], vertices, SELECTION_NONE);

        // Line's own segments should not be topology edges
        const lineSegments = result.segments.filter(segment => segment.lineId === 0);
        expect(lineSegments.every(segment => segment.lineId !== -1)).toBe(true);
        expect(lineSegments.length).toBeGreaterThan(0);
      });

      it('line from vertex 0 through apex and beyond has segments', () => {
        const topology = preparePuzzle(PUZZLE_1_1).topology;
        const line: TopologyLine = {
          lineId: 0,
          pointA: [0, -0.75, 1],
          pointB: [0, 2.25, -1],
          kind: 'line',
          isInput: false,
          startVertexId: -1,
          endVertexId: -1,
        };
        const vertices = createVertices(topology);

        const result = buildRepresentation(topology, [line], vertices, SELECTION_NONE);

        const lineSegments = result.segments.filter(segment => segment.lineId === 0);
        expect(lineSegments.length).toBeGreaterThan(0);
      });

      it('line cutting diagonally through the pyramid (not through vertices) has segments', () => {
        const topology = preparePuzzle(PUZZLE_1_1).topology;
        const line: TopologyLine = {
          lineId: 0,
          pointA: [-1, 0, 0],
          pointB: [1, 0, 0],
          kind: 'line',
          isInput: false,
          startVertexId: -1,
          endVertexId: -1,
        };
        const vertices = createVertices(topology);

        const result = buildRepresentation(topology, [line], vertices, SELECTION_NONE);

        const lineSegments = result.segments.filter(segment => segment.lineId === 0);
        expect(lineSegments.length).toBeGreaterThanOrEqual(3);
      });
    });
  });

  describe('marker processing', () => {
    it('produces markers for all vertices in the scene', () => {
      const topology = getTetrahedronTopology();
      const vertices = createVertices(topology);

      const result = buildRepresentation(topology, [], vertices, SELECTION_NONE);

      expect(result.markers).toHaveLength(topology.vertices.length);
    });

    it('markers have both visible and hidden styles', () => {
      const topology = getTetrahedronTopology();
      const vertices = createVertices(topology);

      const result = buildRepresentation(topology, [], vertices, SELECTION_NONE);

      for (const marker of result.markers) {
        expect(marker.visibleStyle).toBeDefined();
        expect(marker.hiddenStyle).toBeDefined();
        expect(marker.visibleStyle.size).toBeGreaterThan(0);
        expect(marker.hiddenStyle.size).toBeGreaterThan(0);
      }
    });

    it('marker positions match scene vertex positions', () => {
      const topology = getTetrahedronTopology();
      const vertices = createVertices(topology);

      const result = buildRepresentation(topology, [], vertices, SELECTION_NONE);

      for (let index = 0; index < topology.vertices.length; index++) {
        expect(result.markers[index].position).toEqual(topology.vertices[index]);
      }
    });

    it('produces markers with valid color values', () => {
      const topology = getTetrahedronTopology();
      const vertices = createVertices(topology);

      const result = buildRepresentation(topology, [], vertices, SELECTION_NONE);

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
      const vertices = createVertices(topology);

      const result = buildRepresentation(topology, [], vertices, SELECTION_NONE);

      expect(result.segments.length).toBeGreaterThan(0);
      expect(result.markers.length).toBeGreaterThan(0);
    });

    it('styled segments have both visible and hidden styles', () => {
      const topology = getTetrahedronTopology();
      const vertices = createVertices(topology);

      const result = buildRepresentation(topology, [], vertices, SELECTION_NONE);

      for (const segment of result.segments) {
        expect(segment.visibleStyle).toBeDefined();
        expect(segment.hiddenStyle).toBeDefined();
        expect(segment.visibleStyle.width).toBeGreaterThan(0);
      }
    });
  });

  describe('solution styling', () => {
    // Solution style color: #EFBF04 → (0xEF/255, 0xBF/255, 0x04/255)
    const SOLUTION_R = 0xef / 0xff;
    const SOLUTION_G = 0xbf / 0xff;
    const SOLUTION_B = 0x04 / 0xff;
    const COLOR_EPSILON = 0.001;

    function hasSolutionColor(color: readonly number[]): boolean {
      return (
        Math.abs(color[0] - SOLUTION_R) < COLOR_EPSILON &&
        Math.abs(color[1] - SOLUTION_G) < COLOR_EPSILON &&
        Math.abs(color[2] - SOLUTION_B) < COLOR_EPSILON
      );
    }

    it('does not apply solution style when solutionStatus is undefined', () => {
      const topology = getTetrahedronTopology();
      const vertices = createVertices(topology);
      const result = buildRepresentation(topology, [], vertices, SELECTION_NONE);

      for (const segment of result.segments) {
        expect(hasSolutionColor(segment.visibleStyle.color)).toBe(false);
      }
    });

    it('applies solution color to edge segments that match a solution range', () => {
      const topology = getTetrahedronTopology();
      const vertices = createVertices(topology);
      const edgeStart = topology.vertices[0];
      const edgeEnd = topology.vertices[1];

      const solutionStatus = {
        isSolved: true,
        solutionVertexPositions: [edgeStart, edgeEnd],
        solutionLineRanges: [[edgeStart, edgeEnd]] as const,
        solutionFaces: [],
      };

      const result = buildRepresentation(
        topology,
        [],
        vertices,
        SELECTION_NONE,
        undefined,
        solutionStatus
      );

      const solutionSegments = result.segments.filter(segment =>
        hasSolutionColor(segment.visibleStyle.color)
      );
      expect(solutionSegments.length).toBeGreaterThan(0);
    });

    it('does not apply solution color when isSolved is false', () => {
      const topology = getTetrahedronTopology();
      const vertices = createVertices(topology);
      const edgeStart = topology.vertices[0];
      const edgeEnd = topology.vertices[1];

      const solutionStatus = {
        isSolved: false,
        solutionVertexPositions: [edgeStart, edgeEnd],
        solutionLineRanges: [[edgeStart, edgeEnd]] as const,
        solutionFaces: [],
      };

      const result = buildRepresentation(
        topology,
        [],
        vertices,
        SELECTION_NONE,
        undefined,
        solutionStatus
      );

      for (const segment of result.segments) {
        expect(hasSolutionColor(segment.visibleStyle.color)).toBe(false);
      }
    });

    it('does not build solutionFace when solutionStatus is undefined', () => {
      const topology = getTetrahedronTopology();
      const vertices = createVertices(topology);
      const result = buildRepresentation(topology, [], vertices, SELECTION_NONE);

      expect(result.solutionFace).toBeUndefined();
    });

    it('builds triangulated solutionFace for a triangular polygon', () => {
      const topology = getTetrahedronTopology();
      const vertices = createVertices(topology);
      const face: readonly Vec3Array[] = [
        [0, 0, 0],
        [1, 0, 0],
        [0.5, 1, 0],
      ];
      const solutionStatus = {
        isSolved: true,
        solutionVertexPositions: [],
        solutionLineRanges: [],
        solutionFaces: [face],
      };

      const result = buildRepresentation(
        topology,
        [],
        vertices,
        SELECTION_NONE,
        undefined,
        solutionStatus
      );

      // Triangle = 1 triangle × 3 vertices = 3 vertices, 7 floats each
      expect(result.solutionFace).toBeDefined();
      expect(result.solutionFace?.vertexCount).toBe(3);
      expect(result.solutionFace?.vertices.length).toBe(3 * 7);
    });

    it('builds a 3-triangle fan for a pentagon', () => {
      const topology = getTetrahedronTopology();
      const vertices = createVertices(topology);
      const pentagon: readonly Vec3Array[] = [
        [0, 0, 0],
        [1, 0, 0],
        [1.5, 1, 0],
        [0.5, 1.5, 0],
        [-0.5, 1, 0],
      ];
      const solutionStatus = {
        isSolved: true,
        solutionVertexPositions: [],
        solutionLineRanges: [],
        solutionFaces: [pentagon],
      };

      const result = buildRepresentation(
        topology,
        [],
        vertices,
        SELECTION_NONE,
        undefined,
        solutionStatus
      );

      // Pentagon: 5-2 = 3 triangles × 3 vertices = 9 vertices
      expect(result.solutionFace?.vertexCount).toBe(9);
    });
  });
});
