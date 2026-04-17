import { assertNever } from '@frozik/utils';
import { isPointOnInfiniteLine, isPointOnSegment, positionsMatch } from './geometry-utils';
import type { SceneTopology, TopologyLine, Vec3Array } from './topology-types';
import type { PuzzleExpectedResult } from './types';

/**
 * Result of checking whether the scene matches the puzzle's expected solution.
 *
 * When `isSolved` is true, `solutionVertexPositions` and `solutionLineRanges`
 * describe which scene elements belong to the solution and should be marked
 * with the `solution` style modifier.
 */
export interface SolutionStatus {
  readonly isSolved: boolean;
  /** Positions of vertices that belong to the solution (expected vertices, face corners, line endpoints) */
  readonly solutionVertexPositions: readonly Vec3Array[];
  /** Line ranges [pointA, pointB] covered by the solution (expected lines + face perimeter edges) */
  readonly solutionLineRanges: readonly (readonly [Vec3Array, Vec3Array])[];
  /** Raw face polygons (ordered vertices) to be rendered as highlighted planes when solved */
  readonly solutionFaces: readonly (readonly Vec3Array[])[];
}

const EMPTY_SOLUTION: SolutionStatus = {
  isSolved: false,
  solutionVertexPositions: [],
  solutionLineRanges: [],
  solutionFaces: [],
};

/**
 * Computes the solution status for the current scene topology against the
 * puzzle's expected result.
 *
 * The puzzle is considered solved when every expected vertex exists in the
 * scene AND every expected line / face perimeter edge is covered by some
 * topology line.
 */
export function computeSolutionStatus(
  expected: PuzzleExpectedResult,
  topology: SceneTopology
): SolutionStatus {
  const expectedVertices = expected.vertices ?? [];
  const expectedLines = expected.lines ?? [];
  const expectedFaces = expected.faces ?? [];

  const facePerimeterRanges = expectedFaces.flatMap(face =>
    face.map((point, index): readonly [Vec3Array, Vec3Array] => [
      point,
      face[(index + 1) % face.length],
    ])
  );

  const allLineRanges: readonly (readonly [Vec3Array, Vec3Array])[] = [
    ...expectedLines,
    ...facePerimeterRanges,
  ];

  const hasNothingExpected = expectedVertices.length === 0 && allLineRanges.length === 0;
  if (hasNothingExpected) {
    return EMPTY_SOLUTION;
  }

  for (const expectedPosition of expectedVertices) {
    if (!topology.vertices.some(vertex => positionsMatch(vertex.position, expectedPosition))) {
      return EMPTY_SOLUTION;
    }
  }

  for (const [pointA, pointB] of allLineRanges) {
    if (!topology.lines.some(line => lineCoversSegment(line, pointA, pointB))) {
      return EMPTY_SOLUTION;
    }
  }

  const faceVertexPositions = expectedFaces.flat();
  const lineEndpointPositions = expectedLines.flat();

  return {
    isSolved: true,
    solutionVertexPositions: [
      ...expectedVertices,
      ...lineEndpointPositions,
      ...faceVertexPositions,
    ],
    solutionLineRanges: allLineRanges,
    solutionFaces: expectedFaces,
  };
}

/**
 * Checks whether a topology line covers the straight segment from pointA to pointB.
 * For infinite lines, both points must be collinear.
 * For finite edges/segments, both points must lie within the segment bounds.
 */
function lineCoversSegment(line: TopologyLine, pointA: Vec3Array, pointB: Vec3Array): boolean {
  switch (line.kind) {
    case 'line':
    case 'edge-extended':
    case 'segment-extended':
      return (
        isPointOnInfiniteLine(pointA, line.pointA, line.pointB) &&
        isPointOnInfiniteLine(pointB, line.pointA, line.pointB)
      );
    case 'edge':
    case 'segment':
      return (
        isPointOnSegment(pointA, line.pointA, line.pointB) &&
        isPointOnSegment(pointB, line.pointA, line.pointB)
      );
    default:
      assertNever(line.kind);
  }
}

/**
 * Returns true if the given rendered sub-segment lies entirely within the
 * solution line range [rangeStart, rangeEnd].
 */
export function isSubSegmentInSolutionRange(
  subSegmentStart: Vec3Array,
  subSegmentEnd: Vec3Array,
  rangeStart: Vec3Array,
  rangeEnd: Vec3Array
): boolean {
  return (
    isPointOnSegment(subSegmentStart, rangeStart, rangeEnd) &&
    isPointOnSegment(subSegmentEnd, rangeStart, rangeEnd)
  );
}
